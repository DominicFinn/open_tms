/**
 * Canonical catalogue of standard pallet types. Seeded on demand into the
 * PalletType table when a customer clicks "Load standard pallet types" in the
 * admin UI. All dimensions in mm, weights in grams.
 *
 * Sources: ISO 6780, EPAL/UIC 435, GMA/NWPCA, CHEP, Australian Standard 4068.
 */
export interface StandardPalletSpec {
  code: string;
  name: string;
  description: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  tareWeightGrams: number;
  maxLoadGrams: number;
  maxStackHeightMm: number | null;
  material: 'wood' | 'plastic' | 'metal' | 'cardboard' | 'composite';
  reusable: boolean;
  isoCertified: boolean;
  stackable: boolean;
}

export const STANDARD_PALLET_TYPES: StandardPalletSpec[] = [
  {
    code: 'EUR1',
    name: 'Euro Pallet (EUR 1 / EPAL)',
    description: 'European standard, 1200×800mm. Used across EU retail, food, manufacturing.',
    lengthMm: 1200, widthMm: 800, heightMm: 144,
    tareWeightGrams: 25_000,
    maxLoadGrams: 1_500_000,
    maxStackHeightMm: 2400,
    material: 'wood', reusable: true, isoCertified: true, stackable: true,
  },
  {
    code: 'EUR2',
    name: 'Euro Pallet (EUR 2)',
    description: 'Industrial European, 1200×1000mm. Common in chemicals and white goods.',
    lengthMm: 1200, widthMm: 1000, heightMm: 162,
    tareWeightGrams: 35_000,
    maxLoadGrams: 1_500_000,
    maxStackHeightMm: 2400,
    material: 'wood', reusable: true, isoCertified: true, stackable: true,
  },
  {
    code: 'EUR3',
    name: 'Euro Pallet (EUR 3)',
    description: 'European, 1000×1200mm (reversed EUR 2 orientation).',
    lengthMm: 1000, widthMm: 1200, heightMm: 144,
    tareWeightGrams: 29_000,
    maxLoadGrams: 1_500_000,
    maxStackHeightMm: 2400,
    material: 'wood', reusable: true, isoCertified: true, stackable: true,
  },
  {
    code: 'EUR6',
    name: 'Half Pallet (EUR 6)',
    description: 'European half pallet, 800×600mm. Retail ready / display pallet.',
    lengthMm: 800, widthMm: 600, heightMm: 144,
    tareWeightGrams: 9_500,
    maxLoadGrams: 500_000,
    maxStackHeightMm: 1800,
    material: 'wood', reusable: true, isoCertified: true, stackable: true,
  },
  {
    code: 'US_GMA',
    name: 'US GMA Pallet (48×40)',
    description: 'North American grocery standard, 1219×1016mm (48×40 in).',
    lengthMm: 1219, widthMm: 1016, heightMm: 140,
    tareWeightGrams: 17_000,
    maxLoadGrams: 2_000_000,
    maxStackHeightMm: 2286,
    material: 'wood', reusable: true, isoCertified: false, stackable: true,
  },
  {
    code: 'US_42x42',
    name: 'US Drum Pallet (42×42)',
    description: 'North American, 1067×1067mm. Common for drums / telecom.',
    lengthMm: 1067, widthMm: 1067, heightMm: 140,
    tareWeightGrams: 18_000,
    maxLoadGrams: 2_000_000,
    maxStackHeightMm: 2286,
    material: 'wood', reusable: true, isoCertified: false, stackable: true,
  },
  {
    code: 'CHEP_1210',
    name: 'CHEP Pallet (1200×1000)',
    description: 'CHEP rented/pooled pallet, 1200×1000mm. Used in retail supply chains.',
    lengthMm: 1200, widthMm: 1000, heightMm: 150,
    tareWeightGrams: 32_000,
    maxLoadGrams: 1_500_000,
    maxStackHeightMm: 2400,
    material: 'wood', reusable: true, isoCertified: true, stackable: true,
  },
  {
    code: 'CHEP_48x40',
    name: 'CHEP Pallet (48×40)',
    description: 'CHEP North American pooled pallet, 1219×1016mm.',
    lengthMm: 1219, widthMm: 1016, heightMm: 143,
    tareWeightGrams: 22_000,
    maxLoadGrams: 2_000_000,
    maxStackHeightMm: 2286,
    material: 'wood', reusable: true, isoCertified: false, stackable: true,
  },
  {
    code: 'AU_1165',
    name: 'Australian Standard Pallet',
    description: 'Australian / AS 4068, 1165×1165mm. Used across AU/NZ.',
    lengthMm: 1165, widthMm: 1165, heightMm: 150,
    tareWeightGrams: 35_000,
    maxLoadGrams: 2_000_000,
    maxStackHeightMm: 2400,
    material: 'wood', reusable: true, isoCertified: false, stackable: true,
  },
  {
    code: 'PLASTIC_EUR1',
    name: 'Plastic Euro Pallet (1200×800)',
    description: 'HDPE plastic, 1200×800mm. Hygienic pharma/food use.',
    lengthMm: 1200, widthMm: 800, heightMm: 150,
    tareWeightGrams: 15_000,
    maxLoadGrams: 1_250_000,
    maxStackHeightMm: 2400,
    material: 'plastic', reusable: true, isoCertified: false, stackable: true,
  },
  {
    code: 'PLASTIC_GMA',
    name: 'Plastic GMA Pallet (48×40)',
    description: 'HDPE plastic, 1219×1016mm. Pharma/food sanitary use.',
    lengthMm: 1219, widthMm: 1016, heightMm: 150,
    tareWeightGrams: 17_000,
    maxLoadGrams: 1_500_000,
    maxStackHeightMm: 2286,
    material: 'plastic', reusable: true, isoCertified: false, stackable: true,
  },
  {
    code: 'ONE_WAY',
    name: 'One-Way Export Pallet',
    description: 'Lightweight disposable wooden pallet for international export.',
    lengthMm: 1200, widthMm: 800, heightMm: 130,
    tareWeightGrams: 12_000,
    maxLoadGrams: 1_000_000,
    maxStackHeightMm: 1800,
    material: 'wood', reusable: false, isoCertified: true, stackable: false,
  },
  {
    code: 'QUARTER',
    name: 'Quarter Display Pallet',
    description: 'Small retail display footprint, 600×400mm.',
    lengthMm: 600, widthMm: 400, heightMm: 130,
    tareWeightGrams: 4_500,
    maxLoadGrams: 250_000,
    maxStackHeightMm: 1200,
    material: 'cardboard', reusable: false, isoCertified: false, stackable: false,
  },
];
