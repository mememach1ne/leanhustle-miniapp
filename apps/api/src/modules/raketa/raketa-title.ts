import {
  type DeliveryProfileKey,
} from '../pricing/data/delivery-price-table.data';
import { matchDeliveryProfile } from '../pricing/data/delivery-price-table';

/** RAKETA rejects Latin letters in item titles — Russian item type per profile. */
const ITEM_TYPE_RU: Record<DeliveryProfileKey, string> = {
  sneakers: 'Кроссовки',
  boots: 'Ботинки',
  slides: 'Шлёпанцы',
  loafers: 'Туфли',
  tshirt: 'Футболка',
  longsleeve: 'Лонгслив',
  hoodie: 'Худи',
  sweatshirt: 'Свитшот',
  shorts: 'Шорты',
  pants: 'Брюки',
  jeans: 'Джинсы',
  windbreaker: 'Ветровка',
  jacket: 'Куртка',
  down_jacket: 'Пуховик',
  vest: 'Жилетка',
  dress: 'Платье',
  underwear: 'Бельё',
  watch: 'Часы',
  smartwatch: 'Смарт-часы',
  glasses: 'Очки',
  crossbody: 'Сумка',
  bag: 'Сумка',
  backpack: 'Рюкзак',
  travel_bag: 'Дорожная сумка',
  cap: 'Кепка',
  beanie_scarf: 'Шапка',
  belt_wallet: 'Аксессуар',
  jewelry: 'Украшение',
  phone_case: 'Чехол для телефона',
  perfume: 'Парфюм',
  cosmetics: 'Косметика',
  phone: 'Телефон',
  headphones: 'Наушники',
  powerbank: 'Аккумулятор',
  gamepad: 'Геймпад',
  hairdryer: 'Фен',
  camera: 'Фотоаппарат',
  ball: 'Мяч',
};

/** Common brands as people say them in Russian (longest names first when matching). */
const BRANDS_RU: Record<string, string> = {
  'air jordan': 'Аир Джордан',
  'new balance': 'Нью Баланс',
  'the north face': 'Норт Фейс',
  'north face': 'Норт Фейс',
  'onitsuka tiger': 'Онитсука Тайгер',
  'stone island': 'Стон Айленд',
  'canada goose': 'Канада Гус',
  'ralph lauren': 'Ральф Лорен',
  'polo ralph lauren': 'Поло Ральф Лорен',
  'calvin klein': 'Кельвин Кляйн',
  'tommy hilfiger': 'Томми Хилфигер',
  'louis vuitton': 'Луи Виттон',
  'yves saint laurent': 'Ив Сен Лоран',
  'saint laurent': 'Сен Лоран',
  'fear of god': 'Фир оф Год',
  'off-white': 'Офф Вайт',
  'off white': 'Офф Вайт',
  'mihara yasuhiro': 'Михара Ясухиро',
  'maison margiela': 'Мейсон Маржела',
  'alexander mcqueen': 'Александр Маккуин',
  'under armour': 'Андер Армор',
  'li-ning': 'Ли Нинг',
  'li ning': 'Ли Нинг',
  'anta': 'Анта',
  'nike': 'Найк',
  'jordan': 'Джордан',
  'adidas': 'Адидас',
  'yeezy': 'Изи',
  'puma': 'Пума',
  'reebok': 'Рибок',
  'asics': 'Асикс',
  'vans': 'Ванс',
  'converse': 'Конверс',
  'salomon': 'Саломон',
  'hoka': 'Хока',
  'mizuno': 'Мизуно',
  'saucony': 'Сакони',
  'timberland': 'Тимберленд',
  'dr.martens': 'Доктор Мартинс',
  'dr. martens': 'Доктор Мартинс',
  'ugg': 'Угги',
  'crocs': 'Крокс',
  'birkenstock': 'Биркеншток',
  'balenciaga': 'Баленсиага',
  'gucci': 'Гуччи',
  'prada': 'Прада',
  'dior': 'Диор',
  'fendi': 'Фенди',
  'chanel': 'Шанель',
  'hermes': 'Гермес',
  'versace': 'Версаче',
  'moncler': 'Монклер',
  'burberry': 'Барберри',
  'lacoste': 'Лакост',
  'supreme': 'Суприм',
  'stussy': 'Стусси',
  'carhartt': 'Кархарт',
  'champion': 'Чемпион',
  'levis': 'Левайс',
  "levi's": 'Левайс',
  'uniqlo': 'Юникло',
  'zara': 'Зара',
  'arcteryx': 'Артерикс',
  "arc'teryx": 'Артерикс',
  'patagonia': 'Патагония',
  'columbia': 'Коламбия',
  'mlb': 'МЛБ',
  'casio': 'Касио',
  'seiko': 'Сейко',
  'citizen': 'Ситизен',
  'swatch': 'Свотч',
  'apple': 'Эппл',
  'xiaomi': 'Сяоми',
  'huawei': 'Хуавей',
  'samsung': 'Самсунг',
  'sony': 'Сони',
  'dyson': 'Дайсон',
  'bape': 'Бейп',
  'a bathing ape': 'Бейп',
  'chrome hearts': 'Хром Хартс',
  'rick owens': 'Рик Оуэнс',
  'golden goose': 'Голден Гус',
  'on': 'Он',
};

