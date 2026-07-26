// Chef d'orchestre : navigation entre les écrans.

import { UNITS, UNIT_BY_ID, ALL_ITEMS, SOUNDS, RECORDING_PRIORITY } from './data.js';
import * as store from './store.js';
import * as audio from './audio.js';
import { ROUNDS, chooseRound, memoryBoard } from './games.js';
import { el, clear, shuffle, sample, pick } from './dom.js';

const app = document.getElementById('app');
const stack = [];

function go(view, params = {}, { replace = false } = {}) {
  if (!replace) stack.push({ view, params });
  else stack[stack.length - 1] = { view, params };
  render();
}

function back() {
  if (stack.length > 1) stack.pop();
  render();
}

function reset(view, params = {}) {
  stack.length = 0;
  stack.push({ view, params });
  render();
}

const VIEWS = {};

function render() {
  const cur = stack[stack.length - 1];
  clear(app);
  window.scrollTo(0, 0);
  app.append(VIEWS[cur.view](cur.params));
}

// --- Éléments communs ------------------------------------------------------

function header(title, { showBack = true, right = null } = {}) {
  return el('header', { class: 'topbar' }, [
    showBack ? el('button', { class: 'icon-btn', onclick: back, 'aria-label': 'Retour' }, '←') : el('span', { class: 'icon-btn ghost' }, ''),
    el('h1', {}, title),
    right || el('span', { class: 'icon-btn ghost' }, ''),
  ]);
}

function profileChip() {
  const p = store.active();
  if (!p) return null;
  return el('button', {
    class: 'chip',
    onclick: () => go('parents'),
  }, [
    el('span', { class: 'chip-avatar' }, p.avatar),
    el('span', { class: 'chip-stats' }, [
      el('b', {}, p.name),
      el('small', {}, `⭐ ${store.totalStars(p)} · 🔥 ${p.streak.count} · ${p.xp} pts`),
    ]),
  ]);
}

/** Déclenche un téléchargement : l'ancrage doit être dans le document. */
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 10000);
}

function mascot(text) {
  return el('div', { class: 'mascot' }, [
    el('span', { class: 'mascot-face' }, '🐪'),
    el('p', {}, text),
  ]);
}

// --- Écran : profils --------------------------------------------------------

VIEWS.profiles = () => {
  const list = store.profiles();
  const wrap = el('div', { class: 'screen' }, [
    el('div', { class: 'hero' }, [
      el('span', { class: 'hero-emoji' }, '🇲🇦'),
      el('h1', {}, 'Yallah Darija !'),
      el('p', {}, 'On apprend le darija marocain en s’amusant.'),
    ]),
  ]);

  if (list.length) {
    wrap.append(el('h2', { class: 'section' }, 'Qui joue ?'));
    wrap.append(
      el('div', { class: 'profile-row' },
        list.map((p) =>
          el('button', {
            class: 'profile-card',
            onclick: () => {
              store.setActive(p.id);
              reset('home');
            },
          }, [
            el('span', { class: 'avatar' }, p.avatar),
            el('b', {}, p.name),
            el('small', {}, `${store.MODES[p.mode].label} · ⭐ ${store.totalStars(p)}`),
          ])
        )
      )
    );
  } else {
    wrap.append(mascot('Salam ! Crée un profil pour commencer.'));
  }

  wrap.append(el('button', { class: 'primary wide', onclick: () => go('newProfile') }, '➕ Nouveau profil'));
  wrap.append(el('button', { class: 'link-btn', onclick: () => go('guide') }, '📖 Guide de prononciation'));
  return wrap;
};

