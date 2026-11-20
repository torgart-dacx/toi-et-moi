// Сквозные мотивы сборника: по каким словам (FR и RU) стих «звучит» этим образом.
// Корни подобраны по текстам книги; совпадение ищется в начале слова.
export const MOTIFS = [
  { id: 'roses', ru: 'Розы и сад', fr: 'Les roses', color: '#ff6f91',
    re: /(?<![\p{L}])(роз[аыуео]?|шип|цвет[оу]?к|цветк|сад|весн|лепест|rose|fleur|épine|epine|jardin|printemps|pétale)/iu },
  { id: 'sea', ru: 'Море и реки', fr: 'La mer', color: '#5fc8ff',
    re: /(?<![\p{L}])(океан|мор[ея]|морск|волн|вал\b|рек[аиеу]|речн|берег|вод[аеуы]|пучин|севан|mer\b|mers\b|océan|ocean|vague|rivière|riviere|fleuve|eau|rive|sevan|onde)/iu },
  { id: 'fire', ru: 'Огонь и пепел', fr: 'Le feu', color: '#ff9a3c',
    re: /(?<![\p{L}])(огн|огон|плам|горю|горел|горит|пыла|пепел|пепл|жечь|жгу|искр|таю|feu|flamme|brûl|brul|cendre|ardent|braise|fond)/iu },
  { id: 'sky', ru: 'Небо и звёзды', fr: 'Le ciel', color: '#a99bff',
    re: /(?<![\p{L}])(неб[оеау]|небес|звёзд|звезд|космич|лунн|луна|облак|внеземн|меридиан|ciel|cieux|étoile|etoile|lune|nuage|cosmi|univers|astr)/iu },
  { id: 'eyes', ru: 'Глаза и взгляд', fr: 'Le regard', color: '#7fe0c0',
    re: /(?<![\p{L}])(глаз|взгляд|взор|смотр|гляж|зеркал|yeux|œil|oeil|regard|miroir|reflet)/iu },
  { id: 'tears', ru: 'Слёзы и боль', fr: 'Les larmes', color: '#8fb4ff',
    re: /(?<![\p{L}])(сл[её]з|слеза|бол[ьию]|мук|тоск|печал|грус|larme|douleur|peine|triste|souffr|mal\b|chagrin)/iu },
  { id: 'eternity', ru: 'Вечность и время', fr: 'L’éternité', color: '#ffd166',
    re: /(?<![\p{L}])(вечн|вовек|навечн|бесконечн|тысяч|врем|мгновен|éternel|eternel|toujours|jamais|mille|temps|instant|moment)/iu },
  { id: 'parting', ru: 'Разлука и ожидание', fr: 'L’absence', color: '#d9a7ff',
    re: /(?<![\p{L}])(разлук|скуча|прощ|ждать|жду|далек|забудь|разошл|приезжа|adieu|loin|attend|manque|quitt|sépar|separ|partir|départ|depart|oubli)/iu },
  { id: 'yerevan', ru: 'Ереван', fr: 'Erevan', color: '#ffb38a',
    re: /(?<![\p{L}])(ереван|цицернакаберд|севан|ступеньк|yerevan|erevan|sevan|tsitsernakaberd|marches)/iu },
];
// какие мотивы есть в стихе и сколько раз
export function motifsOf(poem) {
  const text = [...(poem.fr?.lines || []), ...(poem.ru?.lines || []), poem.fr?.title || '', poem.ru?.title || '', poem.fr?.sign || '', poem.ru?.sign || ''].join('\n');
  const out = {};
  for (const m of MOTIFS) { const g = new RegExp(m.re.source, 'giu'); const n = (text.match(g) || []).length; if (n) out[m.id] = n; }
  return out;
}
