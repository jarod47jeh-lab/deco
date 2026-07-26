# Yallah Darija ! 🇲🇦

Une application **locale** et **hors ligne** pour apprendre le darija marocain en famille,
à partir de zéro, sous forme de jeux. Pensée pour trois apprentis à la fois :
une enfant de 5 ans qui ne lit pas encore, un enfant de 8 ans, et une adulte.

Pas de compte, pas de serveur, pas de connexion : tout tient dans un dossier de
fichiers que le téléphone garde en mémoire.

---

## Mettre l'app entre les mains de la famille

### La contrainte à connaître

Les navigateurs refusent le micro et le mode hors ligne aux pages qui ne sont pas
servies en **https://** (seule exception : `localhost`, sur la machine elle-même).

Concrètement, si vous ouvrez l'app sur un téléphone via `http://IP-DU-PC:8000`, elle
s'affiche et les jeux tournent, mais **le Studio voix ne peut rien enregistrer et
l'app ne s'installe pas hors ligne**. L'app le dit maintenant elle-même : un bandeau
rouge apparaît, et l'espace parents affiche l'état (`Hors ligne : non`, `Micro : bloqué`).

Il y a donc deux usages, et un seul convient à un téléphone.

### 1. Sur un téléphone : la version en ligne (recommandé)

Le dépôt se publie tout seul sur GitHub Pages, en HTTPS, gratuitement.

**À faire une fois, dans les réglages du dépôt.** C'est la seule étape qui vous
revient : le jeton dont dispose le workflow a le droit de publier, mais pas de créer
le site — j'ai essayé, GitHub refuse (« Resource not accessible by integration »).
Tant que ce n'est pas fait, la mise en ligne s'arrête avec un message qui rappelle
quoi cliquer.

1. GitHub → le dépôt → **Settings** → **Pages**
2. **Source** : choisir **GitHub Actions**
3. Aller dans l'onglet **Actions** → workflow **« Mise en ligne (GitHub Pages) »** →
   **Run workflow** (ou pousser un commit, il se déclenche seul)

L'adresse est alors `https://<votre-compte>.github.io/deco/`. Ouvrez-la sur chaque
téléphone puis :

- **Android / Chrome** : menu ⋮ → « Ajouter à l'écran d'accueil »
- **iPhone / Safari** : bouton Partager → « Sur l'écran d'accueil »

À partir de là, l'app s'ouvre en plein écran, fonctionne **sans réseau**, et le Studio
voix peut enregistrer. Rien d'autre à maintenir : votre ordinateur peut rester éteint.

Chaque mise en ligne estampille la version avec le numéro du commit, visible dans
l'espace parents — pratique pour savoir ce qui tourne sur quel téléphone. Le cache
change avec elle, donc les téléphones récupèrent la nouveauté à l'ouverture suivante.

### 2. Sur l'ordinateur : pour développer

```bash
python3 -m http.server 8000
```

Puis <http://localhost:8000>. Sur `localhost`, tout fonctionne, micro compris.

### Ce qui reste privé

La page publiée ne contient que l'app : le vocabulaire, les images, le code. **Aucune
donnée d'apprentissage ne part sur Internet** — les profils, la progression et les
voix enregistrées restent dans le navigateur de chaque téléphone. La seule exception
est l'écoute automatique facultative, désactivée par défaut, décrite plus bas.

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

### La séance du jour

L'accueil s'ouvre sur un seul bouton : **🌟 Ma séance du jour**. Il compose lui-même le
mélange — d'abord les mots dus à la révision, les plus en retard en tête, puis quelques
mots neufs pris dans le thème déjà entamé plutôt que dans un thème au hasard. La carte
annonce ce qu'elle contient (« 2 à revoir · 2 nouveaux · Salutations ») et passe au vert
quand la séance du jour est faite.

C'est ce qui rend l'app utilisable seule par une enfant de 5 ans : elle n'a pas à
choisir un thème, elle appuie sur l'étoile. Un lien discret « Tout réviser » reste
disponible quand le retard dépasse une séance.

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

### Écouter en boucle

Un mode **📻 Écouter** fait défiler les mots tout seuls : le darija, une pause, la
traduction française, puis le mot suivant, en boucle. On pose le téléphone — c'est
fait pour la voiture, le bain ou le coucher. On choisit la source (tout mélangé, les
mots à réviser, ou un thème), et deux bascules règlent l'écoute : avec ou sans le
français, à vitesse normale ou lente. L'écran reste allumé quand le navigateur le
permet.

Cette écoute passive ne touche pas à la révision espacée : entendre un mot n'est pas
s'en souvenir, et fausser la boîte de Leitner rendrait les révisions inutiles.

### Les histoires

Cinq mini-histoires illustrées de huit scènes — le matin, le marché, le chat perdu,
l'anniversaire, la mer — construites presque uniquement avec le vocabulaire des thèmes.
C'est l'étape d'après les mots isolés : on suit une scène et on comprend le sens
général sans traduire mot à mot.

Chaque histoire se termine par trois questions de compréhension à réponses illustrées,
et **la question est lue à voix haute en français** : la plus jeune peut y répondre sans
savoir lire. La liste indique, pour chaque histoire, combien de ses mots l'apprenant a
déjà rencontrés.

Les scènes ont leur propre identifiant : elles apparaissent dans le studio comme des
thèmes à part entière, donc un locuteur natif peut aussi enregistrer les histoires.

### Le défi famille

Dès qu'il y a deux profils, l'accueil propose un **défi** : plusieurs personnes
s'affrontent sur le même téléphone, chacune son tour, cinq tours chacune.