VIEWS.newProfile = () => {
  const name = el('input', { class: 'text-input', type: 'text', placeholder: 'Prénom' });
  const age = el('input', { class: 'text-input', type: 'number', min: '3', max: '99', value: '8' });
  let avatar = store.AVATARS[0];
  let modeId = 'junior';

  const modeRow = el('div', { class: 'stack' });
  const drawModes = () => {
    clear(modeRow);
    Object.values(store.MODES).forEach((m) =>
      modeRow.append(el('button', {
        class: 'answer col' + (m.id === modeId ? ' selected' : ''),
        onclick: () => { modeId = m.id; drawModes(); },
      }, [el('b', {}, m.label), el('small', {}, m.hint)]))
    );
  };
  drawModes();

  age.addEventListener('input', () => {
    modeId = store.modeForAge(Number(age.value));
    drawModes();
  });

  const avatarRow = el('div', { class: 'avatar-row' });
  const drawAvatars = () => {
    clear(avatarRow);
    store.AVATARS.forEach((a) =>
      avatarRow.append(el('button', {
        class: 'avatar-pick' + (a === avatar ? ' selected' : ''),
        onclick: () => { avatar = a; drawAvatars(); },
      }, a))
    );
  };
  drawAvatars();

  return el('div', { class: 'screen' }, [
    header('Nouveau profil'),
    el('label', { class: 'field' }, ['Prénom', name]),
    el('label', { class: 'field' }, ['Âge', age]),
    el('p', { class: 'section' }, 'Avatar'),
    avatarRow,
    el('p', { class: 'section' }, 'Niveau'),
    modeRow,
    el('button', {
      class: 'primary wide',
      onclick: () => {
        store.addProfile({ name: name.value, age: age.value, avatar, mode: modeId });
        reset('home');
      },
    }, 'C’est parti !'),
  ]);
};

// --- Écran : accueil --------------------------------------------------------

VIEWS.home = () => {
  const p = store.active();
  if (!p) return VIEWS.profiles();
  const cfg = store.mode(p);
  const due = store.dueItems(ALL_ITEMS, p);
  const units = UNITS.filter((u) => (cfg.id === 'petit' ? u.kid : true));

  const wrap = el('div', { class: 'screen' }, [
    el('header', { class: 'topbar home' }, [
      profileChip(),
      el('button', { class: 'icon-btn', onclick: () => reset('profiles'), 'aria-label': 'Changer de profil' }, '🔄'),
    ]),
    mascot(
      due.length
        ? `Salam ${p.name} ! Tu as ${due.length} mot${due.length > 1 ? 's' : ''} à réviser.`
        : `Salam ${p.name} ! Choisis un thème et on y va.`
    ),
  ]);

  if (due.length) {
    wrap.append(el('button', {
      class: 'primary wide review',
      onclick: () => go('session', { itemIds: sample(due, Math.min(cfg.perSession + 2, due.length)).map((i) => i.id), title: 'Révision', unitId: null }),
    }, `🔁 Réviser (${due.length})`));
  }

  wrap.append(el('h2', { class: 'section' }, 'Les thèmes'));
  wrap.append(
    el('div', { class: 'unit-grid' },
      units.map((u) => {
        const stars = p.stars[u.id] || 0;
        return el('button', {
          class: 'unit-card',
          style: { '--c': u.color },
          onclick: () => go('unit', { unitId: u.id }),
        }, [
          el('span', { class: 'unit-emoji' }, u.emoji),
          el('span', { class: 'unit-title' }, u.title),
          el('span', { class: 'stars' }, '★★★'.slice(0, stars).padEnd(3, '☆')),
        ]);
      })
    )
  );

  wrap.append(el('div', { class: 'tools' }, [
    el('button', { class: 'tool', onclick: () => go('guide') }, ['📖', 'Prononcer']),
    el('button', { class: 'tool', onclick: () => go('studio') }, ['🎙️', 'Studio voix']),
    el('button', { class: 'tool', onclick: () => go('parents') }, ['👨‍👩‍👧', 'Parents']),
  ]));
  return wrap;
};

// --- Écran : une unité ------------------------------------------------------

