// Reconnaissance vocale : entièrement facultative.
//
// Deux limites à garder en tête, elles justifient l'option désactivée par défaut :
// le navigateur envoie l'audio à un service en ligne (Chrome passe par Google),
// et aucun moteur ne connaît le darija — « ar-MA » reste un modèle d'arabe
// standard, qui refuse souvent une prononciation marocaine correcte.
// On s'en sert donc comme d'un indice, jamais comme d'un verdict.

const Ctor = () => window.SpeechRecognition || window.webkitSpeechRecognition;

export const available = () => !!Ctor();

/**
 * Écoute une fois et renvoie les hypothèses du moteur, la meilleure en premier.
 * @returns {Promise<{text: string, confidence: number}[]>}
 */
export function listen({ lang = 'ar-MA', timeoutMs = 7000 } = {}) {
  const Rec = Ctor();
  if (!Rec) return Promise.reject(new Error('Cet appareil ne sait pas écouter.'));

  return new Promise((resolve, reject) => {
    const rec = new Rec();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 3;

    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { rec.abort(); } catch { /* déjà arrêté */ }
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('Je n’ai rien entendu.')), timeoutMs);

    rec.onresult = (e) => {
      const alts = Array.from(e.results[0]).map((r) => ({
        text: r.transcript,
        confidence: r.confidence ?? 0,
      }));
      finish(resolve, alts);
    };
    rec.onerror = (e) => {
      const msg = {
        'not-allowed': 'Micro refusé par le navigateur.',
        'service-not-allowed': 'Service d’écoute indisponible.',
        'no-speech': 'Je n’ai rien entendu.',
        network: 'Pas de connexion : l’écoute automatique a besoin d’Internet.',
      }[e.error] || `Écoute impossible (${e.error}).`;
      finish(reject, new Error(msg));
    };
    rec.onend = () => finish(reject, new Error('Je n’ai rien entendu.'));

    try {
      rec.start();
    } catch (e) {
      finish(reject, new Error('Écoute déjà en cours.'));
    }
  });
}

// --- Comparaison souple ----------------------------------------------------

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Ramène deux graphies arabes à une forme comparable. */
export function normalizeAr(s) {
  return (s || '')
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^؀-ۿ\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0 = rien à voir, 1 = identique. */
export function similarity(a, b) {
  const x = normalizeAr(a);
  const y = normalizeAr(b);
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

/** Meilleure correspondance parmi les hypothèses du moteur. */
export function bestMatch(alternatives, expectedAr) {
  let best = { text: '', score: 0 };
  for (const alt of alternatives) {
    const score = similarity(alt.text, expectedAr);
    if (score > best.score) best = { text: alt.text, score };
  }
  return best.text ? best : { text: alternatives[0]?.text || '', score: 0 };
}
