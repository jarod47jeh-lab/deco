#!/usr/bin/env python3
"""LLM Council: 3-stage multi-model deliberation via OpenRouter.

Port of karpathy/llm-council's backend/council.py, standard library only.

Stage 1: every council model answers the question.
Stage 2: every model ranks the anonymized answers ("Response A", ...).
Stage 3: the chairman synthesizes a final answer.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

DEFAULT_MODELS = [
    "openai/gpt-5.1",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "x-ai/grok-4",
]
DEFAULT_CHAIRMAN = "google/gemini-3-pro-preview"


def load_dotenv():
    """Read KEY=VALUE lines from .env in the cwd or any parent, without overriding env."""
    for directory in [Path.cwd(), *Path.cwd().parents]:
        env_file = directory / ".env"
        if env_file.is_file():
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))
            return


def query_model(model, messages, api_key, timeout=120.0):
    """Query one model via OpenRouter. Returns the response text, or None on failure."""
    body = json.dumps({"model": model, "messages": messages}).encode()
    request = urllib.request.Request(
        OPENROUTER_API_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "X-Title": "LLM Council",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.load(response)
        return data["choices"][0]["message"].get("content") or ""
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:300]
        print(f"[council] {model} failed: HTTP {e.code} {detail}", file=sys.stderr)
    except Exception as e:  # network error, timeout, malformed response
        print(f"[council] {model} failed: {e}", file=sys.stderr)
    return None


def query_models_parallel(models, messages, api_key):
    with ThreadPoolExecutor(max_workers=len(models)) as pool:
        results = pool.map(lambda m: query_model(m, messages, api_key), models)
    return dict(zip(models, results))


def stage1_collect_responses(question, models, api_key):
    responses = query_models_parallel(models, [{"role": "user", "content": question}], api_key)
    return [{"model": m, "response": r} for m, r in responses.items() if r is not None]


def stage2_collect_rankings(question, stage1_results, models, api_key):
    labels = [chr(65 + i) for i in range(len(stage1_results))]  # A, B, C, ...
    label_to_model = {
        f"Response {label}": result["model"] for label, result in zip(labels, stage1_results)
    }
    responses_text = "\n\n".join(
        f"Response {label}:\n{result['response']}" for label, result in zip(labels, stage1_results)
    )
    ranking_prompt = f"""You are evaluating different responses to the following question:

Question: {question}

Here are the responses from different models (anonymized):

{responses_text}

Your task:
1. First, evaluate each response individually. For each response, explain what it does well and what it does poorly.
2. Then, at the very end of your response, provide a final ranking.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line should be: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text or explanations in the ranking section

Example of the correct format for your ENTIRE response:

Response A provides good detail on X but misses Y...
Response B is accurate but lacks depth on Z...
Response C offers the most comprehensive answer...

FINAL RANKING:
1. Response C
2. Response A
3. Response B

Now provide your evaluation and ranking:"""

    responses = query_models_parallel(models, [{"role": "user", "content": ranking_prompt}], api_key)
    stage2_results = [
        {"model": m, "ranking": r, "parsed_ranking": parse_ranking_from_text(r)}
        for m, r in responses.items()
        if r is not None
    ]
    return stage2_results, label_to_model


def parse_ranking_from_text(ranking_text):
    """Extract ["Response C", "Response A", ...] from the FINAL RANKING section."""
    if "FINAL RANKING:" in ranking_text:
        section = ranking_text.split("FINAL RANKING:")[-1]
        numbered = re.findall(r"\d+\.\s*Response [A-Z]", section)
        if numbered:
            return [re.search(r"Response [A-Z]", m).group() for m in numbered]
        return re.findall(r"Response [A-Z]", section)
    return re.findall(r"Response [A-Z]", ranking_text)


def calculate_aggregate_rankings(stage2_results, label_to_model):
    positions = {}
    for result in stage2_results:
        for position, label in enumerate(result["parsed_ranking"], start=1):
            if label in label_to_model:
                positions.setdefault(label_to_model[label], []).append(position)
    aggregate = [
        {
            "model": model,
            "average_rank": round(sum(p) / len(p), 2),
            "rankings_count": len(p),
        }
        for model, p in positions.items()
    ]
    return sorted(aggregate, key=lambda x: x["average_rank"])


def stage3_synthesize_final(question, stage1_results, stage2_results, chairman, api_key):
    stage1_text = "\n\n".join(
        f"Model: {r['model']}\nResponse: {r['response']}" for r in stage1_results
    )
    stage2_text = "\n\n".join(
        f"Model: {r['model']}\nRanking: {r['ranking']}" for r in stage2_results
    )
    chairman_prompt = f"""You are the Chairman of an LLM Council. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: {question}