VIEWS.unit = ({ unitId }) => {
  const u = UNIT_BY_ID[unitId];
  const p = store.active();
  const cfg = store.mode(p);

  const wrap = el('div', { class: 'screen', style: { '--c': u.color } }, [
    header(`${u.emoji} ${u.title}`),
    el('div', { class: 'row-btns' }, [
      el('button', { class: 'primary', onclick: () => go('learn', { unitId, i: 0 }) }, '👀 Découvrir'),
      el('button', {
        class: 'primary',
        onclick: () => go('session', {
          itemIds: sample(u.items, Math.min(cfg.perSession, u.items.length)).map((i) => i.id),
          title: u.title,
          unitId,
        }),
      }, '🎮 Jouer'),
      el('button', {
        class: 'primary',
        onclick: () => go('memory', { unitId }),
      }, '🃏 Paires'),
    ]),
    el('h2', { class: 'section' }, 'Tous les mots'),
  ]);

  const list = el('div', { class: 'word-list' });
  u.items.forEach((it) => {
    const card = store.active()?.srs[it.id];
    list.append(el('button', {
      class: 'word-row',
      onclick: () => audio.playItem({ ...it, unit: u.id }),
    }, [
      el('span', { class: 'emoji' }, it.emoji),
      el('span', { class: 'word-text' }, [
        cfg.showLatin ? el('b', {}, it.dr) : el('b', {}, '••••'),
        cfg.showFrench ? el('small', {}, it.fr) : null,
        cfg.showArabic && it.ar ? el('span', { class: 'ar' }, it.ar) : null,
        it.tip && cfg.id === 'adulte' ? el('em', { class: 'tip' }, it.tip) : null,
      ]),
      el('span', { class: 'word-state' }, [
        audio.recordedIds.has(it.id) ? '🎙️' : '',
        card ? '•'.repeat(Math.min(card.box, 5)) : '',
      ].join(' ')),
      el('span', { class: 'speaker' }, '🔊'),
    ]));
  });
  wrap.append(list);

  if (u.notes?.length && cfg.id !== 'petit') {
    wrap.append(el('h2', { class: 'section' }, '💡 Bon à savoir'));
    wrap.append(el('ul', { class: 'notes' }, u.notes.map((n) => el('li', {}, n))));
  }
  return wrap;
};

// --- Écran : découverte (cartes) -------------------------------------------

VIEWS.learn = ({ unitId, i }) => {
  const u = UNIT_BY_ID[unitId];
  const cfg = store.mode();
  const it = u.items[i];
  const isLast = i === u.items.length - 1;

  setTimeout(() => audio.playItem(it), 250);

  return el('div', { class: 'screen', style: { '--c': u.color } }, [
    header(`${u.title} · ${i + 1}/${u.items.length}`),
    el('div', { class: 'progress' }, [
      el('div', { class: 'bar', style: { width: ((i + 1) / u.items.length) * 100 + '%' } }),
    ]),
    el('div', { class: 'learn-card', onclick: () => audio.playItem(it) }, [
      el('span', { class: 'emoji hero-size' }, it.emoji),
      // En découverte on affiche toujours le texte : l'enfant qui ne lit pas
      // ignore simplement, et l'adulte à côté de lui peut lire le mot.
      el('p', { class: 'learn-fr' }, it.fr),
      el('p', { class: 'learn-dr' }, it.dr),
      cfg.showArabic && it.ar ? el('p', { class: 'learn-ar' }, it.ar) : null,
      el('button', { class: 'big-speaker', onclick: (e) => { e.stopPropagation(); audio.playItem(it); } }, '🔊'),
      el('button', { class: 'link-btn', onclick: (e) => { e.stopPropagation(); audio.playItem(it, { slow: true }); } }, '🐢 plus lentement'),
      it.tip && cfg.id !== 'petit' ? el('p', { class: 'tip' }, '💡 ' + it.tip) : null,
    ]),
    el('div', { class: 'row-btns' }, [
      i > 0 ? el('button', { class: 'secondary', onclick: () => go('learn', { unitId, i: i - 1 }, { replace: true }) }, '←') : null,
      el('button', {
        class: 'primary grow',
        onclick: () => {
          if (isLast) {
            go('session', {
              itemIds: sample(u.items, Math.min(cfg.perSession, u.items.length)).map((x) => x.id),
              title: u.title,
              unitId,
            }, { replace: true });
          } else {
            go('learn', { unitId, i: i + 1 }, { replace: true });
          }
        },
      }, isLast ? '🎮 On joue !' : 'Suivant →'),
    ]),
  ]);
};

