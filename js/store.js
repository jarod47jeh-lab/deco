// Persistance locale : profils, progression, révision espacée.
// Tout reste dans le navigateur du téléphone (localStorage), rien n'est envoyé nulle part.

const KEY = 'darija-app-v1';

// Intervalles de la boîte de Leitner, en jours.
const BOXES = [0, 1, 2, 4, 8, 16, 32];

export const MODES = {
  petit: {
    id: 'petit',
    label: 'Tout-petit',
    hint: '4-6 ans · tout en son et en images',
    perSession: 4,
    showLatin: false,
    showArabic: false,
    showFrench: false,
    rounds: ['listen', 'pickAudio'],
    choices: 3,
  },
  junior: {
    id: 'junior',
    label: 'Junior',
    hint: '7-12 ans · on lit et on écoute',
    perSession: 6,
    showLatin: true,
    showArabic: false,
    showFrench: true,
    rounds: ['listen', 'pickAudio', 'quizFr', 'quizDr'],
    choices: 4,
  },
  adulte: {
    id: 'adulte',
    label: 'Adulte',
    hint: 'lecture, écriture arabe et grammaire',
    perSession: 8,
    showLatin: true,
    showArabic: true,
    showFrench: true,
    rounds: ['listen', 'quizFr', 'quizDr', 'order', 'type'],
    choices: 4,
  },
};

export const AVATARS = ['🦊', '🐪', '🐱', '🦁', '🐢', '🐝', '🦜', '🐬', '🌟', '🚀'];

const todayKey = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

const blank = () => ({ profiles: [], activeId: null });

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.profiles) ? parsed : blank();
  } catch {
    return blank();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Sauvegarde impossible', e);
  }
}

export function profiles() {
  return state.profiles;
}

const byId = (id) => state.profiles.find((p) => p.id === id) || null;

export function active() {
  return state.profiles.find((p) => p.id === state.activeId) || null;
}

export function setActive(id) {
  state.activeId = id;
  save();
}

export function modeForAge(age) {
  if (age <= 6) return 'petit';
  if (age <= 12) return 'junior';
  return 'adulte';
}

export function addProfile({ name, age, avatar, mode }) {
  const p = {
    id: 'p' + Date.now().toString(36),
    name: name.trim() || 'Apprenti',
    age: Number(age) || 8,
    avatar: avatar || AVATARS[state.profiles.length % AVATARS.length],
    mode: mode || modeForAge(Number(age) || 8),
    xp: 0,
    stars: {},          // unitId -> 0..3
    srs: {},            // itemId -> { box, due, seen, ok }
    streak: { count: 0, last: null, best: 0 },
    duels: { played: 0, won: 0 },
    badges: [],
    createdAt: todayKey(),
  };
  state.profiles.push(p);
  state.activeId = p.id;
  save();
  return p;
}

export function updateProfile(id, patch) {
  const p = state.profiles.find((x) => x.id === id);
  if (!p) return;
  Object.assign(p, patch);
  if (patch.age && !patch.mode) p.mode = modeForAge(patch.age);
  save();
}

export function removeProfile(id) {
  state.profiles = state.profiles.filter((p) => p.id !== id);
  if (state.activeId === id) state.activeId = state.profiles[0]?.id ?? null;
  save();
}

export function mode(p = active()) {
  return MODES[p?.mode] || MODES.junior;
}

// --- Progression -----------------------------------------------------------

export function addXpFor(profileId, n) {
  const p = byId(profileId);
  if (!p) return;
  p.xp += n;
  save();
}

export function addXp(n) {
  addXpFor(state.activeId, n);
}

export function setStars(unitId, stars) {
  const p = active();
  if (!p) return;
  p.stars[unitId] = Math.max(p.stars[unitId] || 0, stars);
  save();
}

export function totalStars(p = active()) {
  return p ? Object.values(p.stars).reduce((a, b) => a + b, 0) : 0;
}

