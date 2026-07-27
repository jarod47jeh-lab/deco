// Audio : voix enregistrées (prioritaires) + synthèse vocale de secours + bruitages.

import { zipStore, unzip } from './zip.js';

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

export const countRecorded = (items) => items.filter((it) => recordedIds.has(it.id)).length;

// --- Transfert des voix d'un appareil à l'autre ----------------------------

const EXT_BY_TYPE = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};
const TYPE_BY_EXT = Object.fromEntries(Object.entries(EXT_BY_TYPE).map(([t, e]) => [e, t]));
const baseType = (t) => (t || '').split(';')[0].trim().toLowerCase();

/** Rassemble toutes les voix dans une archive, avec un manifeste id → fichier. */
export async function exportClips() {
  const keys = await tx('readonly', (s) => s.getAllKeys());
  const manifest = { version: 1, createdAt: new Date().toISOString(), clips: {} };
  const files = [];

  for (const id of keys) {
    const blob = await tx('readonly', (s) => s.get(id));
    if (!blob) continue;
    const type = blob.type || 'audio/webm';
    const name = `voix/${id}.${EXT_BY_TYPE[baseType(type)] || 'bin'}`;
    files.push({ name, bytes: new Uint8Array(await blob.arrayBuffer()) });
    manifest.clips[id] = { file: name, type };
  }

  const count = files.length;
  files.unshift({
    name: 'manifest.json',
    bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
  });
  return { blob: zipStore(files), count };
}

/**
 * Réinjecte une archive produite par exportClips.
 * @param {File} file
 * @param {{replace?: boolean, knownIds?: Set<string>}} opts
 */
export async function importClips(file, { replace = true, knownIds = null } = {}) {
  const entries = unzip(new Uint8Array(await file.arrayBuffer()));
  const byName = new Map(entries.map((e) => [e.name, e.bytes]));

  let clips = {};
  const manifest = byName.get('manifest.json');
  if (manifest) {
    clips = JSON.parse(new TextDecoder().decode(manifest)).clips || {};
  } else {
    // Archive sans manifeste : on déduit l'identifiant du nom de fichier.
    for (const e of entries) {
      const m = /(?:^|\/)([^/]+)\.([a-z0-9]+)$/i.exec(e.name);
      if (m) clips[m[1]] = { file: e.name, type: TYPE_BY_EXT[m[2].toLowerCase()] || 'audio/webm' };
    }
  }

  const report = { added: 0, replaced: 0, skipped: 0, unknown: 0 };
  for (const [id, info] of Object.entries(clips)) {
    const bytes = byName.get(info.file);
    if (!bytes) { report.skipped++; continue; }
    if (knownIds && !knownIds.has(id)) { report.unknown++; continue; }
    const exists = recordedIds.has(id);
    if (exists && !replace) { report.skipped++; continue; }
    await saveClip(id, new Blob([bytes], { type: info.type || 'audio/webm' }));
    if (exists) report.replaced++; else report.added++;
  }
  return report;
}

/** Combien de voix de l'archive écraseraient une voix déjà présente. */
export async function previewImport(file) {
  const entries = unzip(new Uint8Array(await file.arrayBuffer()));
  const manifest = entries.find((e) => e.name === 'manifest.json');
  const ids = manifest
    ? Object.keys(JSON.parse(new TextDecoder().decode(manifest.bytes)).clips || {})
    : entries.map((e) => /(?:^|\/)([^/]+)\.[a-z0-9]+$/i.exec(e.name)?.[1]).filter(Boolean);
  return { total: ids.length, collisions: ids.filter((id) => recordedIds.has(id)).length };
}

/**
 * Ouvre le micro et commence à enregistrer.
 * Renvoie un contrôleur : stop() rend le Blob, cancel() jette tout.
 */
export async function beginRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks = [];
  const rec = new MediaRecorder(stream);
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
        };
        rec.stop();
      }),
    cancel: () => {
      try {
        if (rec.state !== 'inactive') rec.stop();
      } catch {
        /* déjà arrêté */
      }
      release();
    },
  };
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
// Une lecture interrompue doit tenir sa promesse : sans ça, un enchaînement
// qui l'attend resterait bloqué pour toujours (« pause » en mode écoute).
let currentResolve = null;

function stopAll() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentResolve) {
    const resolve = currentResolve;
    currentResolve = null;
    resolve();
  }
}

/** Coupe tout ce qui joue. */
export function stop() {
  stopAll();
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

    // Certains appareils ne déclenchent jamais onend. Sans ce garde-fou, une
    // lecture enchaînée (mode écoute, comparaison) resterait bloquée.
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      resolve();
    };
    const guard = setTimeout(finish, 2000 + text.length * 180);

    u.onend = u.onerror = finish;
    window.speechSynthesis.speak(u);
  });
}

// Quand la famille a enregistré ses voix, elle peut interdire la synthèse :
// les enfants n'entendent alors que du vrai darija, ou rien.
let synthesisAllowed = true;
export const setSynthesisAllowed = (v) => { synthesisAllowed = v; };
export const isSynthetic = (item) => !recordedIds.has(item.id);

/**
 * Joue un mot en darija : l'enregistrement d'un locuteur natif s'il existe,
 * sinon la synthèse arabe (approximative), sinon rien.
 */
export async function playItem(item, { slow = false } = {}) {
  stopAll();
  const url = await getClipUrl(item.id);
  if (url) {
    await playUrl(url, { rate: slow ? 0.7 : 1 });
    return;
  }
  if (!synthesisAllowed) return;
  const text = item.ar || item.dr;
  await speak(text, ['ar-ma', 'ar'], slow ? 0.6 : 0.85);
}

/** Joue un fichier et ne rend la main qu'à la fin, pour pouvoir enchaîner. */
export function playUrl(url, { rate = 1 } = {}) {
  stopAll();
  return new Promise((resolve) => {
    const a = new Audio(url);
    a.playbackRate = rate;
    currentAudio = a;
    currentResolve = resolve;
    const done = () => {
      if (currentResolve === resolve) currentResolve = null;
      resolve();
    };
    a.onended = a.onerror = done;
    a.play().catch(done);
  });
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
