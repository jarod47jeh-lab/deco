// Chef d'orchestre : navigation entre les écrans.

import { UNITS, UNIT_BY_ID, ALL_ITEMS, SOUNDS, RECORDING_PRIORITY } from './data.js';
import * as store from './store.js';
import * as audio from './audio.js';
import { ROUNDS, chooseRound, memoryBoard } from './games.js';
import { STORIES, STORY_BY_ID, STORY_UNITS, storyWordIds } from './stories.js';
import * as speech from './speech.js';
import { VERSION } from './version.js';
import { el, clear, shuffle, sample, pick, wait } from './dom.js';

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

/**
 * Hors HTTPS (et hors localhost), le navigateur coupe le micro et le service
 * worker sans rien dire. Mieux vaut l'expliquer que laisser croire à une panne.
 */
const restricted = () => !window.isSecureContext;

function insecureWarning(what) {
  if (!restricted()) return null;
  return el('div', { class: 'warn' }, [
    el('b', {}, '⚠️ Connexion non sécurisée'),
    el('p', {}, `${what} a besoin d’une adresse en https:// (ou de localhost). ` +
      'Depuis un téléphone, ouvre la version en ligne de l’app — voir le README.'),
  ]);
}

/** Ce que l'apprenant va entendre : vraie voix, ou synthèse en arabe standard. */
function voiceTag(item) {
  const real = audio.recordedIds.has(item.id);
  return el('span', {
    class: 'voice-tag' + (real ? ' real' : ''),
    title: real ? 'Voix enregistrée' : 'Synthèse : arabe standard, pas du darija',
  }, real ? '🎙️ vraie voix' : '🤖 synthèse');
}

/** En mode « vraies voix seulement », on ne propose que les mots enregistrés. */
const voiceFilter = (items) =>
  store.settings().realVoiceOnly ? items.filter((it) => audio.recordedIds.has(it.id)) : items;

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
  // Chaque nouveau profil prend l'avatar suivant : indispensable pour se reconnaître en défi.
  let avatar = store.AVATARS[store.profiles().length % store.AVATARS.length];
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

// --- La séance du jour ------------------------------------------------------
//
// Sans elle, il faut choisir un thème pour jouer : la plus jeune ne peut pas le
// faire seule, et un adulte ne sait pas quoi réviser. La séance compose le
// mélange elle-même — d'abord les mots dus, puis quelques mots neufs pris dans
// le thème déjà entamé, pour ne pas éparpiller.

