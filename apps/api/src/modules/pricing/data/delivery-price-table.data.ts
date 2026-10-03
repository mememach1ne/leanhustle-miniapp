// Generated from the RAKETA delivery calculator (calculator.my.raketacn.ru),
// destination Moscow, CDEK pickup point, 'Стандарт' tariff, no insurance.
// rub = China leg + CDEK leg. kg = estimated actual parcel weight.
// Shoes are boxed (shoe box + Poizon outer box); volumetric divisor 5000.
// Regenerate with the scratch script when prices change.

export interface DeliveryPriceBand {
  /** Human label of the size band (e.g. 'EU 42–44', 'M'). */
  size: string;
  /** Estimated package dimensions, cm. */
  dims: string;
  kg: number;
  rub: number;
}

export interface DeliveryPriceProfile {
  label: string;
  bands: DeliveryPriceBand[];
}

export const DELIVERY_PRICE_TABLE_DATE = '2026-10-03';

export const DELIVERY_PRICE_PROFILES = {
  sneakers: {
    label: 'Кроссовки / кеды',
    bands: [
      { size: 'EU 16–22', dims: '23×16×11', kg: 0.35, rub: 608 },
      { size: 'EU 23–27', dims: '26×18×12', kg: 0.5, rub: 749 },
      { size: 'EU 28–35', dims: '30×21×13', kg: 0.8, rub: 1017 },
      { size: 'EU 35–38', dims: '34×23×14', kg: 1, rub: 1257 },
      { size: 'EU 38,5–41', dims: '36×24×15', kg: 1.2, rub: 1442 },
      { size: 'EU 42–44', dims: '38×26×15.5', kg: 1.4, rub: 1637 },
      { size: 'EU 44,5–46', dims: '39×27×16', kg: 1.6, rub: 1846 },
      { size: 'EU 47+', dims: '40×28×17', kg: 1.8, rub: 2036 },
    ],
  },
  boots: {
    label: 'Ботинки',
    bands: [
      { size: 'EU 35–38', dims: '37.1×25.1×15.3', kg: 1.4, rub: 1610 },
      { size: 'EU 38,5–41', dims: '39.3×26.2×16.4', kg: 1.68, rub: 1901 },
      { size: 'EU 42–44', dims: '41.5×28.4×16.9', kg: 1.96, rub: 2167 },
      { size: 'EU 44,5–46', dims: '42.6×29.5×17.5', kg: 2.24, rub: 2444 },
      { size: 'EU 47+', dims: '43.7×30.6×18.6', kg: 2.52, rub: 2706 },
    ],
  },
  slides: {
    label: 'Шлёпанцы / сандалии',
    bands: [
      { size: 'EU 35–38', dims: '29.5×19.9×12.1', kg: 0.6, rub: 854 },
      { size: 'EU 38,5–41', dims: '31.2×20.8×13', kg: 0.72, rub: 969 },
      { size: 'EU 42–44', dims: '32.9×22.5×13.4', kg: 0.84, rub: 1087 },
      { size: 'EU 44,5–46', dims: '33.8×23.4×13.9', kg: 0.96, rub: 1195 },
      { size: 'EU 47+', dims: '34.6×24.3×14.7', kg: 1.08, rub: 1346 },
    ],
  },
  loafers: {
    label: 'Лоферы / туфли',
    bands: [
      { size: 'EU 35–38', dims: '32.8×22.2×13.5', kg: 1, rub: 1194 },
      { size: 'EU 38,5–41', dims: '34.8×23.2×14.5', kg: 1.2, rub: 1411 },
      { size: 'EU 42–44', dims: '36.7×25.1×15', kg: 1.4, rub: 1600 },
      { size: 'EU 44,5–46', dims: '37.7×26.1×15.4', kg: 1.6, rub: 1769 },
      { size: 'EU 47+', dims: '38.6×27×16.4', kg: 1.8, rub: 1988 },
    ],
  },
  tshirt: {
    label: 'Футболка / поло',
    bands: [
      { size: 'XS–S', dims: '30×22×3', kg: 0.2, rub: 523 },
      { size: 'M', dims: '31×22.5×3.3', kg: 0.23, rub: 531 },
      { size: 'L', dims: '32×23×3.6', kg: 0.25, rub: 540 },
      { size: 'XL', dims: '33×23.5×3.9', kg: 0.28, rub: 549 },
      { size: '2XL', dims: '34×24×4.2', kg: 0.31, rub: 566 },
      { size: '3XL+', dims: '35×24.5×4.5', kg: 0.34, rub: 597 },
    ],
  },
  longsleeve: {
    label: 'Лонгслив / джерси',
    bands: [
      { size: 'XS–S', dims: '30×22×4', kg: 0.25, rub: 540 },
      { size: 'M', dims: '31×22.5×4.3', kg: 0.28, rub: 548 },
      { size: 'L', dims: '32×23×4.6', kg: 0.31, rub: 565 },
      { size: 'XL', dims: '33×23.5×4.9', kg: 0.34, rub: 595 },
      { size: '2XL', dims: '34×24×5.2', kg: 0.37, rub: 627 },
      { size: '3XL+', dims: '35×24.5×5.5', kg: 0.4, rub: 659 },
    ],
  },
  hoodie: {
    label: 'Худи',
    bands: [
      { size: 'XS–S', dims: '35×28×8', kg: 0.55, rub: 838 },
      { size: 'M', dims: '36×28.5×8.5', kg: 0.62, rub: 908 },
      { size: 'L', dims: '37×29×9', kg: 0.7, rub: 985 },
      { size: 'XL', dims: '38×29.5×9.5', kg: 0.78, rub: 1064 },
      { size: '2XL', dims: '39×30×10', kg: 0.86, rub: 1180 },
      { size: '3XL+', dims: '40×30.5×10.5', kg: 0.95, rub: 1269 },
    ],
  },
  sweatshirt: {
    label: 'Свитшот',
    bands: [
      { size: 'XS–S', dims: '35×27×6', kg: 0.47, rub: 730 },
      { size: 'M', dims: '36×27.5×6.5', kg: 0.53, rub: 790 },
      { size: 'L', dims: '37×28×7', kg: 0.6, rub: 858 },
      { size: 'XL', dims: '38×28.5×7.5', kg: 0.66, rub: 920 },
      { size: '2XL', dims: '39×29×8', kg: 0.73, rub: 991 },
      { size: '3XL+', dims: '40×29.5×8.5', kg: 0.8, rub: 1062 },
    ],
  },
  shorts: {
    label: 'Шорты',
    bands: [
      { size: 'XS–S', dims: '28×22×4', kg: 0.25, rub: 535 },
      { size: 'M', dims: '29×22.5×4.3', kg: 0.28, rub: 544 },
      { size: 'L', dims: '30×23×4.6', kg: 0.31, rub: 560 },
      { size: 'XL', dims: '31×23.5×4.9', kg: 0.34, rub: 590 },
      { size: '2XL', dims: '32×24×5.2', kg: 0.37, rub: 621 },
      { size: '3XL+', dims: '33×24.5×5.5', kg: 0.4, rub: 652 },
    ],
  },
  pants: {
    label: 'Спортивные штаны',
    bands: [
      { size: 'XS–S', dims: '35×25×6', kg: 0.45, rub: 706 },
      { size: 'M', dims: '36×25.5×6.5', kg: 0.5, rub: 758 },
      { size: 'L', dims: '37×26×7', kg: 0.56, rub: 818 },
      { size: 'XL', dims: '38×26.5×7.5', kg: 0.62, rub: 879 },
      { size: '2XL', dims: '39×27×8', kg: 0.68, rub: 941 },
      { size: '3XL+', dims: '40×27.5×8.5', kg: 0.75, rub: 1012 },
    ],
  },
  jeans: {
    label: 'Джинсы',
    bands: [
      { size: 'XS–S', dims: '35×28×6', kg: 0.65, rub: 858 },
      { size: 'M', dims: '36×28.5×6.5', kg: 0.7, rub: 911 },
      { size: 'L', dims: '37×29×7', kg: 0.75, rub: 966 },
      { size: 'XL', dims: '38×29.5×7.5', kg: 0.8, rub: 1022 },
      { size: '2XL', dims: '39×30×8', kg: 0.85, rub: 1080 },
      { size: '3XL+', dims: '40×30.5×8.5', kg: 0.9, rub: 1139 },
    ],
  },
  windbreaker: {
    label: 'Ветровка / лёгкая куртка',
    bands: [
      { size: 'XS–S', dims: '35×28×6', kg: 0.45, rub: 722 },
      { size: 'M', dims: '36×28.5×6.5', kg: 0.52, rub: 789 },
      { size: 'L', dims: '37×29×7', kg: 0.6, rub: 864 },
      { size: 'XL', dims: '38×29.5×7.5', kg: 0.68, rub: 941 },
      { size: '2XL', dims: '39×30×8', kg: 0.75, rub: 1012 },
      { size: '3XL+', dims: '40×30.5×8.5', kg: 0.82, rub: 1084 },
    ],
  },
  jacket: {
    label: 'Куртка / бомбер',
    bands: [
      { size: 'XS–S', dims: '40×30×10', kg: 0.9, rub: 1215 },
      { size: 'M', dims: '41×30.5×11', kg: 1, rub: 1326 },
      { size: 'L', dims: '42×31×12', kg: 1.1, rub: 1476 },
      { size: 'XL', dims: '43×31.5×13', kg: 1.22, rub: 1607 },
      { size: '2XL', dims: '44×32×14', kg: 1.35, rub: 1747 },
      { size: '3XL+', dims: '45×32.5×15', kg: 1.48, rub: 1926 },
    ],
  },
  down_jacket: {
    label: 'Пуховик',
    bands: [
      { size: 'XS–S', dims: '45×35×15', kg: 1.5, rub: 1981 },
      { size: 'M', dims: '46×35.5×16.5', kg: 1.7, rub: 2235 },
      { size: 'L', dims: '47×36×18', kg: 1.9, rub: 2493 },
      { size: 'XL', dims: '48×36.5×19.5', kg: 2.1, rub: 2721 },
      { size: '2XL', dims: '49×37×21', kg: 2.3, rub: 2989 },
      { size: '3XL+', dims: '50×37.5×22.5', kg: 2.5, rub: 3263 },
    ],
  },
  vest: {
    label: 'Жилетка',
    bands: [
      { size: 'XS–S', dims: '35×27×6', kg: 0.4, rub: 683 },
      { size: 'M', dims: '36×27.5×6.5', kg: 0.45, rub: 735 },
      { size: 'L', dims: '37×28×7', kg: 0.5, rub: 790 },
      { size: 'XL', dims: '38×28.5×7.5', kg: 0.55, rub: 845 },
      { size: '2XL', dims: '39×29×8', kg: 0.6, rub: 902 },
      { size: '3XL+', dims: '40×29.5×8.5', kg: 0.65, rub: 960 },
    ],
  },
  dress: {
    label: 'Платье / юбка',
    bands: [
      { size: 'XS–S', dims: '32×25×4', kg: 0.35, rub: 587 },
      { size: 'M', dims: '33×25.5×4.3', kg: 0.4, rub: 632 },
      { size: 'L', dims: '34×26×4.6', kg: 0.45, rub: 677 },
      { size: 'XL', dims: '35×26.5×4.9', kg: 0.5, rub: 723 },
      { size: '2XL', dims: '36×27×5.2', kg: 0.55, rub: 769 },
      { size: '3XL+', dims: '37×27.5×5.5', kg: 0.6, rub: 817 },
    ],
  },
  underwear: {
    label: 'Бельё / носки',
    bands: [
      { size: 'любой', dims: '25×18×4', kg: 0.18, rub: 519 },
    ],
  },
  watch: {
    label: 'Часы',
    bands: [
      { size: '—', dims: '15×12×10', kg: 0.5, rub: 672 },
    ],
  },
  smartwatch: {
    label: 'Смарт-часы',
    bands: [
      { size: '—', dims: '15×10×8', kg: 0.5, rub: 672 },
    ],
  },
  glasses: {
    label: 'Очки',
    bands: [
      { size: '—', dims: '18×8×6', kg: 0.3, rub: 511 },
    ],
  },
  crossbody: {
    label: 'Сумка через плечо',
    bands: [
      { size: '—', dims: '30×22×10', kg: 0.8, rub: 978 },
    ],
  },
  bag: {
    label: 'Сумка / шопер',
    bands: [
      { size: '—', dims: '38×30×12', kg: 1, rub: 1324 },
    ],
  },
  backpack: {
    label: 'Рюкзак',
    bands: [
      { size: '—', dims: '45×32×15', kg: 1.2, rub: 1727 },
    ],
  },
  travel_bag: {
    label: 'Дорожная / спортивная сумка',
    bands: [
      { size: '—', dims: '55×30×20', kg: 1.8, rub: 2488 },
    ],
  },
  cap: {
    label: 'Кепка',
    bands: [
      { size: '—', dims: '28×20×14', kg: 0.35, rub: 702 },
    ],
  },
  beanie_scarf: {
    label: 'Шапка / шарф',
    bands: [
      { size: '—', dims: '25×20×6', kg: 0.3, rub: 548 },
    ],
  },
  belt_wallet: {
    label: 'Ремень / кошелёк',
    bands: [
      { size: '—', dims: '22×14×6', kg: 0.3, rub: 520 },
    ],
  },
  jewelry: {
    label: 'Украшения',
    bands: [
      { size: '—', dims: '12×10×6', kg: 0.15, rub: 511 },
    ],
  },
  phone_case: {
    label: 'Чехол для телефона',
    bands: [
      { size: '—', dims: '20×12×3', kg: 0.15, rub: 511 },
    ],
  },
  perfume: {
    label: 'Парфюм',
    bands: [
      { size: '—', dims: '15×10×10', kg: 0.6, rub: 752 },
    ],
  },
  cosmetics: {
    label: 'Косметика',
    bands: [
      { size: '—', dims: '18×12×8', kg: 0.4, rub: 592 },
    ],
  },
  phone: {
    label: 'Телефон',
    bands: [
      { size: '—', dims: '20×12×8', kg: 0.6, rub: 752 },
    ],
  },
  headphones: {
    label: 'Наушники',
    bands: [
      { size: '—', dims: '18×15×8', kg: 0.5, rub: 672 },
    ],
  },
  powerbank: {
    label: 'Павербанк / зарядка',
    bands: [
      { size: '—', dims: '18×12×6', kg: 0.5, rub: 672 },
    ],
  },
  gamepad: {
    label: 'Геймпад',
    bands: [
      { size: '—', dims: '22×18×10', kg: 0.6, rub: 776 },
    ],
  },
  hairdryer: {
    label: 'Фен',
    bands: [
      { size: '—', dims: '35×25×12', kg: 1.2, rub: 1382 },
    ],
  },
  camera: {
    label: 'Фотоаппарат',
    bands: [
      { size: '—', dims: '25×20×15', kg: 1, rub: 1136 },
    ],
  },
  ball: {
    label: 'Мяч',
    bands: [
      { size: '—', dims: '25×25×25', kg: 0.8, rub: 1272 },
    ],
  },
} satisfies Record<string, DeliveryPriceProfile>;

export type DeliveryProfileKey = keyof typeof DELIVERY_PRICE_PROFILES;
