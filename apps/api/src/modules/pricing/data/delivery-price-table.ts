import { DeliveryCategory } from '@lean-poizon/shared';

import {
  DELIVERY_PRICE_PROFILES,
  type DeliveryPriceBand,
  type DeliveryProfileKey,
} from './delivery-price-table.data';

export interface TableDeliveryEstimate {
  profile: DeliveryProfileKey;
  band: DeliveryPriceBand;
  deliveryRub: number;
  weightKg: number;
}

type Rule = [DeliveryProfileKey, RegExp];

/**
 * Ordered rules: first match wins. Matched against the Poizon category chain
 * (L3 > L2 > L1) first and only then against the product title, so a
 * category always beats a word that happens to be in the title.
 */
const RULES: Rule[] = [
  // Electronics & small goods
  ['smartwatch', /smart ?watch/],
  ['watch', /\bwatch(es)?\b/],
  ['glasses', /glasses|sunglass|eyewear|goggles/],
  ['phone_case', /phone (case|cover)|cases? for/],
  ['phone', /smartphone|cell phones?$/],
  ['powerbank', /power ?bank|charger/],
  ['headphones', /earbud|headphone|earphone|airpods|speaker/],
  ['gamepad', /gamepad|game controller|joystick/],
  ['hairdryer', /hair dryer|hair styling/],
  ['camera', /camera/],
  ['perfume', /perfume|cologne|fragrance|eau de/],
  ['cosmetics', /skincare|skin care|makeup|hair care|beauty|cosmetic|toiletr|hair mask/],
  ['jewelry', /jewel|necklace|bracelet|earring|\brings?\b|pendant/],

  // Footwear
  ['boots', /\bboots?\b/],
  ['slides', /slipper|sandal|\bslides?\b|clog|flip.?flop|birkenstock/],
  ['loafers', /loafer|moccasin|leather shoes|oxford|derby/],
  ['sneakers', /shoe|sneaker|trainer|footwear/],

  // Bags & accessories
  ['travel_bag', /travel bag|luggage|gym bag|duffel|suitcase/],
  ['backpack', /backpack/],
  ['crossbody', /crossbody|cross-body|shoulder bag|waist bag|belt bag|sling|斜挎包/],
  ['bag', /\bbags?\b|handbag|tote|purse/],
  ['cap', /\bcaps?\b|\bhats?\b|bucket hat/],
  ['beanie_scarf', /beanie|scar(f|ves)|shawl|gloves/],
  ['belt_wallet', /\bbelts?\b|wallet|card ?holder|keychain/],

  // Apparel (bottoms before jackets: "Windbreaker Pants" are pants)
  ['underwear', /underwear|boxer|briefs|socks|\bbras?\b|thermal|lingerie/],
  ['jeans', /jeans|denim pants/],
  ['shorts', /shorts/],
  ['pants', /pants|trousers|sweatpants|joggers|leggings/],
  ['dress', /dress|skirt/],
  ['vest', /\bvests?\b|gilet/],
  ['down_jacket', /down (jacket|coat)|puffer|parka|cotton.?padded/],
  ['windbreaker', /windbreaker|light jacket|sun.?protection|softshell/],
  ['jacket', /jacket|coat|bomber|blazer|outerwear/],
  ['hoodie', /hoodie|hooded/],
  ['sweatshirt', /sweatshirt|crewneck|sweater|knit|cardigan/],
  ['longsleeve', /long.?sleeve|jersey/],
  ['tshirt', /t-?shirt|\btees?\b|polo|\bshirts?\b|tank top|\btops?\b/],

  // Sports
  ['ball', /^(basketball|football|soccer ball|volleyball|balls?)$/],
];

/** Manual calculator: the customer picks one of our enum categories. */
const ENUM_TO_PROFILE: Partial<Record<DeliveryCategory, DeliveryProfileKey>> = {
  [DeliveryCategory.SNEAKERS]: 'sneakers',
  [DeliveryCategory.SLIDES]: 'slides',
  [DeliveryCategory.BOOTS]: 'boots',
  [DeliveryCategory.LOAFERS]: 'loafers',
  [DeliveryCategory.TSHIRT]: 'tshirt',
  [DeliveryCategory.SHORTS]: 'shorts',
  [DeliveryCategory.PANTS]: 'pants',
  [DeliveryCategory.HOODIE]: 'hoodie',
  [DeliveryCategory.SWEATSHIRT]: 'sweatshirt',
  [DeliveryCategory.JACKET]: 'jacket',
  [DeliveryCategory.VEST]: 'vest',
  [DeliveryCategory.DRESS]: 'dress',
  [DeliveryCategory.SKIRT]: 'dress',
  [DeliveryCategory.UNDERWEAR]: 'underwear',
  [DeliveryCategory.WATCH]: 'watch',
  [DeliveryCategory.GLASSES]: 'glasses',
  [DeliveryCategory.BAG]: 'bag',
  [DeliveryCategory.SMALL_ACCESSORY]: 'belt_wallet',
  [DeliveryCategory.JEWELRY]: 'jewelry',
  [DeliveryCategory.PHONE_CASE]: 'phone_case',
  [DeliveryCategory.HEADWEAR]: 'cap',
  [DeliveryCategory.SCARF]: 'beanie_scarf',
  [DeliveryCategory.PERFUME]: 'perfume',
  [DeliveryCategory.TECH_ACCESSORY]: 'headphones',
};