function dailyPlan(p, cfg) {
  const units = UNITS.filter((u) => (cfg.id === 'petit' ? u.kid : true));
  const pool = voiceFilter(units.flatMap((u) => u.items.map((i) => ({ ...i, unit: u.id }))));

  // Les plus en retard d'abord.
  const due = store.dueItems(pool, p).sort((a, b) => (p.srs[a.id].due < p.srs[b.id].due ? -1 : 1));

  const size = cfg.perSession;
  // On garde toujours de la place pour du neuf, sauf si le retard est énorme.
  const revisions = due.slice(0, due.length >= size * 2 ? size : Math.max(0, size - 2));

  const unseen = pool.filter((i) => !p.srs[i.id]);
  const byUnit = new Map();
  for (const it of unseen) {
    if (!byUnit.has(it.unit)) byUnit.set(it.unit, []);
    byUnit.get(it.unit).push(it);
  }
  // On continue le thème le plus entamé plutôt que d'en ouvrir un nouveau.
  const progress = (unitId) => UNIT_BY_ID[unitId].items.filter((i) => p.srs[i.id]).length;
  const nextUnit = [...byUnit.keys()].sort((a, b) => progress(b) - progress(a))[0];
  const fresh = (byUnit.get(nextUnit) || []).slice(0, size - revisions.length);

  // Tout est vu et rien n'est dû : on révise quand même, au hasard.
  const items = [...revisions, ...fresh];
  if (!items.length) items.push(...sample(pool, Math.min(size, pool.length)));

  return {
    items: shuffle(items),
    revisions: revisions.length,
    fresh: fresh.length,
    unitId: fresh.length && !revisions.length ? nextUnit : null,
    unitTitle: nextUnit ? UNIT_BY_ID[nextUnit].title : null,
  };
}

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

  if (audio.recordedIds.size === 0) {
    wrap.append(el('div', { class: 'warn soft' }, [
      el('b', {}, '🤖 Aucune voix enregistrée'),
      el('p', {}, 'Ce que vous entendez est de la synthèse en arabe standard — pas du darija. ' +
        'Le Studio voix (🎙️ en bas) remplace ça par de vraies voix.'),
    ]));
  }

  if (store.settings().realVoiceOnly && audio.recordedIds.size === 0) {
    wrap.append(el('div', { class: 'warn' }, [
      el('b', {}, '🎙️ Aucune voix enregistrée'),
      el('p', {}, 'Tu as choisi de n’entendre que de vraies voix, mais aucune n’est encore ' +
        'enregistrée. Passe par le Studio, ou réautorise la synthèse dans l’espace parents.'),
    ]));
    wrap.append(el('button', { class: 'primary wide', onclick: () => go('studio') }, '🎙️ Studio voix'));
    wrap.append(el('div', { class: 'tools' }, [
      el('button', { class: 'tool', onclick: () => go('guide') }, ['📖', 'Prononcer']),
      el('button', { class: 'tool', onclick: () => go('parents') }, ['👨‍👩‍👧', 'Parents']),
    ]));
    return wrap;
  }

  const plan = dailyPlan(p, cfg);
  const doneToday = store.practicedToday(p);
  const parts = [
    plan.revisions ? `${plan.revisions} à revoir` : null,
    plan.fresh ? `${plan.fresh} nouveau${plan.fresh > 1 ? 'x' : ''}${plan.unitTitle ? ' · ' + plan.unitTitle : ''}` : null,
  ].filter(Boolean);

  wrap.append(el('button', {
    class: 'daily' + (doneToday ? ' done' : ''),
    onclick: () => go('session', {
      itemIds: plan.items.map((i) => i.id),
      title: 'Séance du jour',
      unitId: plan.unitId,
    }),
  }, [
    el('span', { class: 'daily-emoji' }, doneToday ? '✅' : '🌟'),
    el('span', { class: 'word-text' }, [
      el('b', {}, doneToday ? 'Séance faite ! On en refait une ?' : 'Ma séance du jour'),
      el('small', {}, parts.join(' · ') || 'Quelques mots au hasard'),
    ]),
    el('span', { class: 'daily-go' }, '▶'),
  ]));

  if (due.length > plan.revisions) {
    wrap.append(el('button', {
      class: 'link-btn',
      onclick: () => go('session', { itemIds: sample(due, Math.min(cfg.perSession + 2, due.length)).map((i) => i.id), title: 'Révision', unitId: null }),
    }, `🔁 Tout réviser (${due.length} mots en attente)`));
  }

  if (store.profiles().length >= 2) {
    wrap.append(el('button', {
      class: 'primary wide duel-btn',
      onclick: () => go('duelSetup'),
    }, '🏆 Défi famille'));
  }

  wrap.append(el('div', { class: 'row-btns' }, [
    el('button', { class: 'primary story-btn', onclick: () => go('stories') }, '📚 Les histoires'),
    el('button', { class: 'primary listen-btn', onclick: () => go('listenPick') }, '📻 Écouter'),
  ]));

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
          itemIds: sample(voiceFilter(u.items), Math.min(cfg.perSession, voiceFilter(u.items).length)).map((i) => i.id),
          title: u.title,
          unitId,
        }),
      }, '🎮 Jouer'),
      el('button', {
        class: 'primary',
        onclick: () => go('memory', { unitId }),
      }, '🃏 Paires'),
      el('button', {
        class: 'primary',
        onclick: () => go('pronounce', { unitId, i: 0 }),
      }, '🎤 Prononcer'),
    ]),
    el('h2', { class: 'section' }, 'Tous les mots'),
  ]);

  const list = el('div', { class: 'word-list' });
  u.items.forEach((it) => {
    const card = store.active()?.srs[it.id];
    // Ligne cliquable pour écouter + bouton de correction à côté : deux boutons
    // frères, car imbriquer l'un dans l'autre serait invalide.
    const row = el('button', {
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
    ]);
    const edit = el('button', {
      class: 'edit-word' + (store.overrides()[it.id] ? ' done' : ''),
      'aria-label': 'Corriger ' + it.dr,
      onclick: () => go('editWord', { itemId: it.id, unitId: u.id }),
    }, '✏️');
    list.append(el('div', { class: 'word-item' }, [row, edit]));
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
      voiceTag(it),
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

  // Peut arriver en mode « vraies voix seulement » : rien à jouer ici.
  if (!queue.length) {
    return el('div', { class: 'screen center' }, [
      header(title || 'Séance'),
      mascot('Aucun mot enregistré pour ce thème — et tu as choisi de n’entendre que de vraies voix.'),
      el('button', { class: 'primary wide', onclick: () => reset('studio') }, '🎙️ Aller enregistrer'),
      el('button', { class: 'link-btn', onclick: () => reset('home') }, 'Retour à l’accueil'),
    ]);
  }
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

// --- Écran : écoute en boucle -----------------------------------------------
//
// Pensé pour la voiture ou le coucher : les mots défilent seuls, on n'a rien à
// toucher. Une boucle asynchrone porte un jeton ; quitter l'écran l'invalide,
// sinon deux lectures se superposeraient au retour.

let listenToken = 0;

VIEWS.listen = ({ unitId }) => {
  const p = store.active();
  const cfg = store.mode(p);

  // Trois sources possibles : un thème, les mots à réviser, ou tout ce qui est ouvert.
  let queue;
  let title;
  if (unitId === 'due') {
    queue = shuffle(voiceFilter(store.dueItems(ALL_ITEMS, p)));
    title = 'À réviser';
  } else if (unitId === 'all') {
    const units = UNITS.filter((u) => (cfg.id === 'petit' ? u.kid : true));
    queue = shuffle(voiceFilter(units.flatMap((u) => u.items.map((i) => ({ ...i, unit: u.id })))));
    title = 'Tout mélangé';
  } else {
    const u = UNIT_BY_ID[unitId];
    queue = voiceFilter(u.items.map((i) => ({ ...i, unit: u.id })));
    title = u.title;
  }

  if (!queue.length) {
    return el('div', { class: 'screen center' }, [
      header('📻 Écouter'),
      mascot('Rien à écouter ici pour l’instant — reviens après avoir joué un peu.'),
      el('button', { class: 'primary wide', onclick: () => back() }, 'Retour'),
    ]);
  }

  const token = ++listenToken;
  let seq = 0;          // invalide l'itération en cours quand on saute ou qu'on met en pause
  let idx = 0;
  let paused = false;
  let withFrench = true;
  let slow = false;

  const card = el('div', { class: 'learn-card listen-card' });
  // Pas d'animation ici : c'est un contrôle de lecture, pas un appel à toucher.
  const playBtn = el('button', { class: 'big-speaker steady' }, '⏸️');
  const counter = el('p', { class: 'hint' });

  const draw = () => {
    const it = queue[idx];
    clear(card);
    card.append(
      el('span', { class: 'emoji hero-size' }, it.emoji),
      el('p', { class: 'learn-fr' }, it.fr),
      el('p', { class: 'learn-dr' }, it.dr),
      cfg.showArabic && it.ar ? el('p', { class: 'learn-ar' }, it.ar) : null
    );
    counter.textContent = `${idx + 1} / ${queue.length} · ${title}`;
  };

  // Attend en petites tranches, pour réagir vite à une sortie d'écran.
  const idle = async (ms) => {
    for (let t = 0; t < ms && token === listenToken; t += 120) await wait(120);
  };

  /**
   * Joue le mot courant puis appelle la suite. Chaque itération porte son
   * numéro : sauter ou mettre en pause en crée une nouvelle, et l'ancienne
   * s'arrête au lieu de faire avancer l'index une seconde fois.
   */
  const playCurrent = async () => {
    const mine = ++seq;
    const alive = () => mine === seq && token === listenToken && !paused;

    draw();
    const it = queue[idx];

    await audio.playItem(it, { slow });
    if (!alive()) return;
    await idle(500);
    if (!alive()) return;

    if (withFrench) {
      await audio.playFrench(it.fr);
      if (!alive()) return;
      await idle(400);
      if (!alive()) return;
    }

    idx = (idx + 1) % queue.length;
    playCurrent();
  };

  const step = (delta) => {
    idx = (idx + delta + queue.length) % queue.length;
    seq++;              // l'itération précédente se retire
    audio.stop();
    paused = false;
    playBtn.textContent = '⏸️';
    playCurrent();
  };

  // Garder l'écran allumé si le navigateur le permet — utile en voiture.
  let wakeLock = null;
  if (navigator.wakeLock) {
    navigator.wakeLock.request('screen').then((wl) => {
      wakeLock = wl;
      if (token !== listenToken) wl.release().catch(() => {});
    }).catch(() => { /* refusé ou indisponible */ });
  }

  const leave = () => {
    listenToken++; // invalide la boucle en cours
    audio.stop();
    if (wakeLock) wakeLock.release().catch(() => {});
    back();
  };

  playBtn.addEventListener('click', () => {
    if (paused) {
      step(0); // reprend en rejouant le mot courant depuis le début
    } else {
      paused = true;
      seq++;
      audio.stop();
      playBtn.textContent = '▶️';
    }
  });

  playCurrent();

  return el('div', { class: 'screen' }, [
    el('header', { class: 'topbar' }, [
      el('button', { class: 'icon-btn', onclick: leave, 'aria-label': 'Retour' }, '←'),
      el('h1', {}, '📻 Écouter'),
      el('span', { class: 'icon-btn ghost' }, ''),
    ]),
    card,
    counter,
    el('div', { class: 'row-btns' }, [
      el('button', { class: 'secondary grow', onclick: () => step(-1) }, '⏮️'),
      playBtn,
      el('button', { class: 'secondary grow', onclick: () => step(1) }, '⏭️'),
    ]),
    el('div', { class: 'row-btns' }, [
      el('button', {
        class: 'secondary grow toggle on',
        onclick: (e) => {
          withFrench = !withFrench;
          e.currentTarget.classList.toggle('on', withFrench);
          e.currentTarget.textContent = withFrench ? '🇫🇷 avec le français' : '🇫🇷 sans le français';
        },
      }, '🇫🇷 avec le français'),
      el('button', {
        class: 'secondary grow toggle',
        onclick: (e) => {
          slow = !slow;
          e.currentTarget.classList.toggle('on', slow);
          e.currentTarget.textContent = slow ? '🐢 lent' : '🐇 normal';
        },
      }, '🐇 normal'),
    ]),
    el('p', { class: 'hint' }, 'Pose le téléphone : les mots continuent tout seuls, en boucle.'),
  ]);
};

VIEWS.listenPick = () => {
  const p = store.active();
  const cfg = store.mode(p);
  const due = store.dueItems(ALL_ITEMS, p).length;
  const units = UNITS.filter((u) => (cfg.id === 'petit' ? u.kid : true));

  return el('div', { class: 'screen' }, [
    header('📻 Écouter en boucle'),
    mascot('Les mots défilent tout seuls, sans rien toucher. Parfait en voiture ou avant de dormir.'),
    el('div', { class: 'row-btns' }, [
      el('button', { class: 'primary full-row', onclick: () => go('listen', { unitId: 'all' }) }, '🎲 Tout mélangé'),
      due
        ? el('button', { class: 'primary full-row', onclick: () => go('listen', { unitId: 'due' }) }, `🔁 Mes mots à réviser (${due})`)
        : null,
    ]),
    el('h2', { class: 'section' }, 'Ou un thème'),
    el('div', { class: 'unit-grid' },
      units.map((u) =>
        el('button', {
          class: 'unit-card',
          style: { '--c': u.color },
          onclick: () => go('listen', { unitId: u.id }),
        }, [
          el('span', { class: 'unit-emoji' }, u.emoji),
          el('span', { class: 'unit-title' }, u.title),
        ])
      )
    ),
  ]);
};

// --- Écrans : les histoires -------------------------------------------------

VIEWS.stories = () => {
  const p = store.active();
  return el('div', { class: 'screen' }, [
    header('📚 Les histoires'),
    mascot('Des petites histoires avec les mots que tu connais déjà. Écoute, regarde, puis réponds aux questions.'),
    el('div', { class: 'word-list' },
      STORIES.map((s) => {
        const words = storyWordIds(s, ALL_ITEMS);
        const known = words.filter((id) => p?.srs[id]).length;
        const done = p?.storiesRead?.includes(s.id);
        return el('button', {
          class: 'story-card',
          style: { '--c': s.color },
          onclick: () => go('story', { storyId: s.id, i: 0 }),
        }, [
          el('span', { class: 'story-emoji' }, s.emoji),
          el('span', { class: 'word-text' }, [
            el('b', {}, s.title),
            el('small', {}, `${s.scenes.length} images · ${known} mots sur ${words.length} déjà vus`),
          ]),
          el('span', { class: 'medal' }, done ? '✅' : '▶️'),
        ]);
      })
    ),
  ]);
};

VIEWS.story = ({ storyId, i }) => {
  const s = STORY_BY_ID[storyId];
  const cfg = store.mode();
  const scene = s.scenes[i];
  const last = i === s.scenes.length - 1;

  setTimeout(() => audio.playItem(scene), 350);

  return el('div', { class: 'screen', style: { '--c': s.color } }, [
    header(`${s.emoji} ${s.title} · ${i + 1}/${s.scenes.length}`),
    el('div', { class: 'progress' }, [
      el('div', { class: 'bar', style: { width: ((i + 1) / s.scenes.length) * 100 + '%' } }),
    ]),
    el('div', { class: 'learn-card', onclick: () => audio.playItem(scene) }, [
      el('span', { class: 'emoji hero-size' }, scene.emoji),
      el('p', { class: 'learn-fr' }, scene.fr),
      el('p', { class: 'story-dr' }, scene.dr),
      cfg.showArabic && scene.ar ? el('p', { class: 'learn-ar' }, scene.ar) : null,
      el('div', { class: 'row-btns' }, [
        el('button', { class: 'secondary grow', onclick: (e) => { e.stopPropagation(); audio.playItem(scene); } }, '🔊 Écouter'),
        el('button', { class: 'secondary grow', onclick: (e) => { e.stopPropagation(); audio.playItem(scene, { slow: true }); } }, '🐢 Lentement'),
      ]),
    ]),
    el('div', { class: 'row-btns' }, [
      i > 0 ? el('button', { class: 'secondary', onclick: () => go('story', { storyId, i: i - 1 }, { replace: true }) }, '←') : null,
      el('button', {
        class: 'primary grow',
        onclick: () => (last
          ? go('storyQuiz', { storyId, qi: 0, correct: 0 }, { replace: true })
          : go('story', { storyId, i: i + 1 }, { replace: true })),
      }, last ? '❓ Les questions' : 'Suite →'),
    ]),
  ]);
};

VIEWS.storyQuiz = ({ storyId, qi, correct }) => {
  const s = STORY_BY_ID[storyId];
  const question = s.questions[qi];

  if (!question) {
    const total = s.questions.length;
    store.addXp(correct * 10);
    store.touchStreak();
    store.recordStory(store.active()?.id, storyId);
    const fresh = store.refreshBadges();
    audio.sfx.win();
    return el('div', { class: 'screen center' }, [
      el('h1', { class: 'big-title' }, 'Bravo !'),
      el('p', { class: 'result-line' }, `${correct} / ${total} bonnes réponses`),
      el('p', { class: 'result-xp' }, `+${correct * 10} points · ${s.title}`),
      ...fresh.map((b) => el('div', { class: 'badge-pop' }, `${b.emoji} Nouveau badge : ${b.label}`)),
      mascot(pick(['Mzyan bzzaf !', 'Tu as tout suivi !', 'Yallah, une autre histoire ?'])),
      el('div', { class: 'row-btns' }, [
        el('button', { class: 'primary grow', onclick: () => go('story', { storyId, i: 0 }, { replace: true }) }, '🔁 Relire'),
        el('button', { class: 'secondary grow', onclick: () => go('stories', {}, { replace: true }) }, '📚 Les histoires'),
      ]),
    ]);
  }

  const opts = shuffle(question.options);
  const node = el('div', { class: 'screen', style: { '--c': s.color } }, [
    header(`❓ Question ${qi + 1}/${s.questions.length}`),
    el('p', { class: 'instruction' }, question.ask),
    el('div', { class: 'grid cards-' + opts.length },
      opts.map((o) =>
        el('button', {
          class: 'card pick',
          onclick: async (e) => {
            const ok = !!o.ok;
            node.querySelectorAll('button').forEach((b) => (b.disabled = true));
            e.currentTarget.classList.add(ok ? 'ok' : 'ko');
            ok ? audio.sfx.good() : audio.sfx.bad();
            await wait(ok ? 700 : 1400);
            go('storyQuiz', { storyId, qi: qi + 1, correct: correct + (ok ? 1 : 0) }, { replace: true });
          },
        }, [
          el('span', { class: 'emoji' }, o.emoji),
          el('span', { class: 'card-label' }, o.fr),
        ])
      )
    ),
  ]);
  // La question est lue à voix haute : la plus jeune n'a pas besoin de savoir lire.
  setTimeout(() => audio.playFrench(question.ask), 250);
  return node;
};

// --- Écran : s'entraîner à prononcer ----------------------------------------
//
// Le cœur de l'écran est la comparaison à l'oreille : on écoute le modèle,
// on s'enregistre, on réécoute les deux à la suite. Ça marche hors ligne et
// partout. L'écoute automatique (js/speech.js) n'est qu'un bonus facultatif.

// Les essais restent en mémoire le temps de la session : ils ne doivent
// surtout pas se retrouver mêlés aux voix de référence du studio.
const attempts = new Map();

VIEWS.pronounce = ({ unitId, i }) => {
  const u = UNIT_BY_ID[unitId];
  const it = u.items[i];
  const cfg = store.mode();
  let recorder = null;

  const status = el('p', { class: 'status' }, 'Écoute le modèle, puis enregistre-toi');
  const heard = el('div', { class: 'heard' });
  const compareRow = el('div', { class: 'row-btns' });
  const recBtn = el('button', { class: 'big-rec' }, '⚪');

  const stopRecorder = () => {
    if (recorder) {
      recorder.cancel();
      recorder = null;
    }
  };
  const leave = (view, params) => {
    stopRecorder();
    go(view, params, { replace: true });
  };

  const drawCompare = () => {
    clear(compareRow);
    const mine = attempts.get(it.id);
    if (!mine) return;
    compareRow.append(
      el('button', { class: 'secondary grow', onclick: () => audio.playItem(it) }, '🔊 Le modèle'),
      el('button', { class: 'secondary grow', onclick: () => audio.playUrl(mine) }, '🙋 Ma voix'),
      el('button', {
        class: 'primary full-row',
        onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          status.textContent = '🔊 le modèle…';
          await audio.playItem(it);
          await wait(400);
          status.textContent = '🙋 ta voix…';
          await audio.playUrl(mine);
          status.textContent = 'Alors, pareil ou pas ?';
          btn.disabled = false;
        },
      }, '⚖️ Les deux à la suite')
    );

    // Bonus facultatif, seulement si le parent l'a activé et que l'appareil sait le faire.
    if (store.settings().speech && speech.available() && it.ar) {
      compareRow.append(el('button', {
        class: 'secondary full-row',
        onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          clear(heard);
          status.textContent = '👂 dis le mot maintenant…';
          try {
            const alts = await speech.listen({ lang: 'ar-MA' });
            const { text, score } = speech.bestMatch(alts, it.ar);
            const verdict =
              score >= 0.75 ? { cls: 'ok', txt: '✅ Ça correspond !' }
              : score >= 0.5 ? { cls: '', txt: '🤏 Pas loin' }
              : { cls: 'ko', txt: '❓ L’appareil n’a pas reconnu' };
            heard.append(
              el('p', { class: 'verdict ' + verdict.cls }, verdict.txt),
              el('p', { class: 'heard-text' }, ['il a entendu : ', el('span', { class: 'ar' }, text || '—')]),
              el('p', { class: 'hint' }, 'Rappel : ce moteur ne connaît pas le darija, il se trompe souvent. Ton oreille décide.')
            );
            status.textContent = 'Compare quand tu veux';
          } catch (err) {
            heard.append(el('p', { class: 'hint' }, '⚠️ ' + err.message));
            status.textContent = 'Compare quand tu veux';
          }
          btn.disabled = false;
        },
      }, '👂 Faire écouter l’appareil'));
    }
  };

  recBtn.addEventListener('click', async () => {
    if (recorder) {
      const blob = await recorder.stop();
      recorder = null;
      recBtn.classList.remove('recording');
      recBtn.textContent = '🔁';
      const old = attempts.get(it.id);
      if (old) URL.revokeObjectURL(old);
      attempts.set(it.id, URL.createObjectURL(blob));
      status.textContent = 'Écoute-toi !';
      drawCompare();
      await audio.playUrl(attempts.get(it.id));
      return;
    }
    try {
      recorder = await audio.beginRecording();
      recBtn.classList.add('recording');
      recBtn.textContent = '⏹️';
      clear(heard);
      status.textContent = 'Dis le mot… touche pour arrêter';
    } catch {
      recorder = null;
      status.textContent = '⚠️ Micro indisponible';
    }
  });

  if (attempts.has(it.id)) {
    recBtn.textContent = '🔁';
    drawCompare();
  }

  setTimeout(() => audio.playItem(it), 400);

  return el('div', { class: 'screen', style: { '--c': u.color } }, [
    header(`🎤 Prononcer · ${i + 1}/${u.items.length}`),
    insecureWarning('L’enregistrement de ta voix'),
    el('div', { class: 'progress' }, [
      el('div', { class: 'bar', style: { width: ((i + 1) / u.items.length) * 100 + '%' } }),
    ]),
    el('div', { class: 'learn-card' }, [
      el('span', { class: 'emoji hero-size' }, it.emoji),
      el('p', { class: 'learn-fr' }, it.fr),
      el('p', { class: 'learn-dr' }, it.dr),
      cfg.showArabic && it.ar ? el('p', { class: 'learn-ar' }, it.ar) : null,
      el('div', { class: 'row-btns' }, [
        el('button', { class: 'secondary grow', onclick: () => audio.playItem(it) }, '🔊 Écouter'),
        el('button', { class: 'secondary grow', onclick: () => audio.playItem(it, { slow: true }) }, '🐢 Lentement'),
      ]),
      audio.recordedIds.has(it.id)
        ? null
        : el('p', { class: 'hint' }, '⚠️ Modèle en voix de synthèse : l’accent n’est pas marocain. Enregistre ce mot dans le studio.'),
    ]),
    recBtn,
    status,
    heard,
    compareRow,
    el('div', { class: 'row-btns' }, [
      i > 0 ? el('button', { class: 'secondary', onclick: () => leave('pronounce', { unitId, i: i - 1 }) }, '←') : null,
      el('button', {
        class: 'primary grow',
        onclick: () => (i + 1 < u.items.length ? leave('pronounce', { unitId, i: i + 1 }) : leave('unit', { unitId })),
      }, i + 1 < u.items.length ? 'Suivant →' : 'Terminer'),
    ]),
  ]);
};

