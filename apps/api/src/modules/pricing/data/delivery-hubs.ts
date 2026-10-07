// Million-plus cities used as delivery price points. CDEK carries a parcel to
// the nearest big city first, so the price to the hub is close enough for any
// town in its area. IDs are from the RAKETA city directory (FIAS).

export interface DeliveryHub {
  key: string;
  /** Name in the prepositional-free form, e.g. «Казань». */
  name: string;
  cityId: string;
}

export const DELIVERY_HUBS = {
  moscow: { key: 'moscow', name: 'Москва', cityId: '0c5b2444-70a0-4932-980c-b4dc0d3f02b5' },
  spb: { key: 'spb', name: 'Санкт-Петербург', cityId: 'c2deb16a-0330-4f05-821f-1d09c93331e6' },
  novosibirsk: { key: 'novosibirsk', name: 'Новосибирск', cityId: '8dea00e3-9aab-4d8e-887c-ef2aaa546456' },
  ekaterinburg: { key: 'ekaterinburg', name: 'Екатеринбург', cityId: '2763c110-cb8b-416a-9dac-ad28a55b4402' },
  kazan: { key: 'kazan', name: 'Казань', cityId: '93b3df57-4c89-44df-ac42-96f05e9cd3b9' },
  nnovgorod: { key: 'nnovgorod', name: 'Нижний Новгород', cityId: '555e7d61-d9a7-4ba6-9770-6caa8198c483' },
  krasnoyarsk: { key: 'krasnoyarsk', name: 'Красноярск', cityId: '9b968c73-f4d4-4012-8da8-3dacd4d4c1bd' },
  chelyabinsk: { key: 'chelyabinsk', name: 'Челябинск', cityId: 'a376e68d-724a-4472-be7c-891bdb09ae32' },
  samara: { key: 'samara', name: 'Самара', cityId: 'bb035cc3-1dc2-4627-9d25-a1bf2d4b936b' },
  ufa: { key: 'ufa', name: 'Уфа', cityId: '7339e834-2cb4-4734-a4c7-1fca2c66e562' },
  rostov: { key: 'rostov', name: 'Ростов-на-Дону', cityId: 'c1cfe4b9-f7c2-423c-abfa-6ed1c05a15c5' },
  krasnodar: { key: 'krasnodar', name: 'Краснодар', cityId: '7dfa745e-aa19-4688-b121-b655c11e482f' },
  omsk: { key: 'omsk', name: 'Омск', cityId: '140e31da-27bf-4519-9ea0-6185d681d44e' },
  voronezh: { key: 'voronezh', name: 'Воронеж', cityId: '5bf5ddff-6353-4a3d-80c4-6fb27f00c6c1' },
  perm: { key: 'perm', name: 'Пермь', cityId: 'a309e4ce-2f36-4106-b1ca-53e0f48a6d95' },
  volgograd: { key: 'volgograd', name: 'Волгоград', cityId: 'a52b7389-0cfe-46fb-ae15-298652a64cf8' },
} as const satisfies Record<string, DeliveryHub>;

type HubKey = keyof typeof DELIVERY_HUBS;

/**
 * Region (as in the RAKETA directory: «Ивановская обл», «респ Татарстан»,
 * «Красноярский край») → nearest million-plus city by distance. Ordered:
 * first match wins, so «томск» goes before «омск», «ямало» before «ненецк»,
 * «сахалин» before «саха».
 */
const REGION_RULES: Array<[RegExp, HubKey]> = [
  [/томск/, 'novosibirsk'],
  [/омск/, 'omsk'],
  [/ямало/, 'ekaterinburg'],
  [/ненецк/, 'perm'],
  [/сахалин/, 'krasnoyarsk'],
  [/(^|\s)саха($|\s|\W)|якут/, 'krasnoyarsk'],
  // Central Russia
  [/москв|московск|твер|калуж|туль|рязан|владимир|ярослав|смоленск|брянск|вологод/, 'moscow'],
  [/нижегород|иванов|костром|мордов/, 'nnovgorod'],
  [/воронеж|белгород|курская|липецк|тамбов|орлов/, 'voronezh'],
  // North-West
  [/петербург|ленинград|новгородск|псков|карел|мурманск|архангельск|калининград/, 'spb'],
  // Volga
  [/татарстан|марий|чуваш|кировск/, 'kazan'],
  [/самарск|ульянов|пенз/, 'samara'],
  [/башкорт|оренбург/, 'ufa'],
  [/пермск|удмурт|(^|\s)коми($|\s|\W)/, 'perm'],
  [/волгоград|астрахан|калмык|саратов|дагестан/, 'volgograd'],
  // South
  [/краснодар|адыге|крым|севастопол|ставропол|кабардин|карачаев|осети|ингуш|чечен/, 'krasnodar'],
  [/ростов|донецк|луганск|запорож|херсон/, 'rostov'],
  // Urals
  [/свердлов|тюмен|ханты/, 'ekaterinburg'],
  [/челябинск|курганск/, 'chelyabinsk'],
  // Siberia & Far East
  [/новосибирск|кемеров|кузбасс|алтай/, 'novosibirsk'],
  [/красноярск|хакас|тыва|иркутск|бурят|забайкал|амурск|хабаровск|приморск|еврейск|камчат|магадан|чукот/, 'krasnoyarsk'],
];

/** Nearest million-plus city for a region; Moscow when unknown. */
export function hubForRegion(region: string | null | undefined, city?: string | null): DeliveryHub {
  // Region only: town names («Ростов», «Орлов», «Кировск») would mislead.
  const text = (region?.trim() || city || '').toLowerCase().replace(/ё/g, 'е');
  for (const [re, key] of REGION_RULES) {
    if (re.test(text)) return DELIVERY_HUBS[key];
  }
  return DELIVERY_HUBS.moscow;
}
