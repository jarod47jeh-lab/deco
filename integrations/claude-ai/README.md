# Skill llm-council pour claude.ai

Version du skill `llm-council` adaptée au poste de responsable d'expédition, à importer dans claude.ai. Elle diffère de `.claude/skills/llm-council/` (version Claude Code) :

- se déclenche automatiquement sur les décisions importantes ;
- anonymise la question avant de la soumettre au conseil ;
- mode par défaut interne et gratuit (4 conseillers : terrain, client, sceptique, manager) ;
- OpenRouter uniquement sur demande explicite.

Elle est rangée hors de `.claude/skills/` pour ne pas entrer en conflit avec la version Claude Code, qui porte le même nom.

## Construire le .zip

Depuis la racine du dépôt :

```bash
rm -rf /tmp/llm-council && mkdir -p /tmp/llm-council/scripts
cp integrations/claude-ai/llm-council/SKILL.md /tmp/llm-council/
cp .claude/skills/llm-council/scripts/council.py /tmp/llm-council/scripts/
(cd /tmp && rm -f llm-council.zip && zip -r llm-council.zip llm-council)
```

## Installer

1. claude.ai → Paramètres → Capacités → Skills → importer `llm-council.zip`, puis l'activer.
2. Coller le contenu de `ligne-crouzil-expedition.md` à la fin du `SKILL.md` du skill **crouzil-expedition**.