const LETTERS: Record<string, string> = {
  a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'дж',
  k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т',
  u: 'у', v: 'в', w: 'в', x: 'кс', y: 'й', z: 'з',
};
const DIGRAPHS: Array<[RegExp, string]> = [
  [/sh/g, 'ш'], [/ch/g, 'ч'], [/zh/g, 'ж'], [/kh/g, 'х'], [/ph/g, 'ф'],
  [/th/g, 'т'], [/oo/g, 'у'], [/ee/g, 'и'], [/ck/g, 'к'], [/qu/g, 'кв'],
];

/** Rough phonetic transliteration for words not in the brand dictionary. */
export function transliterate(text: string): string {
  let out = text.toLowerCase();
  for (const [pattern, ru] of DIGRAPHS) out = out.replace(pattern, ru);
  out = out.replace(/[a-z]/g, (ch) => LETTERS[ch] ?? '');
  return out.replace(/(^|\s)(\S)/g, (m, sp: string, ch: string) => sp + ch.toUpperCase());
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function findBrand(text: string): { ru: string; rest: string } | null {
  const lower = text.toLowerCase();
  const keys = Object.keys(BRANDS_RU).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const re = new RegExp(`(^|[^a-z])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
    const m = re.exec(lower);
    if (m) {
      const start = m.index + m[1].length;
      return { ru: BRANDS_RU[key], rest: text.slice(start + key.length) };
    }
  }
  return null;
}

/** Popular model names as they're said in Russian. */
const MODELS_RU: Record<string, string> = {
  dunk: 'Данк', air: 'Эйр', force: 'Форс', max: 'Макс', jordan: 'Джордан',
  samba: 'Самба', gazelle: 'Газель', campus: 'Кампус', forum: 'Форум',
  superstar: 'Суперстар', spezial: 'Спешиал', boost: 'Буст', yeezy: 'Изи',
  cortez: 'Кортез', blazer: 'Блейзер', vomero: 'Вомеро', pegasus: 'Пегасус',
  tech: 'Тек', fleece: 'Флис', old: 'Олд', skool: 'Скул', chuck: 'Чак',
  taylor: 'Тейлор', gel: 'Гель', kayano: 'Каяно', speedcross: 'Спидкросс',
  clifton: 'Клифтон', bondi: 'Бонди', classic: 'Классик', retro: 'Ретро',
};

/** Words that only describe the category / audience / colour — not the model. */
const FILLER = new RegExp(
  '^(' +
    [
      'mens?', 'womens?', 'unisex', 'originals', 'kids?', 'gs', 'ps', 'td', 'shoes?', 'sneakers?',
      'running', 'basketball', 'casual', 'skateboard', 'training', 'sports?', 'original',
      'sole', 'logo', 'basic', 'wip', 'hoodie', 't-?shirt', 'tee', 'pants', 'jacket',
      'white', 'black', 'grey', 'gray', 'red', 'blue', 'green', 'pink', 'beige', 'brown',
      'silver', 'gold', 'low', 'mid', 'high', 'top', 'the', 'and', 'with',
    ].join('|') +
    ')$',
  'i',
);

/** Model words worth keeping (e.g. "Dunk", "Air Force 1"), in Russian. */
function modelWords(rest: string, max = 2): string {
  const words = rest
    .replace(/['’]/g, '')
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .split(/\s+/)
    // Drop fillers and long article codes like "SWFA117J" / "CZ5678"; keep
    // short model codes such as "V5" or "4D".
    .filter((w) => w && !FILLER.test(w) && !(w.length > 3 && /\d/.test(w) && /[a-z]/i.test(w)))
    .slice(0, max);
  return words
    .map((w) => {
      if (/^\d+$/.test(w)) return w;
      const known = MODELS_RU[w.toLowerCase()];
      if (known) return known;
      // Short codes: spell letters as Russian capitals ("V5" -> "В5").
      if (w.length <= 3 && /\d/.test(w)) return transliterate(w).toUpperCase();
      return transliterate(w);
    })
    .join(' ')
    .trim();
}

/**
 * Russian, Latin-free item title for RAKETA, e.g. "Кроссовки Найк Данк".
 * RAKETA validation: no Latin letters, no standalone word "зип".
 */
export function buildRaketaItemTitle(input: {
  title: string;
  categoryL1?: string | null;
  categoryL2?: string | null;
  categoryL3?: string | null;
}): string {
  const profile = matchDeliveryProfile(input);
  const type = profile ? ITEM_TYPE_RU[profile] : 'Товар';
  const brand = findBrand(input.title);
  const tail = brand
    ? `${brand.ru} ${modelWords(brand.rest)}`
    : modelWords(input.title);
  const title = `${type} ${tail}`
    .replace(/[A-Za-z]/g, '')
    .replace(/(^|\s)зип(\s|$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return capitalize(title).slice(0, 120);
}