// --- Écrans : défi famille --------------------------------------------------
//
// Plusieurs profils s'affrontent sur le même téléphone, à tour de rôle.
// L'équité vient du fait que chacun joue dans SON mode : la plus jeune reçoit
// des manches en images et en son, l'adulte doit écrire le mot. Les mots sont
// tirés du même thème, et chaque joueur a ses propres mots pour que personne
// ne voie passer la réponse de l'autre.

const TURNS_EACH = 5;
let duel = null;

function buildDuel(chosen, unitId) {
  const hasLittle = chosen.some((p) => p.mode === 'petit');
  const allowed = hasLittle ? UNITS.filter((u) => u.kid) : UNITS;
  const source = unitId === 'mix' ? allowed : [UNIT_BY_ID[unitId]];
  const pool = source.flatMap((u) => u.items.map((i) => ({ ...i, unit: u.id })));

  let bag = shuffle(pool);
  const need = chosen.length * TURNS_EACH;
  while (bag.length < need) bag = bag.concat(shuffle(pool));

  const turns = [];
  for (let t = 0; t < TURNS_EACH; t++) {
    chosen.forEach((_, playerIdx) => turns.push({ playerIdx, item: bag[turns.length] }));
  }

  return {
    players: chosen.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, mode: p.mode, score: 0, correct: 0, lastKind: null })),
    turns,
    turn: 0,
    phase: 'handoff',
    pool,
    title: unitId === 'mix' ? 'Mélange' : UNIT_BY_ID[unitId].title,
    color: unitId === 'mix' ? null : UNIT_BY_ID[unitId].color,
  };
}