STAGE 1 - Individual Responses:
{stage1_text}

STAGE 2 - Peer Rankings:
{stage2_text}

Your task as Chairman is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question. Consider:
- The individual responses and their insights
- The peer rankings and what they reveal about response quality
- Any patterns of agreement or disagreement

Provide a clear, well-reasoned final answer that represents the council's collective wisdom:"""

    response = query_model(chairman, [{"role": "user", "content": chairman_prompt}], api_key)
    return {
        "model": chairman,
        "response": response if response is not None else "Error: Unable to generate final synthesis.",
    }


def run_full_council(question, models, chairman, api_key):
    print(f"[council] Stage 1: asking {len(models)} models...", file=sys.stderr)
    stage1 = stage1_collect_responses(question, models, api_key)
    if not stage1:
        return {"error": "All models failed to respond. Please try again."}

    print("[council] Stage 2: peer review...", file=sys.stderr)
    stage2, label_to_model = stage2_collect_rankings(question, stage1, models, api_key)
    aggregate = calculate_aggregate_rankings(stage2, label_to_model)

    print(f"[council] Stage 3: chairman {chairman} synthesizing...", file=sys.stderr)
    stage3 = stage3_synthesize_final(question, stage1, stage2, chairman, api_key)

    return {
        "question": question,
        "stage1": stage1,
        "stage2": stage2,
        "stage3": stage3,
        "metadata": {"label_to_model": label_to_model, "aggregate_rankings": aggregate},
    }


def print_report(result):
    print("# LLM Council\n")
    print(f"**Question:** {result['question']}\n")
    print(f"## Final answer (Chairman: {result['stage3']['model']})\n")
    print(result["stage3"]["response"])
    print("\n## Aggregate peer ranking\n")
    print("| Rank | Model | Avg position | Votes |")
    print("|---|---|---|---|")
    for i, row in enumerate(result["metadata"]["aggregate_rankings"], start=1):
        print(f"| {i} | {row['model']} | {row['average_rank']} | {row['rankings_count']} |")
    print("\n## Stage 1: individual answers\n")
    for r in result["stage1"]:
        print(f"### {r['model']}\n\n{r['response']}\n")
    print("## Stage 2: peer reviews\n")
    print("Label mapping: " + ", ".join(
        f"{label} = {model}" for label, model in result["metadata"]["label_to_model"].items()
    ) + "\n")
    for r in result["stage2"]:
        print(f"### {r['model']}\n\n{r['ranking']}\n")


def main():
    parser = argparse.ArgumentParser(description="Run an LLM Council via OpenRouter.")
    parser.add_argument("question", nargs="+", help="The question to put to the council")
    parser.add_argument("--models", help="Comma-separated OpenRouter model IDs")
    parser.add_argument("--chairman", help="OpenRouter model ID of the chairman")
    parser.add_argument("--json", action="store_true", help="Print the full result as JSON")
    parser.add_argument("--save", metavar="DIR", help="Also save the full result as JSON in DIR")
    args = parser.parse_args()

    load_dotenv()
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        sys.exit("OPENROUTER_API_KEY is not set (environment or .env). "
                 "Get one at https://openrouter.ai/keys")

    models_arg = args.models or os.environ.get("LLM_COUNCIL_MODELS")
    models = [m.strip() for m in models_arg.split(",") if m.strip()] if models_arg else DEFAULT_MODELS
    chairman = args.chairman or os.environ.get("LLM_COUNCIL_CHAIRMAN") or DEFAULT_CHAIRMAN

    result = run_full_council(" ".join(args.question), models, chairman, api_key)
    if "error" in result:
        sys.exit(result["error"])

    if args.save:
        out_dir = Path(args.save)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / f"council-{time.strftime('%Y%m%d-%H%M%S')}.json"
        out_file.write_text(json.dumps(result, indent=2, ensure_ascii=False))
        print(f"[council] saved {out_file}", file=sys.stderr)

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print_report(result)


if __name__ == "__main__":
    main()