// --- Écran : session de jeu -------------------------------------------------

VIEWS.session = ({ itemIds, title, unitId }) => {
  const cfg = store.mode();
  const queue = shuffle(itemIds.map((id) => ALL_ITEMS.find((x) => x.id === id)).filter(Boolean));
  const pool = unitId
    ? ALL_ITEMS.filter((x) => x.unit === unitId).concat(sample(ALL_ITEMS, 12))
    : ALL_ITEMS;

  let idx = 0;
  let correct = 0;
  let lastKind = null;
  const retry = [];

  const bar = el('div', { class: 'bar' });
  const slotEl = el('div', { class: 'round-slot' });
  const wrap = el('div', { class: 'screen play' }, [
    el('header', { class: 'topbar' }, [
      el('button', { class: 'icon-btn', onclick: back, 'aria-label': 'Quitter' }, '✕'),
      el('div', { class: 'progress grow' }, [bar]),
      el('span', { class: 'score' }, '0'),
    ]),
    slotEl,
  ]);

  const total = queue.length;

  const next = () => {
    const item = queue[idx];
    if (!item) {
      if (retry.length) {
        queue.push(...retry.splice(0));
        return next();
      }
      const ratio = correct / Math.max(total, 1);
      const stars = ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1;
      store.addXp(correct * 10);
      store.touchStreak();
      if (unitId) store.setStars(unitId, stars);
      const fresh = store.refreshBadges();
      return go('result', { correct, total, stars, title, unitId, badges: fresh.map((b) => b.id) }, { replace: true });
    }
    bar.style.width = (idx / total) * 100 + '%';
    wrap.querySelector('.score').textContent = String(correct);
    const kind = chooseRound(item, cfg, lastKind);
    lastKind = kind;
    clear(slotEl);
    slotEl.append(
      ROUNDS[kind](item, pool, cfg, (ok) => {
        if (ok) correct++;
        else retry.push(item);
        store.recordAnswer(item.id, ok);
        idx++;
        next();
      })
    );
  };

  next();
  return wrap;
};

// --- Écran : bilan ----------------------------------------------------------

VIEWS.result = ({ correct, total, stars, title, unitId, badges }) => {
  audio.sfx.win();
  const p = store.active();
  const badgeDefs = store.allBadges().filter((b) => badges.includes(b.id));
  return el('div', { class: 'screen center' }, [
    el('h1', { class: 'big-title' }, 'Bravo !'),
    el('div', { class: 'stars-big' }, [1, 2, 3].map((n) => el('span', { class: n <= stars ? 'on' : '' }, '★'))),
    el('p', { class: 'result-line' }, `${correct} / ${total} réussis · ${title}`),
    el('p', { class: 'result-xp' }, `+${correct * 10} points · 🔥 ${p.streak.count} jour${p.streak.count > 1 ? 's' : ''} d’affilée`),
    ...badgeDefs.map((b) => el('div', { class: 'badge-pop' }, `${b.emoji} Nouveau badge : ${b.label}`)),
    mascot(pick(['Mzyan bzzaf !', 'Continue comme ça !', 'Yallah, encore une ?'])),
    el('div', { class: 'row-btns' }, [
      unitId ? el('button', {
        class: 'primary grow',
        onclick: () => {
          const u = UNIT_BY_ID[unitId];
          const cfg = store.mode();
          go('session', { itemIds: sample(u.items, Math.min(cfg.perSession, u.items.length)).map((i) => i.id), title: u.title, unitId }, { replace: true });
        },
      }, '🔁 Rejouer') : null,
      el('button', { class: 'secondary grow', onclick: () => reset('home') }, '🏠 Accueil'),
    ]),
  ]);
};

// --- Écran : jeu de paires --------------------------------------------------