VIEWS.duelSetup = () => {
  const all = store.profiles();
  const chosen = new Set(all.slice(0, 2).map((p) => p.id));
  let unitId = 'mix';

  const playersEl = el('div', { class: 'profile-row' });
  const themesEl = el('div', { class: 'unit-grid' });
  const startBtn = el('button', { class: 'primary wide' }, '⚔️ Commencer le défi');

  const refresh = () => {
    startBtn.disabled = chosen.size < 2;
    startBtn.textContent = chosen.size < 2 ? 'Choisis au moins 2 joueurs' : '⚔️ Commencer le défi';
  };

  const drawPlayers = () => {
    clear(playersEl);
    all.forEach((p) =>
      playersEl.append(el('button', {
        class: 'profile-card' + (chosen.has(p.id) ? ' selected' : ''),
        onclick: () => {
          chosen.has(p.id) ? chosen.delete(p.id) : chosen.add(p.id);
          audio.sfx.tap();
          drawPlayers();
          drawThemes();
          refresh();
        },
      }, [
        el('span', { class: 'avatar' }, p.avatar),
        el('b', {}, p.name),
        el('small', {}, store.MODES[p.mode].label),
      ]))
    );
  };

  const drawThemes = () => {
    clear(themesEl);
    // Si une joueuse est en mode tout-petit, on s'en tient aux thèmes concrets.
    const hasLittle = all.some((p) => chosen.has(p.id) && p.mode === 'petit');
    const list = hasLittle ? UNITS.filter((u) => u.kid) : UNITS;
    const options = [{ id: 'mix', emoji: '🎲', title: 'Mélange', color: '#f59e0b' }, ...list];
    if (!options.some((o) => o.id === unitId)) unitId = 'mix';
    options.forEach((u) =>
      themesEl.append(el('button', {
        class: 'unit-card' + (u.id === unitId ? ' selected' : ''),
        style: { '--c': u.color },
        onclick: () => { unitId = u.id; drawThemes(); },
      }, [
        el('span', { class: 'unit-emoji' }, u.emoji),
        el('span', { class: 'unit-title' }, u.title),
      ]))
    );
  };

  startBtn.addEventListener('click', () => {
    const players = all.filter((p) => chosen.has(p.id));
    duel = buildDuel(players, unitId);
    go('duel', {}, { replace: true });
  });

  drawPlayers();
  drawThemes();
  refresh();

  return el('div', { class: 'screen' }, [
    header('🏆 Défi famille'),
    mascot(`Chacun joue à son niveau, ${TURNS_EACH} tours chacun. On se passe le téléphone entre les tours.`),
    el('h2', { class: 'section' }, 'Qui joue ?'),
    playersEl,
    el('h2', { class: 'section' }, 'Sur quel thème ?'),
    themesEl,
    startBtn,
  ]);
};

