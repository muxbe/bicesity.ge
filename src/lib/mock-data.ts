export interface Attribute {
  id: string;
  name: string;
  category: "Bicycle" | "Parts";
  isPublic: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: "Bicycle" | "Parts";
  type?: "Manual" | "Electrical";
  serial: string;
  price: number;
  image: string;
  description: string;
  values: Record<string, string>;
  rating: number;
  inStock: boolean;
}

export const attributes: Attribute[] = [
  { id: "attr_1", name: "Frame Material", category: "Bicycle", isPublic: true },
  { id: "attr_2", name: "Weight", category: "Bicycle", isPublic: true },
  { id: "attr_3", name: "Groupset", category: "Bicycle", isPublic: true },
  { id: "attr_4", name: "Battery Range", category: "Bicycle", isPublic: true },
  { id: "attr_5", name: "Wheel Size", category: "Bicycle", isPublic: true },
  { id: "attr_6", name: "Internal Dealer Note", category: "Bicycle", isPublic: false },
  { id: "attr_7", name: "Compatibility", category: "Parts", isPublic: true },
  { id: "attr_8", name: "Material", category: "Parts", isPublic: true },
  { id: "attr_9", name: "Weight", category: "Parts", isPublic: true },
  { id: "attr_10", name: "Supplier Code", category: "Parts", isPublic: false },
];