VIEWS.memory = ({ unitId }) => {
  const u = UNIT_BY_ID[unitId];
  const cfg = store.mode();
  const count = cfg.id === 'petit' ? 4 : 6;
  const items = sample(u.items, Math.min(count, u.items.length)).map((i) => ({ ...i, unit: u.id }));
  const wrap = el('div', { class: 'screen', style: { '--c': u.color } }, [
    header('🃏 Jeu de paires'),
    el('p', { class: 'instruction' }, 'Retrouve les paires image / mot'),
  ]);
  wrap.append(memoryBoard(items, cfg, (moves) => {
    store.addXp(30);
    store.touchStreak();
    store.refreshBadges();
    wrap.append(el('div', { class: 'win-banner' }, `Bravo ! Terminé en ${moves} coups · +30 points`));
    wrap.append(el('button', { class: 'primary wide', onclick: () => go('memory', { unitId }, { replace: true }) }, '🔁 Encore'));
  }));
  return wrap;
};

// --- Écran : guide de prononciation ----------------------------------------

VIEWS.guide = () => {
  const demo = (s) => ({ id: 'demo-' + s.s, dr: s.ex, ar: s.arEx, emoji: '🔊' });
  return el('div', { class: 'screen' }, [
    header('📖 Prononcer le darija'),
    mascot('Le darija s’écrit souvent en lettres latines, avec des chiffres pour les sons qui n’existent pas en français.'),
    el('div', { class: 'sound-list' },
      SOUNDS.map((s) =>
        el('button', { class: 'sound-card', onclick: () => audio.playItem(demo(s)) }, [
          el('span', { class: 'sound-sym' }, s.s),
          el('span', { class: 'sound-text' }, [
            el('b', {}, s.ar),
            el('small', {}, s.fr),
            el('em', {}, 'ex. ' + s.ex),
          ]),
        ])
      )
    ),
    el('h2', { class: 'section' }, 'Trois règles utiles'),
    el('ul', { class: 'notes' }, [
      el('li', {}, 'Le darija adore les mots sans voyelles : « khobz », « k7el ». On enchaîne les consonnes.'),
      el('li', {}, 'Le présent se forme avec « ka- » : kanakol = je mange.'),
      el('li', {}, 'La négation encadre le verbe : ma … ch. « Ma bghitch » = je ne veux pas.'),
    ]),
    el('p', { class: 'hint' },
      audio.hasArabicVoice()
        ? 'Une voix arabe est disponible sur cet appareil : elle donne une idée, mais elle n’a pas l’accent marocain. Le Studio voix reste la meilleure option.'
        : 'Aucune voix arabe n’est installée sur cet appareil : passe par le Studio voix pour enregistrer les mots.'),
  ]);
};

// --- Écran : studio d'enregistrement ---------------------------------------

// Les unités à enregistrer d'abord, puis les autres dans l'ordre normal.
const STUDIO_ORDER = [
  ...RECORDING_PRIORITY.map((id) => UNIT_BY_ID[id]).filter(Boolean),
  ...UNITS.filter((u) => !RECORDING_PRIORITY.includes(u.id)),
];

// Retenu entre deux passages dans le studio, pour ne pas repartir de zéro.
let studioUnitId = STUDIO_ORDER[0].id;

const micError = () => alert('Micro indisponible. Vérifie l’autorisation du navigateur.');