VIEWS.duel = () => {
  if (!duel) return VIEWS.home();
  if (duel.turn >= duel.turns.length) return duelResult();

  const { playerIdx, item } = duel.turns[duel.turn];
  const player = duel.players[playerIdx];
  const cfg = store.MODES[player.mode];
  const round = Math.floor(duel.turn / duel.players.length) + 1;

  const scores = el('div', { class: 'duel-scores' },
    duel.players.map((p, i) =>
      el('div', { class: 'duel-player' + (i === playerIdx ? ' active' : '') }, [
        el('span', { class: 'duel-avatar' }, p.avatar),
        el('b', {}, String(p.score)),
      ])
    )
  );

  if (duel.phase === 'handoff') {
    return el('div', { class: 'screen center' }, [
      scores,
      el('div', { class: 'handoff' }, [
        el('span', { class: 'handoff-avatar' }, player.avatar),
        el('h1', { class: 'big-title' }, `À toi, ${player.name} !`),
        el('p', { class: 'result-xp' }, `Tour ${round} sur ${TURNS_EACH} · ${duel.title}`),
      ]),
      el('button', {
        class: 'primary wide',
        onclick: () => { duel.phase = 'play'; go('duel', {}, { replace: true }); },
      }, 'Je suis prêt !'),
      el('button', { class: 'link-btn', onclick: () => { duel = null; reset('home'); } }, 'Arrêter le défi'),
    ]);
  }

  const kind = chooseRound(item, cfg, player.lastKind);
  player.lastKind = kind;

  const slot = el('div', { class: 'round-slot' });
  const wrap = el('div', { class: 'screen play', style: duel.color ? { '--c': duel.color } : {} }, [
    el('header', { class: 'topbar' }, [
      el('button', { class: 'icon-btn', onclick: () => { duel = null; reset('home'); }, 'aria-label': 'Quitter' }, '✕'),
      el('span', { class: 'duel-turn' }, `${player.avatar} ${player.name}`),
      el('span', { class: 'score' }, String(player.score)),
    ]),
    scores,
    slot,
  ]);

  slot.append(ROUNDS[kind](item, duel.pool, cfg, (ok) => {
    store.recordAnswerFor(player.id, item.id, ok);
    if (ok) {
      player.score += 10;
      player.correct += 1;
    }
    duel.turn += 1;
    duel.phase = 'handoff';
    go('duel', {}, { replace: true });
  }));

  return wrap;
};