export const products: Product[] = [
  {
    id: "prod_1",
    name: "S-Works Turbo Levo",
    category: "Bicycle",
    type: "Electrical",
    serial: "SPEC-7721-EV",
    price: 12499,
    image: "https://images.unsplash.com/photo-1593761713314-44874730c421?q=80&w=1000&auto=format&fit=crop",
    description: "The ultimate e-MTB. Powered by a custom Specialized motor with seamless integration into a full-carbon frame.",
    values: {
      attr_1: "Fact 11m Carbon",
      attr_2: "22.1 kg",
      attr_3: "SRAM XX1 Eagle AXS",
      attr_4: "5-7 Hours / 700Wh",
      attr_5: "29\"",
      attr_6: "Incoming from Berlin warehouse",
    },
    rating: 4.9,
    inStock: true,
  },
  {
    id: "prod_2",
    name: "Trek Emonda SLR 9",
    category: "Bicycle",
    type: "Manual",
    serial: "TRK-RD-990",
    price: 9850,
    image: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?q=80&w=1000&auto=format&fit=crop",
    description: "The lightest production road bike ever made. Born for climbing, built for racing.",
    values: {
      attr_1: "800 Series OCLV Carbon",
      attr_2: "6.75 kg",
      attr_3: "Shimano Dura-Ace Di2",
      attr_5: "700c",
      attr_6: "Needs pedal installation",
    },
    rating: 4.8,
    inStock: true,
  },
  {
    id: "prod_3",
    name: "Specialized Sirrus X 4.0",
    category: "Bicycle",
    type: "Manual",
    serial: "SPEC-CITY-22",
    price: 1850,
    image: "https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?q=80&w=1000&auto=format&fit=crop",
    description: "A summer-long of trail-ready performance. Perfect hybrid for city commuting and weekend adventures.",
    values: {
      attr_1: "A1 Premium Aluminum",
      attr_2: "10.5 kg",
      attr_3: "Shimano Deore",
      attr_5: "700c",
      attr_6: "Floor model - 5% discount possible",
    },
    rating: 4.6,
    inStock: true,
  },
  {
    id: "prod_4",
    name: "Canyon Aeroad CF SLX",
    category: "Bicycle",
    type: "Manual",
    serial: "CAN-AERO-88",
    price: 8499,
    image: "https://images.unsplash.com/photo-1532298229144-0ee05051da69?q=80&w=1000&auto=format&fit=crop",
    description: "The most aerodynamic bike in Canyon's lineup. Wind-tunnel proven performance.",
    values: {
      attr_1: "CF SLX Carbon",
      attr_2: "7.2 kg",
      attr_3: "Shimano Ultegra Di2",
      attr_5: "700c",
      attr_6: "Display model, full warranty",
    },
    rating: 4.7,
    inStock: true,
  },
  {
    id: "prod_5",
    name: "Giant Revolt Advanced Pro",
    category: "Bicycle",
    type: "Manual",
    serial: "GNT-GRV-PRO",
    price: 4200,
    image: "https://images.unsplash.com/photo-1571068316344-75bc76f77890?q=80&w=1000&auto=format&fit=crop",
    description: "Gravel racing machine with D-Fuse technology for all-day comfort on mixed terrain.",
    values: {
      attr_1: "Advanced-Grade Composite",
      attr_2: "8.9 kg",
      attr_3: "Shimano GRX Di2",
      attr_5: "700c",
      attr_6: "Popular model - restock weekly",
    },
    rating: 4.5,
    inStock: false,
  },
  {
    id: "prod_6",
    name: "Riese & Muller Supercharger2",
    category: "Bicycle",
    type: "Electrical",
    serial: "RM-SC2-GT",
    price: 6990,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?q=80&w=1000&auto=format&fit=crop",
    description: "Premium touring e-bike with dual battery system. Up to 250km range for the ultimate adventure.",
    values: {
      attr_1: "6061 Aluminum",
      attr_2: "28.5 kg",
      attr_3: "Shimano Deore XT",
      attr_4: "10-14 Hours / 1125Wh Dual",
      attr_5: "27.5\"",
      attr_6: "Requires assembly - frame only in stock",
    },
    rating: 4.4,
    inStock: true,
  },
  {
    id: "prod_7",
    name: "Shimano Ultegra Chain CN-HG701",
    category: "Parts",
    serial: "SH-ULT-CH-701",
    price: 65,
    image: "https://images.unsplash.com/photo-1544133782-96420be44061?q=80&w=1000&auto=format&fit=crop",
    description: "Smooth shifting and exceptionally durable 11-speed chain with SIL-TEC coating.",
    values: {
      attr_7: "11-Speed Shimano / SRAM",
      attr_8: "Nickel-Plated Steel",
      attr_9: "257g",
      attr_10: "SH-CN-701-B",
    },
    rating: 4.7,
    inStock: true,
  },
  {
    id: "prod_8",
    name: "Continental GP5000 S TR",
    category: "Parts",
    serial: "CON-GP5K-28",
    price: 75,
    image: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?q=80&w=1000&auto=format&fit=crop",
    description: "The benchmark road tire. Tubeless-ready with BlackChili compound for ultimate grip.",
    values: {
      attr_7: "700c x 25-32mm",
      attr_8: "BlackChili Rubber Compound",
      attr_9: "235g (28mm)",
      attr_10: "CON-GP5-TR-28",
    },
    rating: 4.9,
    inStock: true,
  },
  {
    id: "prod_9",
    name: "SRAM Red AXS Rear Derailleur",
    category: "Parts",
    serial: "SR-RED-RD-AXS",
    price: 580,
    image: "https://images.unsplash.com/photo-1511994298241-608e28f14fde?q=80&w=1000&auto=format&fit=crop",
    description: "Wireless electronic shifting with instant, precise gear changes. Race-proven reliability.",
    values: {
      attr_7: "12-Speed SRAM AXS",
      attr_8: "Carbon Fiber / Titanium",
      attr_9: "215g",
      attr_10: "SR-RD-RED-AXS-12",
    },
    rating: 4.8,
    inStock: true,
  },
  {
    id: "prod_10",
    name: "Zipp 404 Firecrest Disc",
    category: "Parts",
    serial: "ZP-404-FC-D",
    price: 2100,
    image: "https://images.unsplash.com/photo-1596738901637-3cc0c26624a1?q=80&w=1000&auto=format&fit=crop",
    description: "Deep-section carbon wheelset with Total System Efficiency. Faster in real-world conditions.",
    values: {
      attr_7: "Disc Brake, Centerlock",
      attr_8: "Full Carbon Fiber",
      attr_9: "1,510g (pair)",
      attr_10: "ZP-404-FC-DB-PR",
    },
    rating: 4.6,
    inStock: false,
  },
  {
    id: "prod_11",
    name: "PRO Stealth Saddle",
    category: "Parts",
    serial: "PRO-STL-152",
    price: 199,
    image: "https://images.unsplash.com/photo-1605965963892-1f0e2f2b8a01?q=80&w=1000&auto=format&fit=crop",
    description: "Ergonomic racing saddle with pressure-relieving cutout. Used by WorldTour professionals.",
    values: {
      attr_7: "Universal Rail Mount (7x7mm)",
      attr_8: "Carbon Base / Stainless Rails",
      attr_9: "190g",
      attr_10: "PRO-SDL-STL-152",
    },
    rating: 4.5,
    inStock: true,
  },
  {
    id: "prod_12",
    name: "Shimano Dura-Ace BR-R9270 Calipers",
    category: "Parts",
    serial: "SH-DA-BR-9270",
    price: 430,
    image: "https://images.unsplash.com/photo-1565278799737-b1e01a6dd5f5?q=80&w=1000&auto=format&fit=crop",
    description: "Top-tier hydraulic disc brake calipers with Servo Wave technology for unmatched stopping power.",
    values: {
      attr_7: "Shimano Flat Mount",
      attr_8: "Forged Aluminum",
      attr_9: "116g per caliper",
      attr_10: "SH-BR-R9270-F/R",
    },
    rating: 4.9,
    inStock: true,
  },
];

// Helper to get products by category
export function getProductsByCategory(category: "Bicycle" | "Parts") {
  return products.filter((p) => p.category === category);
}

// Helper to get attributes by category
export function getAttributesByCategory(category: "Bicycle" | "Parts") {
  return attributes.filter((a) => a.category === category);
}

// Helper to get public attributes for a product
export function getPublicAttributes(product: Product) {
  return attributes
    .filter((a) => a.category === product.category && a.isPublic && product.values[a.id])
    .map((a) => ({ ...a, value: product.values[a.id] }));
}

// Helper to get all attributes for admin
export function getAllAttributes(product: Product) {
  return attributes
    .filter((a) => a.category === product.category)
    .map((a) => ({ ...a, value: product.values[a.id] || "" }));
}
