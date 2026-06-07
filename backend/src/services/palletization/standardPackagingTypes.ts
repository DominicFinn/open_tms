/**
 * Canonical catalogue of standard packaging types. Seeded on demand into the
 * PackagingType table when a customer clicks "Load standard packaging types"
 * in the admin UI. All dimensions in mm, weights in grams.
 *
 * Pallet sources: ISO 6780, EPAL/UIC 435, GMA/NWPCA, CHEP, Australian Standard 4068.
 * Non-pallet types are sensible defaults that orgs can customise.
 */
export type PackagingKind =
  | 'pallet'
  | 'carton'
  | 'crate'
  | 'drum'
  | 'roll'
  | 'bag'
  | 'tote'
  | 'loose'
  | 'custom';

export interface StandardPackagingSpec {
  code: string;
  name: string;
  description: string;
  kind: PackagingKind;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  tareWeightGrams: number | null;
  maxLoadGrams: number | null;
  maxStackHeightMm: number | null;
  material: 'wood' | 'plastic' | 'metal' | 'cardboard' | 'composite' | 'fiber' | 'textile' | null;
  reusable: boolean;
  isoCertified: boolean;
  stackable: boolean;
}

export const STANDARD_PACKAGING_TYPES: StandardPackagingSpec[] = [
  {
    code: 'EUR1',
    name: 'Euro Pallet (EUR 1 / EPAL)',
    description: 'European standard, 1200×800mm. Used across EU retail, food, manufacturing.',
    kind: 'pallet',
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
    kind: 'pallet',
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
    kind: 'pallet',
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
    kind: 'pallet',
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
    kind: 'pallet',
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
    kind: 'pallet',
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
    kind: 'pallet',
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
    kind: 'pallet',
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
    kind: 'pallet',
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
    kind: 'pallet',
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
    kind: 'pallet',
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
    kind: 'pallet',
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
    kind: 'pallet',
    lengthMm: 600, widthMm: 400, heightMm: 130,
    tareWeightGrams: 4_500,
    maxLoadGrams: 250_000,
    maxStackHeightMm: 1200,
    material: 'cardboard', reusable: false, isoCertified: false, stackable: false,
  },

  // ---------------- Non-pallet packaging (Phase 1 additions) ----------------
  // Sensible defaults; orgs can extend/customise per their actual packaging.
  // tareWeightGrams / maxLoadGrams / material are null where they're not meaningful.

  {
    code: 'CARTON_S',
    name: 'Carton (Small)',
    description: 'Generic small corrugated carton, 300×200×150mm.',
    kind: 'carton',
    lengthMm: 300, widthMm: 200, heightMm: 150,
    tareWeightGrams: 200,
    maxLoadGrams: 15_000,
    maxStackHeightMm: null,
    material: 'cardboard', reusable: false, isoCertified: false, stackable: true,
  },
  {
    code: 'CARTON_M',
    name: 'Carton (Medium)',
    description: 'Generic medium corrugated carton, 450×300×250mm.',
    kind: 'carton',
    lengthMm: 450, widthMm: 300, heightMm: 250,
    tareWeightGrams: 400,
    maxLoadGrams: 25_000,
    maxStackHeightMm: null,
    material: 'cardboard', reusable: false, isoCertified: false, stackable: true,
  },
  {
    code: 'CARTON_L',
    name: 'Carton (Large)',
    description: 'Generic large corrugated carton, 600×400×400mm.',
    kind: 'carton',
    lengthMm: 600, widthMm: 400, heightMm: 400,
    tareWeightGrams: 700,
    maxLoadGrams: 40_000,
    maxStackHeightMm: null,
    material: 'cardboard', reusable: false, isoCertified: false, stackable: true,
  },
  {
    code: 'CRATE_WOOD_M',
    name: 'Wood Crate (Medium)',
    description: 'Reusable wooden crate, 800×600×500mm.',
    kind: 'crate',
    lengthMm: 800, widthMm: 600, heightMm: 500,
    tareWeightGrams: 8_000,
    maxLoadGrams: 200_000,
    maxStackHeightMm: null,
    material: 'wood', reusable: true, isoCertified: false, stackable: true,
  },
  {
    code: 'DRUM_55GAL',
    name: 'Drum (55 gal / 208 L)',
    description: 'Standard steel drum, 580mm diameter × 880mm tall.',
    kind: 'drum',
    lengthMm: 580, widthMm: 580, heightMm: 880,
    tareWeightGrams: 22_000,
    maxLoadGrams: 230_000,
    maxStackHeightMm: null,
    material: 'metal', reusable: true, isoCertified: false, stackable: false,
  },
  {
    code: 'ROLL_STD',
    name: 'Roll (Standard)',
    description: 'Generic cylindrical roll, 1000mm diameter × 1500mm long.',
    kind: 'roll',
    lengthMm: 1500, widthMm: 1000, heightMm: 1000,
    tareWeightGrams: null,
    maxLoadGrams: null,
    maxStackHeightMm: null,
    material: null, reusable: false, isoCertified: false, stackable: false,
  },
  {
    code: 'BAG_50KG',
    name: 'Bag (50 kg)',
    description: 'Standard 50kg sack (grain, feed, cement-style).',
    kind: 'bag',
    lengthMm: 600, widthMm: 400, heightMm: 150,
    tareWeightGrams: 250,
    maxLoadGrams: 50_000,
    maxStackHeightMm: null,
    material: 'textile', reusable: false, isoCertified: false, stackable: true,
  },
  {
    code: 'TOTE_PLASTIC',
    name: 'Tote (Plastic, Stackable)',
    description: 'Generic plastic stackable tote, 600×400×320mm.',
    kind: 'tote',
    lengthMm: 600, widthMm: 400, heightMm: 320,
    tareWeightGrams: 2_000,
    maxLoadGrams: 30_000,
    maxStackHeightMm: 1800,
    material: 'plastic', reusable: true, isoCertified: false, stackable: true,
  },
  {
    code: 'LOOSE',
    name: 'Loose (Floor Loaded)',
    description: 'Loose / unpacked freight, floor-loaded.',
    kind: 'loose',
    lengthMm: 1, widthMm: 1, heightMm: 1,
    tareWeightGrams: null,
    maxLoadGrams: null,
    maxStackHeightMm: null,
    material: null, reusable: false, isoCertified: false, stackable: false,
  },
];