VIEWS.studio = () => {
  let recorder = null;
  const listEl = el('div', { class: 'word-list' });
  const priorityEl = el('div', { class: 'word-list' });

  const drawPriority = () => {
    clear(priorityEl);
    RECORDING_PRIORITY.map((id) => UNIT_BY_ID[id]).filter(Boolean).forEach((u, rank) => {
      const done = audio.countRecorded(u.items);
      const total = u.items.length;
      priorityEl.append(el('button', {
        class: 'prio-row' + (done === total ? ' complete' : ''),
        style: { '--c': u.color },
        onclick: () => go('studioGuided', { unitId: u.id, i: 0 }),
      }, [
        el('span', { class: 'prio-rank' }, done === total ? '✅' : String(rank + 1)),
        el('span', { class: 'word-text' }, [
          el('b', {}, `${u.emoji} ${u.title}`),
          el('small', {}, `${done} / ${total} enregistrés`),
        ]),
        el('span', { class: 'progress prio-bar' }, [
          el('span', { class: 'bar', style: { width: (done / total) * 100 + '%' } }),
        ]),
      ]));
    });
  };

  const drawList = () => {
    clear(listEl);
    const u = UNIT_BY_ID[studioUnitId];
    u.items.forEach((it) => {
      const has = audio.recordedIds.has(it.id);
      const recBtn = el('button', { class: 'rec-btn' + (has ? ' has' : '') }, has ? '🎙️' : '⚪');
      recBtn.addEventListener('click', async () => {
        if (recorder) {
          const blob = await recorder.stop();
          recorder = null;
          await audio.saveClip(it.id, blob);
          drawList();
          drawPriority();
          return;
        }
        try {
          recorder = await audio.beginRecording();
          recBtn.classList.add('recording');
          recBtn.textContent = '⏹️';
        } catch {
          recorder = null;
          micError();
        }
      });

      listEl.append(el('div', { class: 'word-row studio-row' }, [
        el('span', { class: 'emoji' }, it.emoji),
        el('span', { class: 'word-text' }, [el('b', {}, it.dr), el('small', {}, it.fr)]),
        el('button', { class: 'speaker', onclick: () => audio.playItem({ ...it, unit: u.id }) }, '🔊'),
        recBtn,
        has ? el('button', { class: 'speaker', onclick: async () => { await audio.deleteClip(it.id); drawList(); drawPriority(); } }, '🗑️') : null,
      ]));
    });
  };

  const select = el('select', {
    class: 'text-input',
    onchange: (e) => { studioUnitId = e.target.value; drawList(); },
  }, STUDIO_ORDER.map((u) =>
    el('option', { value: u.id, selected: u.id === studioUnitId },
      `${u.emoji} ${u.title} — ${audio.countRecorded(u.items)}/${u.items.length}`)
  ));

  drawPriority();
  drawList();

  const totalDone = audio.countRecorded(ALL_ITEMS);
  const firstTodo = STUDIO_ORDER.find((u) => audio.countRecorded(u.items) < u.items.length) || STUDIO_ORDER[0];

  return el('div', { class: 'screen' }, [
    header('🎙️ Studio voix'),
    mascot('Fais enregistrer les mots par quelqu’un qui parle darija : c’est ce que les enfants entendront ensuite dans tous les jeux.'),
    el('button', {
      class: 'primary wide',
      onclick: () => go('studioGuided', { unitId: firstTodo.id, i: 0 }),
    }, `🎤 Enregistrer à la chaîne — ${firstTodo.title}`),
    el('p', { class: 'hint' }, `${totalDone} / ${ALL_ITEMS.length} enregistrés sur cet appareil`),

    el('h2', { class: 'section' }, 'À enregistrer en priorité'),
    el('p', { class: 'hint' }, 'Ce que les enfants entendent le plus souvent. Commence par le 1.'),
    priorityEl,

    el('h2', { class: 'section' }, 'Partager les voix'),
    el('p', { class: 'hint' }, 'Enregistre une seule fois, puis copie l’archive sur les autres téléphones de la famille.'),
    el('div', { class: 'row-btns' }, [
      el('button', {
        class: 'secondary grow',
        disabled: totalDone === 0,
        onclick: async () => {
          try {
            const { blob, count } = await audio.exportClips();
            if (!count) return alert('Aucune voix à exporter pour l’instant.');
            download(blob, `darija-voix-${new Date().toISOString().slice(0, 10)}.zip`);
          } catch (e) {
            alert('Export impossible : ' + e.message);
          }
        },
      }, `⬇️ Exporter (${totalDone})`),
      el('button', {
        class: 'secondary grow',
        onclick: () => {
          const inp = el('input', { type: 'file', accept: '.zip,application/zip' });
          inp.addEventListener('change', async () => {
            const file = inp.files[0];
            if (!file) return;
            try {
              const { total, collisions } = await audio.previewImport(file);
              if (!total) return alert('Cette archive ne contient aucune voix.');
              let replace = true;
              if (collisions) {
                replace = confirm(
                  `${total} voix dans l’archive, dont ${collisions} déjà enregistrées ici.\n\n` +
                  'OK : remplacer les miennes par celles de l’archive.\n' +
                  'Annuler : garder les miennes et n’ajouter que les nouvelles.'
                );
              }
              const r = await audio.importClips(file, {
                replace,
                knownIds: new Set(ALL_ITEMS.map((i) => i.id)),
              });
              alert(
                `${r.added} voix ajoutée${r.added > 1 ? 's' : ''}, ${r.replaced} remplacée${r.replaced > 1 ? 's' : ''}` +
                (r.skipped ? `, ${r.skipped} ignorée${r.skipped > 1 ? 's' : ''}` : '') +
                (r.unknown ? `, ${r.unknown} sans mot correspondant` : '') + '.'
              );
              go('studio', {}, { replace: true });
            } catch (e) {
              alert('Import impossible : ' + e.message);
            }
          });
          inp.click();
        },
      }, '⬆️ Importer'),
    ]),

    el('h2', { class: 'section' }, 'Mot par mot'),
    select,
    el('p', { class: 'hint' }, 'Touche ⚪ pour enregistrer, ⏹️ pour arrêter. Les voix restent sur cet appareil.'),
    listEl,
  ]);
};

