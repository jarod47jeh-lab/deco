// Les activités. Chaque manche construit son DOM et appelle done(ok) quand elle est finie.

import { el, clear, shuffle, sample, pick, wait } from './dom.js';
import * as audio from './audio.js';
import { CHEERS, RETRIES } from './data.js';

const FEEDBACK_OK = 700;
const FEEDBACK_KO = 1600;

function feedbackBar() {
  return el('div', { class: 'feedback', id: 'feedback' });
}

async function reveal(node, ok, correctText) {
  const bar = node.querySelector('#feedback');
  if (ok) {
    audio.sfx.good();
    bar.className = 'feedback show ok';
    bar.textContent = pick(CHEERS);
    await wait(FEEDBACK_OK);
  } else {
    audio.sfx.bad();
    bar.className = 'feedback show ko';
    bar.textContent = correctText ? `${pick(RETRIES)} → ${correctText}` : pick(RETRIES);
    await wait(FEEDBACK_KO);
  }
}

function lock(node) {
  node.querySelectorAll('button').forEach((b) => (b.disabled = true));
}

const speakerBtn = (item, cls = 'speaker') =>
  el('button', {
    class: cls,
    'aria-label': 'Écouter',
    onclick: (e) => {
      e.stopPropagation();
      audio.playItem(item);
    },
  }, '🔊');

/**
 * Choix des distracteurs : dans la même unité en priorité.
 * On écarte ceux qui partagent l'emoji ou la traduction de la bonne réponse,
 * sinon la manche devient impossible à trancher (🐘 « éléphant » et 🐘 « grand »).
 */
function distractors(item, pool, n) {
  const usable = pool.filter((x) => x.id !== item.id && x.emoji !== item.emoji && x.fr !== item.fr);
  const sameUnit = usable.filter((x) => x.unit === item.unit);
  const others = usable.filter((x) => x.unit !== item.unit);
  // Les deux ensembles sont disjoints : pas de doublon possible dans les choix.
  const chosen = sample(sameUnit, n);
  if (chosen.length < n) chosen.push(...sample(others, n - chosen.length));
  return chosen.slice(0, n);
}

// --- Manche 1 : j'écoute, je touche l'image --------------------------------

export function roundListen(item, pool, cfg, done) {
  const opts = shuffle([item, ...distractors(item, pool, cfg.choices - 1)]);
  const node = el('div', { class: 'round' }, [
    el('p', { class: 'instruction' }, 'Écoute et touche la bonne image'),
    el('button', {
      class: 'big-speaker',
      onclick: () => audio.playItem(item),
    }, '🔊'),
    el('button', { class: 'link-btn', onclick: () => audio.playItem(item, { slow: true }) }, '🐢 plus lentement'),
    el('div', { class: 'grid cards-' + opts.length },
      opts.map((o) =>
        el('button', {
          class: 'card pick',
          onclick: async (e) => {
            const ok = o.id === item.id;
            lock(node);
            e.currentTarget.classList.add(ok ? 'ok' : 'ko');
            if (!ok) node.querySelectorAll('.card.pick')[opts.indexOf(item)].classList.add('ok');
            await reveal(node, ok, cfg.showFrench ? item.fr : null);
            done(ok);
          },
        }, [
          el('span', { class: 'emoji' }, o.emoji),
          cfg.showFrench ? el('span', { class: 'card-label' }, o.fr) : null,
        ])
      )
    ),
    feedbackBar(),
  ]);
  setTimeout(() => audio.playItem(item), 300);
  return node;
}

// --- Manche 2 : je vois l'image, je choisis le bon son ---------------------

