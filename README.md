# Yallah Darija ! 🇲🇦

Une application **locale** et **hors ligne** pour apprendre le darija marocain en famille,
à partir de zéro, sous forme de jeux. Pensée pour trois apprentis à la fois :
une enfant de 5 ans qui ne lit pas encore, un enfant de 8 ans, et une adulte.

Pas de compte, pas de serveur, pas de connexion : tout tient dans un dossier de
fichiers que le téléphone garde en mémoire.

---

## Démarrer en 2 minutes

L'app est une PWA (une page web installable). Il faut juste un petit serveur local,
parce que les navigateurs refusent de charger des modules JavaScript en `file://`.

```bash
# depuis le dossier du projet
python3 -m http.server 8000
```

Puis :

- **sur l'ordinateur** : ouvrir <http://localhost:8000>
- **sur le téléphone** (même Wi-Fi) : ouvrir `http://IP-DE-L-ORDI:8000`
  (l'IP se trouve avec `ip addr` sous Linux, `ipconfig` sous Windows)

### L'installer sur le téléphone

- **Android / Chrome** : menu ⋮ → « Ajouter à l'écran d'accueil »
- **iPhone / Safari** : bouton Partager → « Sur l'écran d'accueil »

Une fois installée, elle s'ouvre en plein écran comme une vraie app, **et elle
fonctionne sans réseau** : le service worker garde tout en cache. L'ordinateur
n'a besoin d'être allumé que pour la toute première ouverture (et pour les mises à jour).

---

## Comment c'est pensé

### Trois modes, un contenu commun

| Mode | Âge visé | Ce qui s'affiche | Activités |
|---|---|---|---|
| **Tout-petit** | 4-6 ans | images et sons uniquement, aucun texte à lire | écoute-et-touche, choisis-le-bon-son, paires |
| **Junior** | 7-12 ans | + le mot en lettres latines, la traduction | + quiz dans les deux sens |
| **Adulte** | ado / adulte | + l'écriture arabe, les notes de grammaire | + remets la phrase en ordre, écris le mot |

Le mode se déduit de l'âge à la création du profil, et reste modifiable dans
l'espace parents. Chaque personne a son profil, sa progression et sa série de jours.

Pour la plus jeune : **aucune consigne n'a besoin d'être lue**. Toucher une consigne
la fait lire à voix haute en français, les réponses sont des images, et le mode
« tout-petit » n'affiche que les thèmes concrets (animaux, nourriture, couleurs, famille…).

### Le contenu

321 mots et phrases, répartis en 21 thèmes : salutations, chiffres, couleurs,
grand ou petit, famille, animaux, manger & boire, le corps, la maison, les habits,
école & jeux, dehors & la nature, on sort !, où ça ?, le temps, les verbes utiles,
poser des questions, les mots magiques, ce que je dis, c'est la fête !, les phrases
du quotidien.

Deux thèmes visent directement les enfants : **« Ce que je dis »** rassemble 25 phrases
qu'ils peuvent réellement prononcer à table ou dans la cour (« c'est mon tour »,
« attends-moi », « aide-moi s'il te plaît », « j'ai mal ici », « je t'aime maman »), et
**« C'est la fête ! »** couvre anniversaires et Aïd. 17 des 21 thèmes sont accessibles
en mode tout-petit.

Chaque entrée a : le français, le darija en lettres latines (« arabizi » : `3` = ع,
`7` = ح, `9` = ق), l'écriture arabe, une image, et parfois une note (féminin, variante…).
Tout est dans `js/data.js` — un seul fichier à éditer pour ajouter du vocabulaire.

### La mémorisation

Une boîte de Leitner tourne en arrière-plan : chaque mot réussi part plus loin dans le
temps (1, 2, 4, 8, 16, 32 jours), chaque mot raté revient vite. L'accueil propose
« Réviser » quand des mots sont dus. C'est ce qui fait la différence entre reconnaître
un mot et le retenir.

### Le côté ludique

Étoiles par thème (1 à 3 selon la réussite), points, série de jours consécutifs,
badges, une mascotte chamelle qui encourage en darija, des bruitages, et un jeu
de paires par thème. Les sessions sont courtes exprès : 4 manches pour la petite,
6 pour le moyen, 8 pour l'adulte.

---

## 🎙️ Le point important : la prononciation

**Aucune synthèse vocale ne parle darija.** Les téléphones ont parfois une voix arabe
(`ar-MA`, sinon `ar`) : l'app s'en sert par défaut, mais elle lit de l'arabe standard,
avec un accent qui n'est pas celui du Maroc. C'est un dépannage, pas un modèle.

D'où le **Studio voix** (bouton 🎙️ sur l'accueil) : quelqu'un qui parle darija enregistre
les mots une fois, directement dans l'app, thème par thème. Les enregistrements sont
stockés sur l'appareil (IndexedDB) et **remplacent automatiquement la synthèse partout** :
dans les leçons, dans les jeux, dans le jeu de paires.

C'est la première chose à faire si vous connaissez un locuteur natif. Une trentaine de
mots suffisent pour transformer l'expérience — commencez par les salutations et les
mots magiques.

---

## Les données

Tout reste sur l'appareil : `localStorage` pour la progression, `IndexedDB` pour les
voix. Rien ne sort du téléphone. L'espace parents permet d'exporter la progression en
JSON et de la réimporter (utile pour passer d'un appareil à l'autre).

---

## Structure du projet

```
index.html              coquille de l'app
styles.css              tout le style (mobile d'abord, thème clair et sombre)
manifest.webmanifest    métadonnées d'installation
sw.js                   service worker (fonctionnement hors ligne)
js/
  app.js                navigation et écrans
  data.js               ← le vocabulaire, à enrichir
  store.js              profils, progression, boîte de Leitner
  audio.js              voix enregistrées, synthèse, bruitages
  games.js              les six types de manches + le jeu de paires
  dom.js                helpers
icons/                  icônes de l'app
tools/make_icons.py     régénère les PNG à partir du SVG
```

## Ajouter du vocabulaire

Dans `js/data.js`, chaque entrée suit la forme
`w(id, français, darija, arabe, emoji, note?)` :

```js
w('eat28', 'Des dattes', 'Tmer', 'تمر', '🌴'),
```

Un `id` unique suffit ; le reste (jeux, révision, statistiques) s'adapte tout seul.
Pour créer un thème, copiez un bloc d'unité existant : `kid: true` le rend visible
en mode tout-petit, `notes: [...]` ajoute les explications de grammaire vues par les adultes.

## Pistes pour la suite

- Enregistrer les phrases complètes, pas seulement les mots isolés
- Un mode « défi famille » : deux profils s'affrontent sur le même téléphone
- Reconnaissance vocale pour comparer sa prononciation à l'enregistrement
- Des mini-histoires illustrées une fois les 100 premiers mots acquis