function duelResult() {
  const ranked = [...duel.players].sort((a, b) => b.score - a.score);
  const top = ranked[0].score;
  const winners = ranked.filter((p) => p.score === top);
  const tie = winners.length > 1;

  // On ne crédite qu'une fois, même si l'écran est réaffiché.
  if (!duel.finalized) {
    duel.finalized = true;
    duel.players.forEach((p) => {
      store.addXpFor(p.id, p.score);
      store.touchStreakFor(p.id);
      store.recordDuel(p.id, p.score === top);
      store.refreshBadgesFor(p.id);
    });
    audio.sfx.win();
  }

  const medals = ['🥇', '🥈', '🥉'];
  // Classement sportif : deux joueurs à égalité partagent la même médaille.
  const medalFor = (p) => medals[ranked.findIndex((x) => x.score === p.score)] || '🎖️';

  return el('div', { class: 'screen center' }, [
    el('h1', { class: 'big-title' }, tie ? 'Égalité !' : `Bravo ${winners[0].name} !`),
    el('div', { class: 'podium' },
      ranked.map((p) =>
        el('div', { class: 'podium-row' + (p.score === top ? ' win' : '') }, [
          el('span', { class: 'medal' }, medalFor(p)),
          el('span', { class: 'duel-avatar' }, p.avatar),
          el('span', { class: 'word-text' }, [
            el('b', {}, p.name),
            el('small', {}, `${p.correct} / ${TURNS_EACH} réussis`),
          ]),
          el('b', { class: 'podium-score' }, `${p.score} pts`),
        ])
      )
    ),
    mascot(tie ? 'Personne ne gagne, tout le monde gagne !' : pick(['Mzyan bzzaf !', 'Quelle équipe !', 'Yallah, on remet ça ?'])),
    el('p', { class: 'hint' }, 'Les points et les mots vus sont ajoutés à chaque profil.'),
    el('div', { class: 'row-btns' }, [
      el('button', {
        class: 'primary grow',
        onclick: () => { duel = null; go('duelSetup', {}, { replace: true }); },
      }, '🔁 Rejouer'),
      el('button', {
        class: 'secondary grow',
        onclick: () => { duel = null; reset('home'); },
      }, '🏠 Accueil'),
    ]),
  ]);
}

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
  ...STORY_UNITS,
];
const STUDIO_BY_ID = Object.fromEntries(STUDIO_ORDER.map((u) => [u.id, u]));

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
    const u = STUDIO_BY_ID[studioUnitId];
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
    insecureWarning('L’enregistrement'),
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

    el('h2', { class: 'section' }, 'Installation'),
    el('div', { class: 'stat-grid' }, [
      ['Version', VERSION],
      ['Hors ligne', 'serviceWorker' in navigator ? 'oui' : 'non'],
      ['Micro', restricted() ? 'bloqué' : 'ok'],
    ].map(([k, v]) => el('div', { class: 'stat' }, [el('b', {}, v), el('small', {}, k)]))),
    insecureWarning('Le mode hors ligne et le micro'),

    el('h2', { class: 'section' }, 'Le son'),
    el('div', { class: 'stat-grid' }, [
      ['Voix arabe', audio.hasArabicVoice() ? 'oui' : 'absente'],
      ['Voix système', String(audio.voiceCount())],
      ['Son débloqué', audio.isAudioUnlocked() ? 'oui' : 'non'],
    ].map(([k, v]) => el('div', { class: 'stat' }, [el('b', {}, v), el('small', {}, k)]))),
    !audio.hasArabicVoice()
      ? el('div', { class: 'warn' }, [
          el('b', {}, '⚠️ Aucune voix arabe sur cet appareil'),
          el('p', {}, 'Les mots ne peuvent donc pas être prononcés par la synthèse. ' +
            'Sur iPhone : Réglages → Accessibilité → Contenu énoncé → Voix → Arabe, et télécharger une voix. ' +
            'Les mots enregistrés dans le Studio, eux, fonctionnent quoi qu’il arrive.'),
        ])
      : null,
    el('button', {
      class: 'secondary wide',
      onclick: async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = '🔊 test en cours…';
        const r = await audio.testAudio(ALL_ITEMS[0]);
        btn.disabled = false;
        btn.textContent = '🔊 Tester le son';
        alert(
          'Résultat du test :\n\n' +
          `Bruitages : ${r.bruitage ? 'ok' : 'muet'}\n` +
          `Voix française : ${r.francais ? 'ok' : 'muette'}\n` +
          `Voix arabe : ${audio.hasArabicVoice() ? (r.arabe ? 'ok' : 'muette') : 'absente de l’appareil'}\n` +
          `Mot enregistré : ${r.enregistrement === null ? 'aucun à tester' : (r.enregistrement ? 'ok' : 'muet')}\n\n` +
          'Si tout est « ok » mais que vous n’entendez rien : vérifiez le petit ' +
          'interrupteur silencieux sur le côté de l’iPhone, et le volume.'
        );
      },
    }, '🔊 Tester le son'),
    el('p', { class: 'hint' }, 'Sur iPhone, l’interrupteur silencieux coupe aussi le son des apps web.'),

    el('h2', { class: 'section' }, 'Corrections du vocabulaire'),
    el('p', { class: 'hint' },
      `${Object.keys(store.overrides()).length} mot(s) corrigé(s). Le vocabulaire livré a été écrit ` +
      'par quelqu’un qui n’est pas marocain : le bouton ✏️ de chaque thème permet de le reprendre.'),
    el('div', { class: 'row-btns' }, [
      el('button', {
        class: 'secondary grow',
        disabled: Object.keys(store.overrides()).length === 0,
        onclick: () => download(new Blob([store.exportOverrides()], { type: 'application/json' }),
          `darija-corrections-${new Date().toISOString().slice(0, 10)}.json`),
      }, '⬇️ Exporter'),
      el('button', {
        class: 'secondary grow',
        onclick: () => {
          const inp = el('input', { type: 'file', accept: 'application/json' });
          inp.addEventListener('change', async () => {
            try {
              const n = store.importOverrides(await inp.files[0].text());
              applyOverrides();
              alert(`${n} correction(s) importée(s).`);
              go('parents', {}, { replace: true });
            } catch (e) {
              alert('Import impossible : ' + e.message);
            }
          });
          inp.click();
        },
      }, '⬆️ Importer'),
    ]),

    el('h2', { class: 'section' }, 'La voix des mots'),
    el('p', { class: 'hint' },
      `${audio.recordedIds.size} mots ont une vraie voix enregistrée sur ${ALL_ITEMS.length}. ` +
      'Les autres sont dits par la synthèse du téléphone, qui ne parle que l’arabe standard : ' +
      'la prononciation entendue n’est pas du darija.'),
    el('button', {
      class: 'answer col' + (store.settings().realVoiceOnly ? ' selected' : ''),
      onclick: () => {
        const on = !store.settings().realVoiceOnly;
        store.setSetting('realVoiceOnly', on);
        audio.setSynthesisAllowed(!on);
        go('parents', {}, { replace: true });
      },
    }, [
      el('b', {}, store.settings().realVoiceOnly ? '✅ Vraies voix seulement' : '⬜ Synthèse autorisée'),
      el('small', {}, store.settings().realVoiceOnly
        ? `Les jeux n’utilisent que les ${audio.recordedIds.size} mots enregistrés`
        : 'Les enfants entendent parfois de l’arabe standard'),
    ]),

    el('h2', { class: 'section' }, 'Écoute automatique'),
    el('p', { class: 'hint' },
      speech.available()
        ? 'Dans l’écran « Prononcer », l’appareil peut essayer de reconnaître ce qui est dit. ' +
          'Attention : le navigateur envoie alors la voix à un service en ligne (Google pour Chrome), ' +
          'il faut une connexion, et le moteur ne connaît pas le darija — il refuse souvent une ' +
          'prononciation correcte. La comparaison à l’oreille fonctionne sans rien de tout ça.'
        : 'Cet appareil ne propose pas de reconnaissance vocale. La comparaison à l’oreille reste disponible.'),
    speech.available()
      ? el('button', {
          class: 'answer col' + (store.settings().speech ? ' selected' : ''),
          onclick: () => {
            store.setSetting('speech', !store.settings().speech);
            go('parents', {}, { replace: true });
          },
        }, [
          el('b', {}, store.settings().speech ? '✅ Activée' : '⬜ Désactivée'),
          el('small', {}, store.settings().speech ? 'La voix sort du téléphone quand on l’utilise' : 'Rien ne sort du téléphone'),
        ])
      : null,

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

