// Mini-histoires : des phrases enchaînées, construites presque uniquement avec
// le vocabulaire des thèmes. C'est l'étape d'après les mots isolés — on suit une
// scène, on comprend le sens général sans traduire mot à mot.
//
// Chaque scène a un identifiant : elle peut donc être enregistrée en vraie voix
// dans le studio, exactement comme un mot.

const sc = (id, emoji, fr, dr, ar) => ({ id, emoji, fr, dr, ar });
const q = (ask, options) => ({ ask, options });

export const STORIES = [
  {
    id: 'sba7',
    title: 'Le matin chez nous',
    emoji: '🌅',
    color: '#f59e0b',
    scenes: [
      sc('st_sba7_1', '🌅', 'Bonjour ! Le soleil est levé.', 'Sba7 lkhir! Chems tal3a.', 'صباح الخير! شمس طالعة'),
      sc('st_sba7_2', '🛌', 'Je me lève du lit.', 'Kannod men lfrach.', 'كنوض من الفراش'),
      sc('st_sba7_3', '🧼', 'Je me lave les mains.', 'Kanghsel yeddi.', 'كنغسل يدي'),
      sc('st_sba7_4', '🍞', 'Je mange du pain avec du lait.', 'Kanakol lkhobz m3a l7lib.', 'كناكل الخبز مع الحليب'),
      sc('st_sba7_5', '🍵', 'Papa boit du thé.', 'Baba kaychreb atay.', 'بابا كيشرب أتاي'),
      sc('st_sba7_6', '🎒', 'Je prends mon sac.', 'Kanakhod sak dyali.', 'كناخد ساك ديالي'),
      sc('st_sba7_7', '🏫', 'Allez, on va à l’école !', 'Yallah, nemchiw l lmdrasa!', 'يالله، نمشيو للمدرسة'),
      sc('st_sba7_8', '👋', 'Au revoir maman !', 'Bslama a mama!', 'بسلامة أ ماما'),
    ],
    questions: [
      q('Qu’est-ce que l’enfant mange ?', [
        { emoji: '🍞', fr: 'Du pain', ok: true },
        { emoji: '🍫', fr: 'Du chocolat' },
        { emoji: '🥩', fr: 'De la viande' },
      ]),
      q('Qu’est-ce que papa boit ?', [
        { emoji: '🍵', fr: 'Du thé', ok: true },
        { emoji: '🥛', fr: 'Du lait' },
        { emoji: '🧃', fr: 'Du jus' },
      ]),
      q('Où va-t-il à la fin ?', [
        { emoji: '🏫', fr: 'À l’école', ok: true },
        { emoji: '🏖️', fr: 'À la plage' },
        { emoji: '🛒', fr: 'Au marché' },
      ]),
    ],
  },
  {
    id: 'souk',
    title: 'Au marché',
    emoji: '🛒',
    color: '#0284c7',
    scenes: [
      sc('st_souk_1', '🛒', 'On va au marché avec maman.', 'Nemchiw l souk m3a mama.', 'نمشيو للسوق مع ماما'),
      sc('st_souk_2', '🍎', 'Je voudrais une pomme, s’il te plaît.', 'Bghit teffa7a 3afak.', 'بغيت تفاحة عافاك'),
      sc('st_souk_3', '💰', 'Combien ça coûte ?', 'Ch7al hada?', 'شحال هادا؟'),
      sc('st_souk_4', '🔟', 'Dix dirhams.', '3achra dirham.', 'عشرة درهم'),
      sc('st_souk_5', '🍊', 'Maman achète des oranges.', 'Mama katchri letchina.', 'ماما كتشري لتشينة'),
      sc('st_souk_6', '🥕', 'Et des carottes et des tomates.', 'W khizzou w matecha.', 'و خيزو و مطيشة'),
      sc('st_souk_7', '🙏', 'Merci beaucoup !', 'Choukran bzzaf!', 'شكرا بزاف'),
      sc('st_souk_8', '🏠', 'On rentre à la maison.', 'Nemchiw l dar.', 'نمشيو لدار'),
    ],
    questions: [
      q('Avec qui va-t-il au marché ?', [
        { emoji: '👩', fr: 'Maman', ok: true },
        { emoji: '👨', fr: 'Papa' },
        { emoji: '👴', fr: 'Grand-père' },
      ]),
      q('Combien coûte la pomme ?', [
        { emoji: '🔟', fr: 'Dix', ok: true },
        { emoji: '2️⃣', fr: 'Deux' },
        { emoji: '💯', fr: 'Cent' },
      ]),
      q('Qu’est-ce que maman achète ?', [
        { emoji: '🍊', fr: 'Des oranges', ok: true },
        { emoji: '🐟', fr: 'Du poisson' },
        { emoji: '🧀', fr: 'Du fromage' },
      ]),
    ],
  },
  {
    id: 'mech',
    title: 'Où est mon chat ?',
    emoji: '🐱',
    color: '#f97316',
    scenes: [
      sc('st_mech_1', '🐱', 'J’ai un petit chat.', '3endi mech sghir.', 'عندي مش صغير'),
      sc('st_mech_2', '❓', 'Où est mon chat ?', 'Fin mech dyali?', 'فين مش ديالي؟'),
      sc('st_mech_3', '🛏️', 'Est-ce qu’il est sous le lit ?', 'Wach howa ta7t lfrach?', 'واش هو تحت الفراش؟'),
      sc('st_mech_4', '❌', 'Non, il n’est pas là.', 'Lla, ma kaynch.', 'لا، ما كاينش'),
      sc('st_mech_5', '🪑', 'Est-ce qu’il est sur la table ?', 'Wach howa fou9 tabla?', 'واش هو فوق الطبلة؟'),
      sc('st_mech_6', '🪟', 'Regarde ! Il est près de la fenêtre.', 'Chouf! Howa 7da cherjem.', 'شوف! هو حدا الشرجم'),
      sc('st_mech_7', '😄', 'Je suis très content !', 'Ana fer7an bzzaf!', 'أنا فرحان بزاف'),
      sc('st_mech_8', '🥛', 'Donne-moi du lait, maman, s’il te plaît.', '3tini 7lib a mama, 3afak.', 'عطيني حليب أ ماما، عافاك'),
    ],
    questions: [
      q('Quel animal cherche-t-il ?', [
        { emoji: '🐱', fr: 'Un chat', ok: true },
        { emoji: '🐶', fr: 'Un chien' },
        { emoji: '🐦', fr: 'Un oiseau' },
      ]),
      q('Où était le chat ?', [
        { emoji: '🪟', fr: 'Près de la fenêtre', ok: true },
        { emoji: '🛏️', fr: 'Sous le lit' },
        { emoji: '🪑', fr: 'Sur la table' },
      ]),
      q('Qu’est-ce qu’il demande à la fin ?', [
        { emoji: '🥛', fr: 'Du lait', ok: true },
        { emoji: '🍞', fr: 'Du pain', },
        { emoji: '💧', fr: 'De l’eau' },
      ]),
    ],
  },
  {
    id: 'milad',
    title: 'L’anniversaire',
    emoji: '🎂',
    color: '#facc15',
    scenes: [
      sc('st_milad_1', '🎂', 'Aujourd’hui, c’est l’anniversaire de ma sœur.', 'Lyoum 3id milad dyal khti.', 'اليوم عيد ميلاد ديال ختي'),
      sc('st_milad_2', '🎊', 'Il y a une fête à la maison.', 'Kayna 7efla f dar.', 'كاينة حفلة فدار'),
      sc('st_milad_3', '🎁', 'Voici son cadeau.', 'Hadi hdiya dyalha.', 'هادي هدية ديالها'),
      sc('st_milad_4', '🍰', 'On mange un très bon gâteau.', 'Kanaklou tourta bnina bzzaf.', 'كناكلو تورطة بنينة بزاف'),
      sc('st_milad_5', '🎤', 'On chante et on danse.', 'Kanghenniw w kanchet7ou.', 'كنغنيو و كنشطحو'),
      sc('st_milad_6', '😂', 'Tout le monde rit.', 'Koulchi kaydhek.', 'كلشي كيضحك'),
      sc('st_milad_7', '🎉', 'Félicitations, ma sœur !', 'Mbrouk a khti!', 'مبروك أ ختي'),
      sc('st_milad_8', '🌙', 'Bonne nuit à tous.', 'Tsbe7ou 3la khir.', 'تصبحو على خير'),
    ],
    questions: [
      q('C’est l’anniversaire de qui ?', [
        { emoji: '👧', fr: 'De sa sœur', ok: true },
        { emoji: '👦', fr: 'De son frère' },
        { emoji: '👵', fr: 'De sa grand-mère' },
      ]),
      q('Qu’est-ce qu’on mange ?', [
        { emoji: '🍰', fr: 'Un gâteau', ok: true },
        { emoji: '🍲', fr: 'Du couscous' },
        { emoji: '🍗', fr: 'Du poulet' },
      ]),
      q('Qu’est-ce qu’on fait à la fête ?', [
        { emoji: '🎤', fr: 'On chante', ok: true },
        { emoji: '😴', fr: 'On dort' },
        { emoji: '📖', fr: 'On lit' },
      ]),
    ],
  },
  {
    id: 'b7ar',
    title: 'À la mer',
    emoji: '🌊',
    color: '#0891b2',
    scenes: [
      sc('st_b7ar_1', '🌊', 'On va à la mer !', 'Nemchiw l lb7ar!', 'نمشيو للبحر'),
      sc('st_b7ar_2', '☀️', 'Le soleil est très chaud.', 'Chems skhouna bzzaf.', 'شمس سخونة بزاف'),
      sc('st_b7ar_3', '🏖️', 'Je joue dans le sable.', 'Kanl3eb f rmel.', 'كنلعب فالرمل'),
      sc('st_b7ar_4', '🐟', 'Regarde, il y a un petit poisson !', 'Chouf, kayn 7out sghir!', 'شوف، كاين حوت صغير'),
      sc('st_b7ar_5', '🥤', 'J’ai soif, je veux de l’eau.', 'Ana 3atchan, bghit lma.', 'أنا عطشان، بغيت الما'),
      sc('st_b7ar_6', '🍊', 'Maman me donne une orange.', 'Mama kat3tini letchina.', 'ماما كتعطيني لتشينة'),
      sc('st_b7ar_7', '😩', 'Maintenant je suis fatigué.', 'Daba ana 3ayan.', 'دابا أنا عيان'),
      sc('st_b7ar_8', '🏠', 'On rentre. Au revoir la mer !', 'Nemchiw l dar. Bslama a b7ar!', 'نمشيو لدار. بسلامة أ بحر'),
    ],
    questions: [
      q('Où vont-ils ?', [
        { emoji: '🌊', fr: 'À la mer', ok: true },
        { emoji: '⛰️', fr: 'À la montagne' },
        { emoji: '🏫', fr: 'À l’école' },
      ]),
      q('Comment est le soleil ?', [
        { emoji: '🔥', fr: 'Chaud', ok: true },
        { emoji: '❄️', fr: 'Froid' },
        { emoji: '🌫️', fr: 'Gris' },
      ]),
      q('Qu’est-ce que maman lui donne ?', [
        { emoji: '🍊', fr: 'Une orange', ok: true },
        { emoji: '🍌', fr: 'Une banane' },
        { emoji: '🍬', fr: 'Un bonbon' },
      ]),
    ],
  },
];

export const STORY_BY_ID = Object.fromEntries(STORIES.map((s) => [s.id, s]));

/**
 * Les mots de l'histoire déjà rencontrés ailleurs dans l'app.
 * Le repérage est approximatif — on compare les mots un à un, sans les
 * conjugaisons — mais il ne sert qu'à afficher un indicateur.
 */
const clean = (w) => w.toLowerCase().replace(/[^a-z0-9’']/g, '');

export function storyWordIds(story, allItems) {
  const byWord = new Map();
  for (const it of allItems) {
    if (it.dr.includes(' ')) continue; // on ne compare que les mots isolés
    byWord.set(clean(it.dr), it.id);
  }
  const found = new Set();
  for (const scene of story.scenes) {
    for (const token of scene.dr.split(/\s+/)) {
      const id = byWord.get(clean(token));
      if (id) found.add(id);
    }
  }
  return [...found];
}

/** Les histoires vues comme des thèmes enregistrables dans le studio. */
export const STORY_UNITS = STORIES.map((s) => ({
  id: 'story-' + s.id,
  title: 'Histoire · ' + s.title,
  emoji: '📖',
  color: s.color,
  items: s.scenes,
}));