export function roundPickAudio(item, pool, cfg, done) {
  const opts = shuffle([item, ...distractors(item, pool, cfg.choices - 1)]);
  const node = el('div', { class: 'round' }, [
    el('p', { class: 'instruction' }, 'Quel son va avec l’image ?'),
    el('div', { class: 'prompt-card' }, [
      el('span', { class: 'emoji xl' }, item.emoji),
      cfg.showFrench ? el('span', { class: 'prompt-fr' }, item.fr) : null,
    ]),
    el('div', { class: 'sound-row' },
      opts.map((o, i) =>
        el('button', {
          class: 'sound-btn',
          onclick: async (e) => {
            const btn = e.currentTarget;
            if (!btn.dataset.heard) {
              btn.dataset.heard = '1';
              btn.classList.add('heard');
              audio.playItem(o);
              return; // premier clic : on écoute
            }
            const ok = o.id === item.id;
            lock(node);
            btn.classList.add(ok ? 'ok' : 'ko');
            await reveal(node, ok, cfg.showLatin ? item.dr : null);
            done(ok);
          },
        }, [el('span', { class: 'emoji' }, '🔊'), el('small', {}, 'son ' + (i + 1))])
      )
    ),
    el('p', { class: 'hint' }, 'Touche une fois pour écouter, deux fois pour valider.'),
    feedbackBar(),
  ]);
  return node;
}

// --- Manche 3 : français → darija ------------------------------------------

export function roundQuizFr(item, pool, cfg, done) {
  const opts = shuffle([item, ...distractors(item, pool, cfg.choices - 1)]);
  const node = el('div', { class: 'round' }, [
    el('p', { class: 'instruction' }, 'Comment on dit ça en darija ?'),
    el('div', { class: 'prompt-card' }, [
      el('span', { class: 'emoji xl' }, item.emoji),
      el('span', { class: 'prompt-fr big' }, item.fr),
    ]),
    el('div', { class: 'stack' },
      opts.map((o) =>
        el('button', {
          class: 'answer',
          onclick: async (e) => {
            const ok = o.id === item.id;
            lock(node);
            e.currentTarget.classList.add(ok ? 'ok' : 'ko');
            audio.playItem(item);
            await reveal(node, ok, item.dr);
            done(ok);
          },
        }, [
          el('span', { class: 'dr' }, o.dr),
          cfg.showArabic && o.ar ? el('span', { class: 'ar' }, o.ar) : null,
        ])
      )
    ),
    feedbackBar(),
  ]);
  return node;
}

// --- Manche 4 : darija → français ------------------------------------------

export function roundQuizDr(item, pool, cfg, done) {
  const opts = shuffle([item, ...distractors(item, pool, cfg.choices - 1)]);
  const node = el('div', { class: 'round' }, [
    el('p', { class: 'instruction' }, 'Qu’est-ce que ça veut dire ?'),
    el('div', { class: 'prompt-card' }, [
      el('span', { class: 'prompt-dr' }, item.dr),
      cfg.showArabic && item.ar ? el('span', { class: 'ar big' }, item.ar) : null,
      speakerBtn(item, 'speaker inline'),
    ]),
    el('div', { class: 'stack' },
      opts.map((o) =>
        el('button', {
          class: 'answer',
          onclick: async (e) => {
            const ok = o.id === item.id;
            lock(node);
            e.currentTarget.classList.add(ok ? 'ok' : 'ko');
            await reveal(node, ok, item.fr);
            done(ok);
          },
        }, [el('span', { class: 'emoji sm' }, o.emoji), el('span', {}, o.fr)])
      )
    ),
    feedbackBar(),
  ]);
  setTimeout(() => audio.playItem(item), 300);
  return node;
}

// --- Manche 5 : remets la phrase dans l'ordre ------------------------------

export function roundOrder(item, pool, cfg, done) {
  const words = item.dr.split(/\s+/);
  const slot = el('div', { class: 'slot' });
  const bank = el('div', { class: 'bank' });
  const placed = [];

  const check = async () => {
    const ok = placed.join(' ').toLowerCase() === item.dr.toLowerCase();
    lock(node);
    slot.classList.add(ok ? 'ok' : 'ko');
    audio.playItem(item);
    await reveal(node, ok, item.dr);
    done(ok);
  };

  const render = () => {
    clear(slot);
    placed.forEach((word, i) =>
      slot.append(el('button', {
        class: 'tile placed',
        onclick: () => {
          placed.splice(i, 1);
          render();
        },
      }, word))
    );
    if (placed.length === words.length) setTimeout(check, 250);
  };

  shuffle(words).forEach((word) =>
    bank.append(el('button', {
      class: 'tile',
      onclick: (e) => {
        e.currentTarget.remove();
        placed.push(word);
        audio.sfx.tap();
        render();
      },
    }, word))
  );

  const node = el('div', { class: 'round' }, [
    el('p', { class: 'instruction' }, 'Remets la phrase dans l’ordre'),
    el('div', { class: 'prompt-card' }, [
      el('span', { class: 'emoji xl' }, item.emoji),
      el('span', { class: 'prompt-fr big' }, item.fr),
    ]),
    slot,
    bank,
    feedbackBar(),
  ]);
  return node;
}