// --- Écran : enregistrement à la chaîne -------------------------------------

VIEWS.studioGuided = ({ unitId, i }) => {
  const u = UNIT_BY_ID[unitId];
  const it = u.items[i];
  studioUnitId = unitId;

  if (!it) {
    const done = audio.countRecorded(u.items);
    return el('div', { class: 'screen center' }, [
      el('h1', { class: 'big-title' }, 'Terminé !'),
      el('p', { class: 'result-line' }, `${done} / ${u.items.length} enregistrés dans « ${u.title} »`),
      mascot('Ces voix remplacent désormais la synthèse dans tous les jeux.'),
      el('div', { class: 'row-btns' }, [
        el('button', { class: 'secondary grow', onclick: () => back() }, '🎙️ Retour au studio'),
        el('button', { class: 'primary grow', onclick: () => reset('home') }, '🏠 Accueil'),
      ]),
    ]);
  }

  const next = () => go('studioGuided', { unitId, i: i + 1 }, { replace: true });

  const has = audio.recordedIds.has(it.id);
  const status = el('p', { class: 'hint' }, has ? '🎙️ déjà enregistré — tu peux refaire' : 'Prêt à enregistrer');
  const recBtn = el('button', { class: 'big-rec' }, '⚪');
  let recorder = null;

  recBtn.addEventListener('click', async () => {
    if (recorder) {
      const blob = await recorder.stop();
      recorder = null;
      recBtn.classList.remove('recording');
      recBtn.textContent = '⏳';
      await audio.saveClip(it.id, blob);
      audio.sfx.good();
      recBtn.textContent = '✅';
      status.textContent = 'Enregistré !';
      await audio.playItem(it);
      setTimeout(next, 600);
      return;
    }
    try {
      recorder = await audio.beginRecording();
      recBtn.classList.add('recording');
      recBtn.textContent = '⏹️';
      status.textContent = 'Ça enregistre… touche pour arrêter';
    } catch {
      recorder = null;
      micError();
    }
  });

  return el('div', { class: 'screen', style: { '--c': u.color } }, [
    header(`🎤 ${u.title} · ${i + 1}/${u.items.length}`),
    el('div', { class: 'progress' }, [
      el('div', { class: 'bar', style: { width: (i / u.items.length) * 100 + '%' } }),
    ]),
    el('p', { class: 'instruction' }, 'Touche le rond, dis la phrase, touche encore pour arrêter'),
    el('div', { class: 'learn-card' }, [
      el('span', { class: 'emoji hero-size' }, it.emoji),
      el('p', { class: 'learn-fr' }, it.fr),
      el('p', { class: 'learn-dr' }, it.dr),
      it.ar ? el('p', { class: 'learn-ar' }, it.ar) : null,
      it.tip ? el('p', { class: 'tip' }, '💡 ' + it.tip) : null,
    ]),
    recBtn,
    status,
    el('div', { class: 'row-btns' }, [
      i > 0 ? el('button', {
        class: 'secondary',
        onclick: () => go('studioGuided', { unitId, i: i - 1 }, { replace: true }),
      }, '←') : null,
      has ? el('button', { class: 'secondary', onclick: () => audio.playItem(it) }, '🔊') : null,
      el('button', { class: 'secondary grow', onclick: next }, 'Passer →'),
    ]),
  ]);
};