export function touchStreakFor(profileId) {
  const p = byId(profileId);
  if (!p) return;
  const t = todayKey();
  if (p.streak.last === t) return;
  const gap = p.streak.last ? daysBetween(p.streak.last, t) : null;
  p.streak.count = gap === 1 ? p.streak.count + 1 : 1;
  p.streak.last = t;
  p.streak.best = Math.max(p.streak.best || 0, p.streak.count);
  save();
}

export function touchStreak() {
  touchStreakFor(state.activeId);
}

// --- Révision espacée ------------------------------------------------------

export function recordAnswerFor(profileId, itemId, ok) {
  const p = byId(profileId);
  if (!p) return;
  const card = p.srs[itemId] || { box: 0, due: todayKey(), seen: 0, ok: 0 };
  card.seen += 1;
  if (ok) {
    card.ok += 1;
    card.box = Math.min(card.box + 1, BOXES.length - 1);
  } else {
    card.box = Math.max(card.box - 1, 0);
  }
  const d = new Date();
  d.setDate(d.getDate() + BOXES[card.box]);
  card.due = d.toISOString().slice(0, 10);
  p.srs[itemId] = card;
  save();
}

export function recordAnswer(itemId, ok) {
  recordAnswerFor(state.activeId, itemId, ok);
}

/** Un défi joué, et éventuellement gagné. */
export function recordDuel(profileId, won) {
  const p = byId(profileId);
  if (!p) return;
  p.duels = p.duels || { played: 0, won: 0 };
  p.duels.played += 1;
  if (won) p.duels.won += 1;
  save();
}

export function dueItems(allItems, p = active()) {
  if (!p) return [];
  const t = todayKey();
  return allItems.filter((it) => {
    const c = p.srs[it.id];
    return c && c.due <= t;
  });
}

export function knownCount(p = active()) {
  if (!p) return 0;
  return Object.values(p.srs).filter((c) => c.box >= 3).length;
}

export function seenCount(p = active()) {
  return p ? Object.keys(p.srs).length : 0;
}

// --- Badges ----------------------------------------------------------------

const BADGE_DEFS = [
  { id: 'first', emoji: '🐣', label: 'Premier pas', test: (p) => seenCount(p) >= 1 },
  { id: 'ten', emoji: '🔟', label: '10 mots vus', test: (p) => seenCount(p) >= 10 },
  { id: 'fifty', emoji: '🎯', label: '50 mots vus', test: (p) => seenCount(p) >= 50 },
  { id: 'streak3', emoji: '🔥', label: '3 jours de suite', test: (p) => p.streak.count >= 3 },
  { id: 'streak7', emoji: '🏆', label: 'Une semaine !', test: (p) => p.streak.count >= 7 },
  { id: 'stars10', emoji: '⭐', label: '10 étoiles', test: (p) => totalStars(p) >= 10 },
  { id: 'stars30', emoji: '🌠', label: '30 étoiles', test: (p) => totalStars(p) >= 30 },
  { id: 'known20', emoji: '🧠', label: '20 mots mémorisés', test: (p) => knownCount(p) >= 20 },
  { id: 'duel1', emoji: '⚔️', label: 'Premier défi', test: (p) => (p.duels?.played || 0) >= 1 },
  { id: 'duelwin', emoji: '🥇', label: 'Vainqueur', test: (p) => (p.duels?.won || 0) >= 1 },
  { id: 'duel5', emoji: '👑', label: '5 défis gagnés', test: (p) => (p.duels?.won || 0) >= 5 },
];

export function refreshBadgesFor(profileId) {
  const p = byId(profileId);
  if (!p) return [];
  const fresh = [];
  for (const b of BADGE_DEFS) {
    if (!p.badges.includes(b.id) && b.test(p)) {
      p.badges.push(b.id);
      fresh.push(b);
    }
  }
  if (fresh.length) save();
  return fresh;
}

export function refreshBadges() {
  return refreshBadgesFor(state.activeId);
}

export function allBadges() {
  return BADGE_DEFS;
}

export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(json) {
  const parsed = JSON.parse(json);
  if (!parsed || !Array.isArray(parsed.profiles)) throw new Error('Fichier invalide');
  state = parsed;
  save();
}