// --- Manche 6 : écris le mot ------------------------------------------------

const normalize = (s) =>
  s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function roundType(item, pool, cfg, done) {
  const input = el('input', {
    class: 'text-input',
    type: 'text',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    placeholder: 'écris en lettres latines…',
  });
  const submit = async () => {
    const ok = normalize(input.value) === normalize(item.dr);
    lock(node);
    input.disabled = true;
    input.classList.add(ok ? 'ok' : 'ko');
    audio.playItem(item);
    await reveal(node, ok, item.dr);
    done(ok);
  };
  const node = el('div', { class: 'round' }, [
    el('p', { class: 'instruction' }, 'Écris-le en darija'),
    el('div', { class: 'prompt-card' }, [
      el('span', { class: 'emoji xl' }, item.emoji),
      el('span', { class: 'prompt-fr big' }, item.fr),
    ]),
    input,
    el('button', { class: 'primary wide', onclick: submit }, 'Valider'),
    el('button', { class: 'link-btn', onclick: () => audio.playItem(item) }, '🔊 entendre'),
    feedbackBar(),
  ]);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  setTimeout(() => input.focus(), 100);
  return node;
}

export const ROUNDS = {
  listen: roundListen,
  pickAudio: roundPickAudio,
  quizFr: roundQuizFr,
  quizDr: roundQuizDr,
  order: roundOrder,
  type: roundType,
};

/** Choisit un type de manche compatible avec l'item et le mode. */
export function chooseRound(item, cfg, avoid) {
  let kinds = cfg.rounds.filter((k) => k !== avoid);
  if (!kinds.length) kinds = cfg.rounds;
  kinds = kinds.filter((k) => (k === 'order' ? item.dr.split(/\s+/).length >= 3 : true));
  if (!kinds.length) kinds = ['quizFr'];
  return pick(kinds);
}

// --- Jeu de paires (hors session) ------------------------------------------

export function memoryBoard(items, cfg, onWin) {
  const pairs = shuffle(
    items.flatMap((it) => [
      { key: it.id, face: 'emoji', item: it },
      { key: it.id, face: cfg.showLatin ? 'text' : 'sound', item: it },
    ])
  );
  let open = [];
  let found = 0;
  let moves = 0;

  const board = el('div', { class: 'memory' });
  pairs.forEach((c) => {
    const inner = el('span', { class: 'memory-face' },
      c.face === 'emoji' ? c.item.emoji : c.face === 'text' ? c.item.dr : '🔊'
    );
    const card = el('button', { class: 'memory-card' }, [el('span', { class: 'memory-back' }, '❔'), inner]);
    card.addEventListener('click', async () => {
      if (card.classList.contains('flipped') || open.length === 2) return;
      card.classList.add('flipped');
      audio.playItem(c.item);
      open.push({ c, card });
      if (open.length < 2) return;
      moves++;
      const [a, b] = open;
      if (a.c.key === b.c.key && a.card !== b.card) {
        found++;
        audio.sfx.good();
        a.card.classList.add('matched');
        b.card.classList.add('matched');
        open = [];
        if (found === items.length) {
          audio.sfx.win();
          setTimeout(() => onWin(moves), 500);
        }
      } else {
        audio.sfx.bad();
        await wait(900);
        a.card.classList.remove('flipped');
        b.card.classList.remove('flipped');
        open = [];
      }
    });
    board.append(card);
  });
  return board;
}
