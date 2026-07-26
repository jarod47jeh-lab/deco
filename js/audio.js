// Audio : voix enregistrées (prioritaires) + synthèse vocale de secours + bruitages.

const DB_NAME = 'darija-audio';
const STORE = 'clips';
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const clipCache = new Map();

export async function saveClip(itemId, blob) {
  await tx('readwrite', (s) => s.put(blob, itemId));
  clipCache.delete(itemId);
  recordedIds.add(itemId);
}

export async function deleteClip(itemId) {
  await tx('readwrite', (s) => s.delete(itemId));
  clipCache.delete(itemId);
  recordedIds.delete(itemId);
}

export async function getClipUrl(itemId) {
  if (clipCache.has(itemId)) return clipCache.get(itemId);
  const blob = await tx('readonly', (s) => s.get(itemId));
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  clipCache.set(itemId, url);
  return url;
}

export const recordedIds = new Set();

export async function loadRecordedIndex() {
  try {
    const keys = await tx('readonly', (s) => s.getAllKeys());
    keys.forEach((k) => recordedIds.add(k));
  } catch {
    /* IndexedDB indisponible : on se rabat sur la synthèse */
  }
  return recordedIds;
}

// --- Synthèse vocale -------------------------------------------------------

let voices = [];
function refreshVoices() {
  voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
}
if (window.speechSynthesis) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

function pickVoice(langs) {
  for (const l of langs) {
    const v = voices.find((x) => x.lang.toLowerCase().replace('_', '-').startsWith(l));
    if (v) return v;
  }
  return null;
}

export function hasArabicVoice() {
  return !!pickVoice(['ar-ma', 'ar']);
}

let currentAudio = null;

function stopAll() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

function speak(text, langs, rate) {
  if (!window.speechSynthesis) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(langs);
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    } else {
      u.lang = langs[0];
    }
    u.rate = rate;
    u.onend = u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

/**
 * Joue un mot en darija : l'enregistrement d'un locuteur natif s'il existe,
 * sinon la synthèse arabe (approximative), sinon rien.
 */
export async function playItem(item, { slow = false } = {}) {
  stopAll();
  const url = await getClipUrl(item.id);
  if (url) {
    const a = new Audio(url);
    a.playbackRate = slow ? 0.7 : 1;
    currentAudio = a;
    try {
      await a.play();
    } catch {
      /* lecture bloquée par le navigateur */
    }
    return;
  }
  const text = item.ar || item.dr;
  await speak(text, ['ar-ma', 'ar'], slow ? 0.6 : 0.85);
}

export function playFrench(text) {
  stopAll();
  return speak(text, ['fr-fr', 'fr'], 0.95);
}

// --- Bruitages (WebAudio, aucun fichier requis) ----------------------------

let ctx = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type = 'sine', gain = 0.15) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

export const sfx = {
  good() {
    try {
      tone(660, 0, 0.12);
      tone(880, 0.1, 0.18);
    } catch {}
  },
  bad() {
    try {
      tone(200, 0, 0.22, 'triangle', 0.12);
    } catch {}
  },
  win() {
    try {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.25));
    } catch {}
  },
  tap() {
    try {
      tone(440, 0, 0.06, 'square', 0.06);
    } catch {}
  },
};
