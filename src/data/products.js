/**
 * BASMA (@basma.llb) — Default Product Catalog & Store Settings Data
 */

import { DEFAULT_PIN_SHA256 } from '../utils/security.js';

export const DEFAULT_SETTINGS = {
  whatsappNumber: '96170360671',
  studioEmail: 'concierge@basma-studio.com',
  primaryCurrencySymbol: '$',
  primaryCurrencyLabel: 'USD $',
  calcCutoutBase: 28,
  calcCutoutPerCm: 0.95,
  calcReliefBase: 45,
  calcReliefPerCm: 1.45,
  adminPinHash: DEFAULT_PIN_SHA256,
  cloudWebhookUrl: ''
};

export const DEFAULT_PRODUCTS = [
  {
    id: 'prod-aero-gt',
    title: 'Aero GT Hypercar Wall Silhouette',
    category: 'garage',
    styleBadge: 'Matte Wood Cutout',
    badgeClass: 'badge-silhouette',
    image: 'assets/product-supercar-wall.jpg',
    finish: 'Matte Carbon Black (15mm Layered Wood)',
    description: 'Our signature @basma.llb aerodynamic hypercar cutout featured on sunlit plaster walls. Precision laser/CNC routed from high-density matte carbon-finished hardwood with floating wall standoffs.',
    sizes: [
      { label: 'Small — 50 × 28 cm', code: 'S (50cm)', priceUSD: 58 },
      { label: 'Medium — 80 × 45 cm', code: 'M (80cm)', priceUSD: 94 },
      { label: 'Large — 115 × 64 cm', code: 'L (115cm)', priceUSD: 138 }
    ],
    defaultSizeIndex: 1
  },
  {
    id: 'prod-sacred-relief',
    title: 'Sacred Medallion 3D CNC Wood Relief',
    category: 'relief',
    styleBadge: '3D CNC Relief',
    badgeClass: 'badge-relief',
    image: 'assets/product-heritage-relief.jpg',
    finish: 'Solid Natural Walnut • Hand-Oiled',
    description: 'As seen in our @basma.llb 3D Wood Design showcase: a deeply carved solid walnut medallion featuring micro-fluted radiant halo detailing and hand-rubbed beeswax oil finish.',
    sizes: [
      { label: 'Small — 30 × 30 cm (28mm thick)', code: 'S (30cm)', priceUSD: 75 },
      { label: 'Medium — 45 × 45 cm (32mm thick)', code: 'M (45cm)', priceUSD: 118 },
      { label: 'Large — 65 × 65 cm (38mm thick)', code: 'L (65cm)', priceUSD: 175 }
    ],
    defaultSizeIndex: 1
  },
  {
    id: 'prod-porsche-gt3',
    title: '911 GT3 RS Aero Profile Cutout',
    category: 'garage',
    styleBadge: 'Matte Wood Cutout',
    badgeClass: 'badge-silhouette',
    image: 'assets/prod-porsche-gt3.jpg',
    finish: 'Matte Carbon Black + Gold Brake Caliper Accent',
    description: 'Iconic swan-neck rear wing and timeless Stuttgart roofline captured in a multi-layered matte-black wood wall silhouette with warm gold hub accents.',
    sizes: [
      { label: 'Small — 45 × 22 cm', code: 'S (45cm)', priceUSD: 54 },
      { label: 'Medium — 75 × 36 cm', code: 'M (75cm)', priceUSD: 89 },
      { label: 'Large — 110 × 52 cm', code: 'L (110cm)', priceUSD: 129 }
    ],
    defaultSizeIndex: 1
  },
  {
    id: 'prod-cedar-heritage',
    title: 'Immortal Cedar of Lebanon 3D Relief Plaque',
    category: 'relief',
    styleBadge: '3D CNC Relief',
    badgeClass: 'badge-relief',
    image: 'assets/prod-cedar-relief.jpg',
    finish: 'Aged Lebanese Cedar & Rich Walnut',
    description: 'Multi-tiered 3D botanical relief of the timeless Cedar emblem, carved with 22mm depth into solid hardwood and framed in a chamfered heritage border.',
    sizes: [
      { label: 'Small — 35 × 35 cm', code: 'S (35cm)', priceUSD: 72 },
      { label: 'Medium — 55 × 55 cm', code: 'M (55cm)', priceUSD: 115 },
      { label: 'Large — 80 × 80 cm', code: 'L (80cm)', priceUSD: 168 }
    ],
    defaultSizeIndex: 1
  },
  {
    id: 'prod-anime-samurai',
    title: 'Ronin Wolf & Crossed Katana Crest',
    category: 'anime',
    styleBadge: 'Matte Wood Cutout',
    badgeClass: 'badge-silhouette',
    image: 'assets/prod-anime-samurai.jpg',
    finish: 'Dual-Layer Matte Black & Gold Leaf Inlay',
    description: 'High-contrast anime & gaming sanctuary centerpiece combining a crescent moon ring, twin katanas, and a fierce geometric wolf mask with golden eye inlays.',
    sizes: [
      { label: 'Small — 40 × 40 cm', code: 'S (40cm)', priceUSD: 56 },
      { label: 'Medium — 70 × 70 cm', code: 'M (70cm)', priceUSD: 92 },
      { label: 'Large — 100 × 100 cm', code: 'L (100cm)', priceUSD: 135 }
    ],
    defaultSizeIndex: 1
  },
  {
    id: 'prod-gwagon-4x4',
    title: 'Alpine 4×4 Off-Road & Peak Silhouette',
    category: 'garage',
    styleBadge: 'Matte Wood Cutout',
    badgeClass: 'badge-silhouette',
    image: 'assets/prod-gwagon-4x4.jpg',
    finish: 'Matte Carbon Black (15mm Baltic Birch Core)',
    description: 'Rugged luxury 4×4 silhouette framed against twin geometric mountain peaks. Built for overland enthusiasts and modern executive garages.',
    sizes: [
      { label: 'Small — 45 × 32 cm', code: 'S (45cm)', priceUSD: 59 },
      { label: 'Medium — 75 × 52 cm', code: 'M (75cm)', priceUSD: 95 },
      { label: 'Large — 105 × 72 cm', code: 'L (105cm)', priceUSD: 139 }
    ],
    defaultSizeIndex: 1
  },
  {
    id: 'prod-basma-calligraphy',
    title: '“Basma | بصمة” Gold-Fluted Arabic Calligraphy',
    category: 'relief',
    styleBadge: '3D CNC Relief',
    badgeClass: 'badge-relief',
    image: 'assets/basma-logo.jpg',
    finish: 'Warm Brushed Gold & Matte Obsidian Base',
    description: 'Inspired by the official Basma emblem: intricate concentric CNC topographic grooves carved inside raised Arabic typography on a circular obsidian-black wood disc.',
    sizes: [
      { label: 'Small — 40 cm Diameter', code: 'S (40cm)', priceUSD: 68 },
      { label: 'Medium — 65 cm Diameter', code: 'M (65cm)', priceUSD: 108 },
      { label: 'Large — 95 cm Diameter', code: 'L (95cm)', priceUSD: 158 }
    ],
    defaultSizeIndex: 1
  },
  {
    id: 'prod-gaming-crest',
    title: 'Pro Lounge Hex-Shield Controller Emblem',
    category: 'anime',
    styleBadge: 'Matte Wood Cutout',
    badgeClass: 'badge-silhouette',
    image: 'assets/prod-gaming-crest.jpg',
    finish: 'Matte Carbon Black + Warm Gold Accents',
    description: 'Geometric hexagonal crest engineered for streaming studios and gaming setups. Features layered depth spacers for optional warm LED backlighting.',
    sizes: [
      { label: 'Small — 40 × 46 cm', code: 'S (40cm)', priceUSD: 52 },
      { label: 'Medium — 65 × 75 cm', code: 'M (65cm)', priceUSD: 86 },
      { label: 'Large — 95 × 108 cm', code: 'L (95cm)', priceUSD: 128 }
    ],
    defaultSizeIndex: 1
  },
  {
    id: 'prod-f1-circuit',
    title: 'Grand Prix Circuit Elevation Track Art',
    category: 'garage',
    styleBadge: '3D CNC Relief',
    badgeClass: 'badge-relief',
    image: 'assets/prod-f1-circuit.jpg',
    finish: 'Matte Carbon Track + Walnut Sector Apexes',
    description: '3D cambered motorsport track sculpture with gold-inlaid racing line and engraved corner names. Available for Monaco, Spa-Francorchamps, Monza, or Nürburgring.',
    sizes: [
      { label: 'Small — 45 × 35 cm', code: 'S (45cm)', priceUSD: 55 },
      { label: 'Medium — 75 × 58 cm', code: 'M (75cm)', priceUSD: 88 },
      { label: 'Large — 105 × 80 cm', code: 'L (105cm)', priceUSD: 132 }
    ],
    defaultSizeIndex: 1
  }
];
