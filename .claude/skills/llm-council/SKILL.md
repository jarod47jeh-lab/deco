---
name: llm-council
description: Ask a "council" of several LLMs the same question, have them anonymously peer-review and rank each other's answers, then have a Chairman model synthesize one final answer. Adapted from karpathy/llm-council. Use when the user says "ask the council", "llm council", "/llm-council", "conseil des LLM", or wants multiple models' opinions, a cross-model comparison, or a consensus answer on a hard question.
---

# LLM Council

A port of [karpathy/llm-council](https://github.com/karpathy/llm-council) (a FastAPI/React web app) into a Claude Code skill. The 3-stage process is the same as the original:

1. **Stage 1: First opinions.** Every council model answers the user's question on its own.
2. **Stage 2: Peer review.** Each model sees all the answers, anonymized as `Response A`, `Response B`, …, critiques them and ends with a `FINAL RANKING:` list. The rankings are aggregated by average position.
3. **Stage 3: Chairman.** The Chairman model reads every answer and every ranking, then writes one final answer.

Answer the user in their language (e.g. French if they wrote in French).

## Mode 1: real multi-provider council (OpenRouter)

Use this when `OPENROUTER_API_KEY` is set in the environment or in a `.env` file.

```bash
python3 .claude/skills/llm-council/scripts/council.py "the user's question"
# options:
#   --models openai/gpt-5.1,google/gemini-3-pro-preview,anthropic/claude-sonnet-4.5,x-ai/grok-4
#   --chairman google/gemini-3-pro-preview
#   --json            # machine-readable output
#   --save DIR        # also write the full transcript as JSON into DIR
```

The script uses only the Python standard library. You can also set the models with the `LLM_COUNCIL_MODELS` (comma-separated) and `LLM_COUNCIL_CHAIRMAN` environment variables.

After the run, show the user:
- the Chairman's final answer (in full),
- the aggregate ranking table (model, average rank, number of votes),
- a one- or two-line summary of where the models disagreed, if they did.

Offer the individual Stage 1 answers and the Stage 2 reviews on request. Don't dump them by default.

## Mode 2: Claude-only council (no API key)

If no OpenRouter key is available, tell the user in one line, then run the same process with subagents:

1. **Stage 1:** Spawn 3–4 `general-purpose` agents **in parallel**, each with the question and a different persona or lens, for example: rigorous domain expert, skeptical critic, pragmatic practitioner, creative contrarian. Use different `model` values (`opus`, `sonnet`, `haiku`) where possible so the answers really differ.
2. **Stage 2:** Label the answers `Response A..D` in random order and keep the mapping to yourself. Spawn one reviewer agent per council member with the **Stage 2 prompt** below. Parse each `FINAL RANKING:` and average the positions.
3. **Stage 3:** Act as the Chairman yourself, using the **Stage 3 prompt** below, and present the result the same way as Mode 1.

## Prompts (same as the original)

**Stage 2 (ranking):**
```
You are evaluating different responses to the following question:

Question: {question}

Here are the responses from different models (anonymized):

{Response A: ...}
{Response B: ...}

Your task:
1. First, evaluate each response individually. For each response, explain what it does well and what it does poorly.
2. Then, at the very end of your response, provide a final ranking.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line should be: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text or explanations in the ranking section
```

**Stage 3 (chairman):**
```
You are the Chairman of an LLM Council. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: {question}

STAGE 1 - Individual Responses: {model: response ...}
STAGE 2 - Peer Rankings: {model: evaluation ...}

Your task as Chairman is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question. Consider:
- The individual responses and their insights
- The peer rankings and what they reveal about response quality
- Any patterns of agreement or disagreement

Provide a clear, well-reasoned final answer that represents the council's collective wisdom:
```

## Notes
- OpenRouter calls cost money. A 4-model council makes 9 calls per question (4 + 4 + 1).
- Models that fail are skipped. The run continues as long as at least one model answers.
- Model IDs change often. If a call returns 404/400 for a model, check the current IDs at https://openrouter.ai/models and pass `--models`.
