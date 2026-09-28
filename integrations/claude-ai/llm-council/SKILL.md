---
name: llm-council
description: Conseil de plusieurs avis indépendants qui répondent, se critiquent anonymement et se classent, puis un président synthétise une décision (adapté de karpathy/llm-council). À utiliser AUTOMATIQUEMENT, sans attendre qu'on le demande, dès que l'utilisateur fait face à une décision importante, difficile ou à enjeux (réorganiser des tournées, trancher un litige client délicat, conflit ou recadrage dans l'équipe, arbitrage entre priorités, argumentaire pour la direction, choix d'organisation ou d'investissement). Aussi quand il dit « demande au conseil », « llm council », « avis multiples ». Ne pas utiliser pour les questions simples, factuelles ou de routine.
---

# Conseil LLM

Processus en 3 étapes, repris de [karpathy/llm-council](https://github.com/karpathy/llm-council) :

1. **Premiers avis** : plusieurs conseillers répondent chacun de leur côté.
2. **Évaluation croisée** : chaque conseiller critique les réponses anonymisées (`Réponse A`, `B`, …) et les classe ; on fait la moyenne des classements.
3. **Président** : une synthèse finale tient compte des réponses, des critiques et des désaccords.

Réponds toujours dans la langue de l'utilisateur.

## Déclenchement automatique

Quand une décision importante apparaît dans la conversation, lance le conseil **sans demander la permission**, en annonçant en une ligne : « Décision importante, je consulte le conseil. » Ne le lance pas plus d'une fois par décision. Si l'utilisateur dit « pas de conseil » ou « réponse rapide », réponds normalement.

## Règle de confidentialité (obligatoire)

Avant de soumettre la question au conseil, **anonymise-la** : pas de noms de clients, d'établissements, de chauffeurs ou de collègues, pas d'adresses, de numéros de commande ou de données issues de l'ERP. Remplace-les par des descriptions génériques (« un client CHR », « un chauffeur expérimenté », « une commande de 12 fûts »). Tu peux réintroduire les noms dans ta réponse finale à l'utilisateur.

## Mode par défaut : conseil interne (aucune clé, aucun coût)

C'est le mode utilisé en déclenchement automatique.

- **Si l'outil Agent (sous-agents) est disponible** : lance 4 sous-agents en parallèle, un par conseiller ci-dessous, puis un sous-agent évaluateur par conseiller avec le prompt d'évaluation. Tu es le président.
- **Sinon (claude.ai)** : rédige toi-même les 4 avis l'un après l'autre, en adoptant strictement chaque rôle et sans regarder les autres avis pendant la rédaction. Fais ensuite l'évaluation croisée depuis le point de vue de chaque rôle, puis la synthèse en tant que président. Précise à l'utilisateur que les avis viennent d'un même modèle jouant plusieurs rôles.

Les 4 conseillers :
1. **Le terrain** : pragmatique, pense faisabilité le jour même, horaires, camions, charge des chauffeurs.
2. **Le client** : pense satisfaction et fidélisation des clients, image de l'entreprise.
3. **Le sceptique** : cherche les risques, les coûts cachés, ce qui peut mal tourner, les précédents fâcheux.
4. **Le manager** : pense équipe, équité, communication, cohérence avec la hiérarchie et les règles internes.

## Mode OpenRouter (vrai conseil multi-modèles, payant)

Uniquement si l'utilisateur le demande explicitement (« vrai conseil », « conseil OpenRouter ») et que `OPENROUTER_API_KEY` est disponible avec un accès internet. Jamais en déclenchement automatique : chaque question coûte 9 appels payants et part chez 4 fournisseurs.

```bash
python3 scripts/council.py "question anonymisée"
# --models id1,id2,...  --chairman id  --json  --save DIR
```

Si le script ne peut pas joindre openrouter.ai, dis-le en une ligne et passe au mode par défaut.

## Format de la réponse finale

1. **Décision recommandée** : 2 à 4 phrases, directement actionnables.
2. **Classement du conseil** : petit tableau (conseiller, position moyenne).
3. **Points de désaccord** : 1 à 3 puces, seulement s'il y en a.
4. **Risque principal à surveiller** : une phrase.

Les avis individuels et les critiques complètes seulement sur demande.

## Prompt d'évaluation (étape 2)

```
Tu évalues plusieurs réponses à la question suivante :

Question : {question}

Réponses (anonymisées) :
Réponse A : ...
Réponse B : ...

1. Évalue chaque réponse : ce qu'elle fait bien, ce qu'elle fait mal.
2. Termine par un classement, EXACTEMENT dans ce format :
FINAL RANKING:
1. Réponse C
2. Réponse A
...
Aucun autre texte dans la section de classement.
```

## Prompt du président (étape 3)

```
Tu es le président d'un conseil. Plusieurs conseillers ont répondu à une question puis se sont classés mutuellement.

Question : {question}
ÉTAPE 1 - Réponses : ...
ÉTAPE 2 - Classements : ...

Synthétise en une réponse unique, claire et justifiée, en tenant compte des idées de chaque réponse, de ce que révèlent les classements et des points d'accord ou de désaccord.
```