// --- Corrections du vocabulaire ---------------------------------------------

/**
 * Applique les corrections de la famille aux objets du vocabulaire, en place.
 * Le reste de l'app n'a rien à savoir : elle lit les mêmes objets qu'avant.
 */
function applyOverrides() {
  const ov = store.overrides();
  // ALL_ITEMS contient des copies de UNITS[].items : il faut corriger les deux,
  // sinon la liste d'un thème continue d'afficher l'ancienne version.
  const cibles = [
    ...UNITS.flatMap((u) => u.items),
    ...ALL_ITEMS,
    ...STORIES.flatMap((s) => s.scenes),
  ];
  for (const it of cibles) {
    const patch = ov[it.id];
    if (!patch) continue;
    if (it.original === undefined) it.original = { fr: it.fr, dr: it.dr, ar: it.ar, tip: it.tip };
    Object.assign(it, patch);
  }
}

/** Toutes les instances d'un mot : l'originale et sa copie dans ALL_ITEMS. */
function itemInstances(itemId) {
  return [
    ...UNITS.flatMap((u) => u.items),
    ...ALL_ITEMS,
    ...STORIES.flatMap((s) => s.scenes),
  ].filter((x) => x.id === itemId);
}

VIEWS.editWord = ({ itemId, unitId }) => {
  const it = ALL_ITEMS.find((x) => x.id === itemId)
    || STORIES.flatMap((s) => s.scenes).find((x) => x.id === itemId);
  const base = it.original || it;
  const corrected = !!store.overrides()[itemId];

  const field = (label, value, hint) => {
    const input = el('input', { class: 'text-input', type: 'text', value: value || '' });
    return { node: el('label', { class: 'field' }, [label, input, hint ? el('small', { class: 'hint' }, hint) : null]), input };
  };
  const fr = field('Français', it.fr);
  const dr = field('Darija en lettres latines', it.dr, '3 = ع, 7 = ح, 9 = ق, kh = خ, gh = غ, ch = ش');
  const ar = field('Écriture arabe', it.ar);
  const tip = field('Note (facultatif)', it.tip, 'Par exemple la forme féminine, ou une variante');

  return el('div', { class: 'screen' }, [
    header('✏️ Corriger le mot'),
    mascot('Le vocabulaire a été écrit par quelqu’un qui n’est pas marocain. Si un mot sonne faux, corrigez-le ici : la correction s’applique partout dans l’app.'),
    el('div', { class: 'learn-card' }, [el('span', { class: 'emoji hero-size' }, it.emoji)]),
    fr.node, dr.node, ar.node, tip.node,
    corrected ? el('p', { class: 'hint' }, `Version d’origine : ${base.dr} — ${base.ar}`) : null,
    el('button', {
      class: 'primary wide',
      onclick: () => {
        store.setOverride(itemId, { fr: fr.input.value, dr: dr.input.value, ar: ar.input.value, tip: tip.input.value });
        applyOverrides();
        back();
      },
    }, '✅ Enregistrer la correction'),
    corrected ? el('button', {
      class: 'link-btn',
      onclick: () => {
        store.clearOverride(itemId);
        itemInstances(itemId).forEach((x) => Object.assign(x, x.original || base));
        back();
      },
    }, '↩︎ Revenir à la version d’origine') : null,
  ]);
};

// --- Démarrage --------------------------------------------------------------

// iOS n'autorise le son qu'à partir d'un geste : on débloque au premier contact.
['pointerdown', 'touchstart', 'keydown'].forEach((ev) =>
  document.addEventListener(ev, () => audio.unlockAudio(), { once: true, capture: true })
);

// Les consignes se font lire à voix haute : indispensable quand on ne sait pas lire.
document.addEventListener('click', (e) => {
  const t = e.target.closest('.instruction');
  if (t) audio.playFrench(t.textContent);
});

async function boot() {
  applyOverrides();
  await audio.loadRecordedIndex();
  audio.setSynthesisAllowed(!store.settings().realVoiceOnly);
  reset(store.active() ? 'home' : 'profiles');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