// --- Écran : espace parents -------------------------------------------------

VIEWS.parents = () => {
  const p = store.active();
  const seen = store.seenCount(p);
  const known = store.knownCount(p);
  const due = store.dueItems(ALL_ITEMS, p).length;
  const unlocked = new Set(p.badges);

  const wrap = el('div', { class: 'screen' }, [
    header('👨‍👩‍👧 Espace parents'),
    el('div', { class: 'stat-grid' }, [
      ['Mots rencontrés', `${seen} / ${ALL_ITEMS.length}`],
      ['Mots mémorisés', String(known)],
      ['À réviser aujourd’hui', String(due)],
      ['Points', String(p.xp)],
      ['Série en cours', `${p.streak.count} j`],
      ['Record de série', `${p.streak.best || 0} j`],
    ].map(([k, v]) => el('div', { class: 'stat' }, [el('b', {}, v), el('small', {}, k)]))),

    el('h2', { class: 'section' }, 'Badges'),
    el('div', { class: 'badge-grid' },
      store.allBadges().map((b) =>
        el('div', { class: 'badge' + (unlocked.has(b.id) ? ' on' : '') }, [
          el('span', {}, b.emoji),
          el('small', {}, b.label),
        ])
      )
    ),

    el('h2', { class: 'section' }, 'Profil'),
    el('div', { class: 'stack' }, Object.values(store.MODES).map((m) =>
      el('button', {
        class: 'answer col' + (p.mode === m.id ? ' selected' : ''),
        onclick: () => { store.updateProfile(p.id, { mode: m.id }); go('parents', {}, { replace: true }); },
      }, [el('b', {}, m.label), el('small', {}, m.hint)])
    )),

    el('h2', { class: 'section' }, 'Données'),
    el('p', { class: 'hint' }, 'Tout est stocké sur cet appareil. Rien n’est envoyé sur Internet.'),
    el('div', { class: 'row-btns' }, [
      el('button', {
        class: 'secondary grow',
        onclick: () => {
          const blob = new Blob([store.exportData()], { type: 'application/json' });
          download(blob, 'darija-progression.json');
        },
      }, '⬇️ Exporter'),
      el('button', {
        class: 'secondary grow',
        onclick: () => {
          const inp = el('input', { type: 'file', accept: 'application/json' });
          inp.addEventListener('change', async () => {
            try {
              store.importData(await inp.files[0].text());
              reset('profiles');
            } catch {
              alert('Fichier illisible.');
            }
          });
          inp.click();
        },
      }, '⬆️ Importer'),
    ]),
    el('button', {
      class: 'danger wide',
      onclick: () => {
        if (confirm(`Supprimer le profil de ${p.name} et sa progression ?`)) {
          store.removeProfile(p.id);
          reset('profiles');
        }
      },
    }, '🗑️ Supprimer ce profil'),
  ]);
  return wrap;
};

// --- Démarrage --------------------------------------------------------------

// Les consignes se font lire à voix haute : indispensable quand on ne sait pas lire.
document.addEventListener('click', (e) => {
  const t = e.target.closest('.instruction');
  if (t) audio.playFrench(t.textContent);
});

async function boot() {
  await audio.loadRecordedIndex();
  reset(store.active() ? 'home' : 'profiles');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