Le problème d'un duel entre 5 ans et 41 ans, c'est qu'il n'y a aucun suspense. La
solution retenue : **chacun joue dans son propre mode**. Sur le même thème, la plus
jeune reçoit des manches en images et en son, l'aînée doit reconnaître le mot écrit,
l'adulte doit l'écrire. Les mots sont tirés du même sac mais chaque joueur a les
siens, pour que personne ne voie passer la réponse du précédent. Si une joueuse en
mode tout-petit participe, seuls les thèmes concrets sont proposés.

Entre deux tours, un écran « À toi, Lina ! » laisse le temps de passer le téléphone.
À la fin, un podium — les ex æquo partagent la médaille. Les points et les mots vus
sont crédités à chaque profil : un défi compte comme une vraie séance de révision.

---

## 🎙️ Le point important : la prononciation

**Aucune synthèse vocale ne parle darija.** Les téléphones ont parfois une voix arabe
(`ar-MA`, sinon `ar`) : l'app s'en sert par défaut, mais elle lit de l'arabe standard,
avec un accent qui n'est pas celui du Maroc. C'est un dépannage, pas un modèle.

D'où le **Studio voix** (bouton 🎙️ sur l'accueil) : quelqu'un qui parle darija enregistre
les mots une fois, directement dans l'app. Les enregistrements sont stockés sur l'appareil
(IndexedDB) et **remplacent automatiquement la synthèse partout** : dans les leçons, dans
les jeux, dans le jeu de paires.

### Comment mener une séance d'enregistrement

Le studio s'ouvre sur l'ordre conseillé, phrases d'enfants en tête :

1. 🧸 Ce que je dis (25) — 2. ✨ Les mots magiques (17) — 3. 👋 Salutations (14) —
4. 👨‍👩‍👧 La famille (15) — 5. 🍞 Manger & boire (27) — 6. 🎉 C'est la fête ! (11)

Le bouton **« Enregistrer à la chaîne »** enchaîne les entrées d'un thème sans quitter
l'écran : la phrase s'affiche en français, en lettres latines et en arabe, on touche le
rond rouge, on la dit, on touche pour arrêter — l'app sauvegarde, rejoue, et passe à la
suivante toute seule. Chaque thème affiche sa progression (`3 / 25 enregistrés`), donc une
séance peut se faire en plusieurs fois.

Les 25 phrases du thème 1 prennent une dizaine de minutes et changent tout : ce sont
celles que les enfants entendront le plus. Passez le téléphone à la personne, elle n'a
besoin d'aucune explication — la consigne est à l'écran.

### N'enregistrer qu'une fois pour toute la famille

Le studio exporte les voix dans une archive `darija-voix-AAAA-MM-JJ.zip` (bouton
**Exporter**). Envoyez-la aux autres téléphones par le moyen habituel — message, mail,
clé USB — et importez-la depuis leur studio : les voix redeviennent immédiatement
actives dans tous les jeux.

L'archive contient les fichiers audio tels quels, dans un dossier `voix/`, plus un
`manifest.json` qui relie chaque fichier à son mot. C'est un ZIP standard : on peut
l'ouvrir sur un ordinateur et écouter les enregistrements directement.

Si des voix existent déjà sur le téléphone qui importe, l'app demande quoi faire :
remplacer par celles de l'archive, ou garder les siennes et n'ajouter que les
nouvelles. Une archive abîmée ou un fichier qui n'est pas un ZIP sont refusés avec un
message clair, sans rien toucher.

### S'entraîner à prononcer, et l'écoute automatique

Chaque thème a un bouton **🎤 Prononcer**. L'écran enchaîne les mots : on écoute le
modèle (au besoin ralenti), on s'enregistre, puis on réécoute **« les deux à la
suite »** — le modèle, une pause, sa propre voix. C'est la méthode des laboratoires de
langue, elle marche hors ligne et sur tous les appareils, et c'est l'oreille qui juge.
Les essais restent en mémoire le temps de la session : ils ne touchent jamais aux voix
de référence du studio.

Une **reconnaissance vocale** est disponible en plus, mais **désactivée par défaut**,
et il faut l'activer dans l'espace parents. Trois raisons à cette prudence :

- elle n'est pas locale — le navigateur envoie la voix à un service en ligne (Google
  pour Chrome), donc la voix des enfants sort du téléphone ;
- elle a besoin d'une connexion, contrairement au reste de l'app ;
- **aucun moteur ne connaît le darija.** « ar-MA » reste un modèle d'arabe standard :
  il refuse régulièrement une prononciation marocaine correcte.

Quand elle est activée, l'app affiche ce que l'appareil a cru entendre en arabe, une
appréciation calculée par similarité de graphies, et un rappel qu'elle se trompe
souvent. Elle ne dit jamais « faux » — dire « faux » à un débutant qui a bien prononcé
est le plus sûr moyen de le décourager. Si le moteur échoue (pas de réseau, navigateur
sans reconnaissance), l'écran l'annonce et la comparaison à l'oreille continue de
fonctionner.

---

## Les données

Tout reste sur l'appareil : `localStorage` pour la progression, `IndexedDB` pour les
voix. Rien ne sort du téléphone. L'espace parents permet d'exporter la progression en
JSON et de la réimporter (utile pour passer d'un appareil à l'autre).

---

## Structure du projet

```
.github/workflows/      mise en ligne automatique sur GitHub Pages
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
  zip.js                lecture et écriture d'archives, pour le transfert des voix
  speech.js             reconnaissance vocale facultative et comparaison de graphies
  stories.js            les mini-histoires et leurs questions
  version.js            numéro de version, estampillé à la mise en ligne
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

Poussez ensuite sur la branche : la mise en ligne se refait toute seule. Sur les
téléphones, la nouveauté apparaît à la **deuxième** ouverture — la première la
récupère en arrière-plan.

## Pistes pour la suite

- D'autres histoires, et des histoires plus longues à mesure que le vocabulaire grandit