const SHOE_PROFILES = new Set<DeliveryProfileKey>(['sneakers', 'boots', 'slides', 'loafers']);
const norm = (value?: string | null) => (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export function matchDeliveryProfile(input: {
  title?: string | null;
  categoryL1?: string | null;
  categoryL2?: string | null;
  categoryL3?: string | null;
}): DeliveryProfileKey | null {
  const levels = [input.categoryL3, input.categoryL2, input.categoryL1].map(norm).filter(Boolean);
  for (const text of [...levels, norm(input.title)]) {
    if (!text) continue;
    for (const [profile, pattern] of RULES) {
      if (pattern.test(text)) return profile;
    }
  }
  return null;
}

export function profileForDeliveryCategory(category: DeliveryCategory): DeliveryProfileKey | null {
  return ENUM_TO_PROFILE[category] ?? null;
}

/** EU shoe size → band index of the full sneakers table (8 bands). */
function shoeBandIndex(eu: number): number {
  if (eu < 23) return 0;
  if (eu < 28) return 1;
  if (eu < 35) return 2;
  if (eu < 38.5) return 3;
  if (eu < 42) return 4;
  if (eu < 44.5) return 5;
  if (eu < 47) return 6;
  return 7;
}

/** Apparel size string → index 0..5 (XS–S, M, L, XL, 2XL, 3XL+). Default M. */
function apparelBandIndex(size: string): number {
  const s = size.toUpperCase().replace(/\s+/g, '');
  if (/(3|4|5|6)XL|XXXL/.test(s)) return 5;
  if (/2XL|XXL/.test(s)) return 4;
  if (/XL/.test(s)) return 3;
  if (/(^|[^X])L($|[^A-Z])/.test(s) || s === 'L') return 2;
  if (/(^|[^A-Z])M($|[^A-Z])/.test(s) || s === 'M') return 1;
  if (/XS|(^|[^A-Z])S($|[^A-Z])/.test(s) || s === 'S') return 0;

  const n = Number((s.match(/\d+(?:\.\d+)?/) ?? [])[0]);
  if (!Number.isFinite(n)) return 1;
  if (n >= 100) {
    // Chinese height sizes: 165/88A, 170, 175 ... (kids < 140 → smallest band)
    if (n < 165) return 0;
    if (n < 172) return 1;
    if (n < 178) return 2;
    if (n < 183) return 3;
    if (n < 188) return 4;
    return 5;
  }
  if (n >= 44 && n <= 64) {
    // EU / RU tailoring sizes 44–60
    if (n < 46) return 0;
    if (n < 48) return 1;
    if (n < 50) return 2;
    if (n < 52) return 3;
    if (n < 54) return 4;
    return 5;
  }
  if (n >= 24 && n <= 42) {
    // Waist inches (jeans, trousers)
    if (n < 29) return 0;
    if (n < 31) return 1;
    if (n < 33) return 2;
    if (n < 35) return 3;
    if (n < 37) return 4;
    return 5;
  }
  return 1;
}

function parseEuSize(size: string): number | null {
  const m = size.replace(',', '.').match(/(\d{2}(?:\.\d)?)(?:\s+(\d)\/3)?/);
  if (!m) return null;
  const eu = Number(m[1]) + (m[2] ? Number(m[2]) / 3 : 0);
  return eu >= 15 && eu <= 52 ? eu : null;
}

export function pickDeliveryBand(profile: DeliveryProfileKey, size?: string | null): DeliveryPriceBand {
  const bands: readonly DeliveryPriceBand[] = DELIVERY_PRICE_PROFILES[profile].bands;
  if (bands.length === 1) return bands[0];

  if (SHOE_PROFILES.has(profile)) {
    const eu = size ? parseEuSize(size) : null;
    const index = shoeBandIndex(eu ?? 43);
    if (profile === 'sneakers') return bands[index];
    // Adult-only tables (5 bands from EU 35): kids' sizes use the sneakers bands.
    return index < 3 ? DELIVERY_PRICE_PROFILES.sneakers.bands[index] : bands[index - 3];
  }

  return bands[Math.min(apparelBandIndex(size ?? 'M'), bands.length - 1)];
}

export function estimateDeliveryFromTable(input: {
  title?: string | null;
  categoryL1?: string | null;
  categoryL2?: string | null;
  categoryL3?: string | null;
  size?: string | null;
  deliveryCategory?: DeliveryCategory | null;
}): TableDeliveryEstimate | null {
  const profile =
    matchDeliveryProfile(input) ??
    (input.deliveryCategory ? profileForDeliveryCategory(input.deliveryCategory) : null);
  if (!profile) return null;
  const band = pickDeliveryBand(profile, input.size);
  return { profile, band, deliveryRub: band.rub, weightKg: band.kg };
}
