// AUTO-GENERATED from Product_data_sheet_completed.xlsx (phase 2). Do not edit by
// hand — re-run the transform when the source sheet changes. Prices are quote-only (0).

export type SeedCategory = { slug: string; name: string; blurb?: string; parentSlug?: string; order?: number };
export type SeedProduct = {
  slug: string; name: string; brand: string; categorySlug: string; sku: string;
  price: number; mrp?: number; moq: number; unit: string;
  inStock: boolean; featured: boolean; badges?: string[]; sizes?: string[];
  priceTiers?: { minQty: number; price: number }[];
  specs: { label: string; value: string }[]; shortDesc: string;
};

export const seedCategories: SeedCategory[] = [
  {
    "slug": "electrodes",
    "name": "Electrodes",
    "blurb": "Reference, counter & working electrodes for electrochemistry",
    "order": 1
  },
  {
    "slug": "membranes",
    "name": "Membranes",
    "blurb": "Proton, anion, bipolar & cation exchange membranes",
    "order": 2
  },
  {
    "slug": "reactor-cell",
    "name": "Reactors & Cells",
    "blurb": "Water-splitting, CO₂ electrolysis, photo-EC, fuel-cell & battery reactors",
    "order": 3
  },
  {
    "slug": "equipments",
    "name": "Equipments",
    "blurb": "Peristaltic pumps, MEA fabrication & specialised research equipment",
    "order": 4
  },
  {
    "slug": "accessories",
    "name": "Accessories",
    "blurb": "Electrode materials, sheets, nanoparticles & lab consumables",
    "order": 5
  },
  {
    "slug": "reference-electrodes",
    "name": "Reference Electrodes",
    "parentSlug": "electrodes",
    "order": 1
  },
  {
    "slug": "counter-electrodes",
    "name": "Counter Electrodes",
    "parentSlug": "electrodes",
    "order": 2
  },
  {
    "slug": "working-electrodes",
    "name": "Working Electrodes",
    "parentSlug": "electrodes",
    "order": 3
  },
  {
    "slug": "pem-membranes",
    "name": "Proton Exchange Membranes (PEM)",
    "parentSlug": "membranes",
    "order": 1
  },
  {
    "slug": "aem-membranes",
    "name": "Anion Exchange Membranes (AEM)",
    "parentSlug": "membranes",
    "order": 2
  },
  {
    "slug": "bipolar-membranes",
    "name": "Bipolar Membranes (BPM)",
    "parentSlug": "membranes",
    "order": 3
  },
  {
    "slug": "cem-membranes",
    "name": "Cation Exchange Membranes (CEM)",
    "parentSlug": "membranes",
    "order": 4
  },
  {
    "slug": "water-splitting-reactors",
    "name": "Water-Splitting Reactors",
    "parentSlug": "reactor-cell",
    "order": 1
  },
  {
    "slug": "co2-electrolysis",
    "name": "CO₂ Electrolysis & Carbon Utilization",
    "parentSlug": "reactor-cell",
    "order": 2
  },
  {
    "slug": "photo-ec-reactors",
    "name": "Photo-Electrochemical Reactors",
    "parentSlug": "reactor-cell",
    "order": 3
  },
  {
    "slug": "fuel-cells",
    "name": "Fuel Cells",
    "parentSlug": "reactor-cell",
    "order": 4
  },
  {
    "slug": "battery-reactors",
    "name": "Battery Reactors",
    "parentSlug": "reactor-cell",
    "order": 5
  },
  {
    "slug": "peristaltic-pumps",
    "name": "Peristaltic Pumps",
    "parentSlug": "equipments",
    "order": 1
  },
  {
    "slug": "specialised-equipment",
    "name": "Specialised Research Equipment",
    "parentSlug": "equipments",
    "order": 2
  },
  {
    "slug": "mea-fabrication",
    "name": "MEA Fabrication Equipment",
    "parentSlug": "equipments",
    "order": 3
  }
];

export const seedProducts: SeedProduct[] = [
  {
    "slug": "silver-silver-chloride-ag-agcl-reference-electrode",
    "name": "Silver Silver Chloride Ag/AgCl Reference Electrode",
    "brand": "METNMAT",
    "categorySlug": "reference-electrodes",
    "sku": "MT-RE-AGCL-P03",
    "price": 6499,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [
      "Ø3 mm"
    ],
    "specs": [
      {
        "label": "Body / Material",
        "value": "PEEK"
      },
      {
        "label": "tube diameter",
        "value": "3 mm"
      },
      {
        "label": "effective length",
        "value": "60 mm"
      },
      {
        "label": "liquid junction core",
        "value": "Porous PTFE core"
      },
      {
        "label": "filling solution",
        "value": "3.5M KCl"
      },
      {
        "label": "Reference Potential",
        "value": "+0.197 V vs. SHE (Standard Hydrogen Electrode) at 25°C"
      },
      {
        "label": "potential stability",
        "value": "<5 mV"
      },
      {
        "label": "operating temperature",
        "value": "0-100 deg C"
      },
      {
        "label": "Body Material",
        "value": "PEEK"
      },
      {
        "label": "In the box",
        "value": "1 * Ag/AgCl reference electrode with gold-plated pin\r, , 1 * syringe\r, , 1 * Fine needle\r, , 1 * cap\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Ag/AgCl Reference Electrode is the industry-standard reference electrode for aqueous electrochemical measurements, providing a highly stable and reproducible reference potential for accurate control of electrochemical reactions."
  },
  {
    "slug": "ag-agcl-reference-electrode-6-mm",
    "name": "Ag/AgCl Reference Electrode (Ø6 mm)",
    "brand": "METNMAT",
    "categorySlug": "reference-electrodes",
    "sku": "MT-RE-AGCL-T06",
    "price": 6499,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "Ø6 mm"
    ],
    "specs": [
      {
        "label": "tube diameter",
        "value": "6 mm"
      },
      {
        "label": "effective length",
        "value": "60 mm"
      },
      {
        "label": "liquid junction core",
        "value": "Porous PTFE core"
      },
      {
        "label": "filling solution",
        "value": "3.5M KCl"
      },
      {
        "label": "Reference Potential",
        "value": "+0.197 V vs. SHE (Standard Hydrogen Electrode) at 25°C"
      },
      {
        "label": "potential stability",
        "value": "<5 mV"
      },
      {
        "label": "operating temperature",
        "value": "0-100 deg C"
      },
      {
        "label": "Body Mateirial",
        "value": "PTFE"
      },
      {
        "label": "In the box",
        "value": "1 * Ag/AgCl reference electrode with gold-plated pin\r, , 1 * syringe\r, , 1 * Fine needle\r, , 1 * cap\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Ag/AgCl Reference Electrode is the industry-standard reference electrode for aqueous electrochemical measurements, providing a highly stable and reproducible reference potential for accurate control of electrochemical reactions."
  },
  {
    "slug": "ag-agcl-reference-electrode-6-140-mm",
    "name": "Ag/AgCl Reference Electrode (Ø6 × 140 mm)",
    "brand": "METNMAT",
    "categorySlug": "reference-electrodes",
    "sku": "MT-RE-AGCL-G06",
    "price": 6499,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "Ø6 × 140 mm",
      "Ø4 × 90 mm",
      "Ø2 × 50 mm",
      "Ø6 × 70 mm",
      "Ø2.4 × 60 mm",
      "Ø4 × 50 mm"
    ],
    "specs": [
      {
        "label": "liquid junction core",
        "value": "microporous ceramic filter core"
      },
      {
        "label": "filling solution",
        "value": "3M/3.5M KCl"
      },
      {
        "label": "Reference Potential",
        "value": "+0.197 V vs. SHE (Standard Hydrogen Electrode) at 25°C"
      },
      {
        "label": "potential stability",
        "value": "<5 mV"
      },
      {
        "label": "operating temperature",
        "value": "0-100 deg C"
      },
      {
        "label": "Body Material",
        "value": "Glass"
      },
      {
        "label": "In the box",
        "value": "1 * Ag/AgCl reference electrode with gold-plated pin\r, , 1 * cap\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Ag/AgCl Reference Electrode is the industry-standard reference electrode for aqueous electrochemical measurements, providing a highly stable and reproducible reference potential for accurate control of electrochemical reactions."
  },
  {
    "slug": "mercury-oxide-reference-electrode-hg-hgo",
    "name": "Mercury Oxide Reference Electrode Hg/HgO",
    "brand": "METNMAT",
    "categorySlug": "reference-electrodes",
    "sku": "MT-RE-HGHO-P04",
    "price": 6499,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "Ø4 × 60 mm"
    ],
    "specs": [
      {
        "label": "Body / Material",
        "value": "PEEK"
      },
      {
        "label": "liquid junction core",
        "value": "microporous ceramic filter core"
      },
      {
        "label": "filling solution",
        "value": "1M KOH"
      },
      {
        "label": "Reference Potential",
        "value": "+0.098 V vs. NHE (Normal Hydrogen Electrode) at 25°C in 1M KOH"
      },
      {
        "label": "potential stability",
        "value": "<5 mV"
      },
      {
        "label": "operating temperature",
        "value": "0-40 deg C"
      },
      {
        "label": "Body Material",
        "value": "PEEK"
      },
      {
        "label": "In the box",
        "value": "1 * PEEK Hg/HgO reference electrode with gold-plated pin\r, , 1 * cap\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Hg/HgO Reference Electrode is specifically engineered for alkaline electrochemical systems where stable potential control is critical. Utilizing the mercury/mercury oxide equilibrium, it delivers highly reproducible reference potentials in potassium hydroxide and other alkaline electrolytes."
  },
  {
    "slug": "hg-hgo-reference-electrode-6-60-mm",
    "name": "Hg/HgO Reference Electrode (Ø6 × 60 mm)",
    "brand": "METNMAT",
    "categorySlug": "reference-electrodes",
    "sku": "MT-RE-HGHO-T06",
    "price": 6499,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "Ø6 × 60 mm"
    ],
    "specs": [
      {
        "label": "liquid junction core",
        "value": "microporous ceramic filter core"
      },
      {
        "label": "filling solution",
        "value": "1M KOH"
      },
      {
        "label": "Reference Potential",
        "value": "+0.098 V vs. NHE (Normal Hydrogen Electrode) at 25°C in 1M KOH"
      },
      {
        "label": "potential stability",
        "value": "<5 mV"
      },
      {
        "label": "operating temperature",
        "value": "0-40 deg C"
      },
      {
        "label": "Body Material",
        "value": "PTFE"
      },
      {
        "label": "In the box",
        "value": "1 * Teflon Hg/HgO reference electrode with gold-plated pin\r, , 1 * cap\r, , 1 * fluorine rubber O-ring\r,"
      }
    ],
    "shortDesc": "The Hg/HgO Reference Electrode is specifically engineered for alkaline electrochemical systems where stable potential control is critical. Utilizing the mercury/mercury oxide equilibrium, it delivers highly reproducible reference potentials in potassium hydroxide and other alkaline electrolytes."
  },
  {
    "slug": "hg-hgo-reference-electrode-6-70-mm",
    "name": "Hg/HgO Reference Electrode (Ø6 × 70 mm)",
    "brand": "METNMAT",
    "categorySlug": "reference-electrodes",
    "sku": "MT-RE-HGHO-G06",
    "price": 6499,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "Ø6 × 70 mm",
      "Ø4 × 70 mm"
    ],
    "specs": [
      {
        "label": "liquid junction core",
        "value": "microporous ceramic filter core"
      },
      {
        "label": "filling solution",
        "value": "1M KOH"
      },
      {
        "label": "Reference Potential",
        "value": "+0.098 V vs. NHE (Normal Hydrogen Electrode) at 25°C in 1M KOH"
      },
      {
        "label": "potential stability",
        "value": "<5 mV"
      },
      {
        "label": "operating temperature",
        "value": "0-40 deg C"
      },
      {
        "label": "Body Material",
        "value": "Glass"
      },
      {
        "label": "In the box",
        "value": "1 * Hg/HgO reference electrode with gold-plated pin\r, , 1 * cap\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Hg/HgO Reference Electrode is specifically engineered for alkaline electrochemical systems where stable potential control is critical. Utilizing the mercury/mercury oxide equilibrium, it delivers highly reproducible reference potentials in potassium hydroxide and other alkaline electrolytes."
  },
  {
    "slug": "non-aqueous-silver-silver-ion-reference-electrode-ag-ag",
    "name": "Non-aqueous Silver/Silver Ion Reference Electrode Ag/Ag+",
    "brand": "METNMAT",
    "categorySlug": "reference-electrodes",
    "sku": "MT-RE-AGAG-G24",
    "price": 6499,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "Ø2.4 × 60 mm"
    ],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Glass Rod"
      },
      {
        "label": "tube diameter",
        "value": "2.4 mm"
      },
      {
        "label": "effective length",
        "value": "60 mm"
      },
      {
        "label": "liquid junction core",
        "value": "microporous ceramic filter core"
      },
      {
        "label": "filling solution",
        "value": "0.01M AgNO3 and 0.1M TBAP in acetonitrile"
      },
      {
        "label": "potential stability",
        "value": "<5 mV"
      },
      {
        "label": "operating temperature",
        "value": "0-75 deg C"
      },
      {
        "label": "Applications",
        "value": "Lithium-Ion Battery Research\r, Sodium-Ion Battery Research\r, Organic Electrochemistry\r, Non-Aqueous Voltammetry\r, Electrochemical Synthesis\r, Redox Mechanism Studies\r, Electrolyte Development\r, Energy Storage Research"
      },
      {
        "label": "In the box",
        "value": "1 * Ag/Ag+ reference electrode with gold-plated pin\r, , 1 * syringe\r, , 1 * Fine needle\r, , 1 * cap\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Ag/Ag⁺ Non-Aqueous Reference Electrode is designed for electrochemical measurements in organic solvents and non-aqueous electrolyte systems where conventional aqueous reference electrodes cannot be used."
  },
  {
    "slug": "saturated-calomel-electrode-hg-hg2cl2",
    "name": "Saturated Calomel Electrode Hg/Hg2Cl2",
    "brand": "METNMAT",
    "categorySlug": "reference-electrodes",
    "sku": "MT-RE-SCEM-G06",
    "price": 6499,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "Ø5.75 × 50 mm",
      "Ø6 × 70 mm",
      "Ø6 × 95 mm"
    ],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Glass Rod"
      },
      {
        "label": "liquid junction core",
        "value": "microporous ceramic filter core"
      },
      {
        "label": "filling solution",
        "value": "Saturated KCl"
      },
      {
        "label": "Reference Potential",
        "value": "+0.244 V vs. SHE (Standard Hydrogen Electrode) at 25°C"
      },
      {
        "label": "potential stability",
        "value": "<5 mV"
      },
      {
        "label": "operating temperature",
        "value": "0-40 deg C"
      },
      {
        "label": "Applications",
        "value": "Corrosion Studies\r, Electroplating Research\r, Cyclic Voltammetry\r, Electrochemical Characterization\r, Coating Evaluation\r, Material Testing\r, Sensor Development\r, Academic Research"
      },
      {
        "label": "In the box",
        "value": "1 * Saturated calomel electrode with gold-plated pin\r, , 1 * cap\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Saturated Calomel Electrode (SCE) is one of the most widely recognized reference electrodes in electrochemistry, valued for its highly stable and reproducible reference potential."
  },
  {
    "slug": "mercurous-sulfate-reference-electrode-hg-hg2so4",
    "name": "Mercurous Sulfate Reference Electrode Hg/Hg2SO4",
    "brand": "METNMAT",
    "categorySlug": "reference-electrodes",
    "sku": "MT-RE-MSEM-G06",
    "price": 6499,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "Ø6 × 70 mm"
    ],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Glass Rod"
      },
      {
        "label": "tube diameter",
        "value": "6 mm"
      },
      {
        "label": "effective length",
        "value": "70 mm"
      },
      {
        "label": "liquid junction core",
        "value": "microporous ceramic filter core"
      },
      {
        "label": "filling solution",
        "value": "Saturated K2SO4"
      },
      {
        "label": "Reference Potential",
        "value": "+0.658 V vs. NHE (Normal Hydrogen Electrode) at 25°C"
      },
      {
        "label": "potential stability",
        "value": "<5 mV"
      },
      {
        "label": "temperature",
        "value": "0-40 deg C"
      },
      {
        "label": "Applications",
        "value": "Corrosion Testing\r, Sulfate-Based Electrolyte Studies\r, Environmental Electrochemistry\r, Electrochemical Sensors\r, Material Characterization\r, Metal Surface Analysis\r, Industrial Electrochemistry\r, Research Laboratories"
      },
      {
        "label": "In the box",
        "value": "1 * Hg/Hg2SO4 reference electrode with gold-plated pin\r, , 1 * cap\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Mercurous Sulfate Reference Electrode (Hg/Hg₂SO₄) is a highly stable reference electrode specifically suited for sulfate-containing and chloride-sensitive electrochemical systems."
  },
  {
    "slug": "platinum-counter-electrode",
    "name": "Platinum Counter Electrode",
    "brand": "METNMAT",
    "categorySlug": "counter-electrodes",
    "sku": "MT-CE-PTSH-303",
    "price": 8999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [
      "30 × 30 × 0.1 mm",
      "20 × 20 × 0.1 mm",
      "15 × 20 × 0.1 mm",
      "10 × 10 × 0.1 mm"
    ],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Sheet"
      },
      {
        "label": "electrode material",
        "value": "Platinum 99.95%"
      },
      {
        "label": "body material",
        "value": "PTFE"
      },
      {
        "label": "body diameter",
        "value": "6 mm"
      },
      {
        "label": "body length",
        "value": "80 mm"
      },
      {
        "label": "Applications",
        "value": "Electrocatalysis\r, Electrolysis\r, Catalyst Screening\r, Water Splitting Research\r, Electrochemical Synthesis"
      },
      {
        "label": "In the box",
        "value": "1 * platinum sheet electrode with gold-plated pin\r, , 1 * fluorine rubber O-ring\r,"
      }
    ],
    "shortDesc": "The Platinum sheet Counter Electrode provides a large, flat conductive surface that enables stable and efficient current transfer in electrochemical systems."
  },
  {
    "slug": "platinum-mesh-counter-electrode-30-30-mm",
    "name": "Platinum Mesh Counter Electrode (30 × 30 mm)",
    "brand": "METNMAT",
    "categorySlug": "counter-electrodes",
    "sku": "MT-CE-PTMS-303",
    "price": 8999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "30 × 30 mm",
      "20 × 20 mm",
      "10 × 10 mm"
    ],
    "specs": [
      {
        "label": "electrode material",
        "value": "Platinum 99.95%"
      },
      {
        "label": "mesh count",
        "value": "52"
      },
      {
        "label": "mesh wire diameter",
        "value": "120 µm"
      },
      {
        "label": "connection wire diameter",
        "value": "500 µm"
      },
      {
        "label": "body material",
        "value": "PTFE"
      },
      {
        "label": "body diameter",
        "value": "6 mm"
      },
      {
        "label": "body length",
        "value": "80 mm"
      },
      {
        "label": "Applications",
        "value": "PEM Electrolyzers\r, AEM Electrolyzers\r, Water Splitting\r, Fuel Cell Testing\r, Electrocatalysis\r, High Current Density Experiments"
      },
      {
        "label": "In the box",
        "value": "1 * platinum gauze electrode with gold-plated pin\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Platinum Mesh Counter Electrode combines the exceptional chemical stability of platinum with a high-surface-area mesh structure to deliver superior electrochemical performance."
  },
  {
    "slug": "platinum-wire-counter-electrode-1-37-mm",
    "name": "Platinum Wire Counter Electrode (Ø1 × 37 mm)",
    "brand": "METNMAT",
    "categorySlug": "counter-electrodes",
    "sku": "MT-CE-PTWP-137",
    "price": 8999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "Ø1 × 37 mm",
      "Ø0.5 × 37 mm"
    ],
    "specs": [
      {
        "label": "electrode material",
        "value": "Platinum 99.95%"
      },
      {
        "label": "wire diameter",
        "value": "500 µm"
      },
      {
        "label": "wire length",
        "value": "37 mm"
      },
      {
        "label": "body material",
        "value": "PTFE"
      },
      {
        "label": "body diameter",
        "value": "6 mm"
      },
      {
        "label": "body length",
        "value": "40 mm"
      },
      {
        "label": "Applications",
        "value": "Cyclic Voltammetry (CV)\r, Electrochemical Impedance Spectroscopy (EIS)\r, Linear Sweep Voltammetry (LSV)\r, Corrosion Studies\r, Sensor Development\r, General Electrochemical Research"
      },
      {
        "label": "In the box",
        "value": "1 * platinum wire ring electrode with gold-plated pin\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Platinum Wire Counter Electrode is a high-purity auxiliary electrode designed for reliable current conduction in electrochemical measurements and electrolysis applications."
  },
  {
    "slug": "platinum-wire-counter-electrode-1-37-mm-ptwk",
    "name": "Platinum Wire Counter Electrode (Ø1 × 37 mm) · PTWK",
    "brand": "METNMAT",
    "categorySlug": "counter-electrodes",
    "sku": "MT-CE-PTWK-137",
    "price": 8999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "Ø1 × 37 mm",
      "Ø0.5 × 37 mm"
    ],
    "specs": [
      {
        "label": "electrode material",
        "value": "Platinum 99.95%"
      },
      {
        "label": "wire diameter",
        "value": "500 µm"
      },
      {
        "label": "wire length",
        "value": "37 mm"
      },
      {
        "label": "body material",
        "value": "PEEK"
      },
      {
        "label": "body diameter",
        "value": "6 mm"
      },
      {
        "label": "body length",
        "value": "40 mm"
      },
      {
        "label": "Applications",
        "value": "Cyclic Voltammetry (CV)\r, Electrochemical Impedance Spectroscopy (EIS)\r, Linear Sweep Voltammetry (LSV)\r, Corrosion Studies\r, Sensor Development\r, General Electrochemical Research"
      },
      {
        "label": "In the box",
        "value": "1 * platinum wire ring electrode with gold-plated pin\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Platinum Wire Counter Electrode is a high-purity auxiliary electrode designed for reliable current conduction in electrochemical measurements and electrolysis applications."
  },
  {
    "slug": "platinum-ring-counter-electrode-0-5-230-mm",
    "name": "Platinum Ring Counter Electrode (Ø0.5 × 230 mm)",
    "brand": "METNMAT",
    "categorySlug": "counter-electrodes",
    "sku": "MT-CE-PTRW-230",
    "price": 8999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "Ø0.5 × 230 mm",
      "Ø0.5 × 100 mm"
    ],
    "specs": [
      {
        "label": "electrode material",
        "value": "Platinum 99.95%"
      },
      {
        "label": "helix inner diameter",
        "value": "4 mm"
      },
      {
        "label": "helix outer diameter",
        "value": "5 mm"
      },
      {
        "label": "wire diameter",
        "value": "500 µm"
      },
      {
        "label": "body material",
        "value": "PEEK"
      },
      {
        "label": "body diameter",
        "value": "6 mm"
      },
      {
        "label": "body length",
        "value": "40 mm"
      },
      {
        "label": "Applications",
        "value": "Cyclic Voltammetry\r, Analytical Electrochemistry\r, Sensor Research\r, Electrode Kinetics Studies\r, Academic Research"
      },
      {
        "label": "In the box",
        "value": "1 * platinum wire ring electrode with gold-plated pin\r, , 1 * fluorine rubber O-ring\r,"
      }
    ],
    "shortDesc": "The Platinum Ring Counter Electrode is designed to provide uniform current distribution and stable electrochemical performance in analytical and research applications."
  },
  {
    "slug": "platinum-spiral-counter-electrode",
    "name": "Platinum Spiral Counter Electrode",
    "brand": "METNMAT",
    "categorySlug": "counter-electrodes",
    "sku": "MT-CE-PTSP-500",
    "price": 8999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Sheath Material",
        "value": "PTFE (6 mm)"
      },
      {
        "label": "Helix Length",
        "value": "50 cm"
      },
      {
        "label": "Platinum Wire",
        "value": "0.5 mm diameter × 50 cm length"
      },
      {
        "label": "Platinum Purity",
        "value": "99.95%"
      },
      {
        "label": "Active Surface Area",
        "value": "8 cm²"
      },
      {
        "label": "Conductive Substrate",
        "value": "Gold-Plated Copper Rod"
      },
      {
        "label": "Compatibility",
        "value": "Suitable for water-splitting reactor"
      },
      {
        "label": "Applications",
        "value": "Water Electrolysis\r, HER Studies\r, OER Studies\r, CO₂ Reduction Research\r, Fuel Cell Research\r, Long-Term Electrolysis"
      },
      {
        "label": "In the box",
        "value": "1 × Platinum spiral electrode with gold-plated pin"
      }
    ],
    "shortDesc": "The Platinum Spiral Counter Electrode features an enhanced surface area design that promotes efficient current distribution and minimizes polarization effects during electrochemical experiments."
  },
  {
    "slug": "graphite-counter-electrode",
    "name": "Graphite Counter Electrode",
    "brand": "METNMAT",
    "categorySlug": "counter-electrodes",
    "sku": "MT-CE-GRPH-103",
    "price": 8999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "10 × 10 × 3 mm"
    ],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Plate"
      },
      {
        "label": "body material",
        "value": "High purity graphite"
      },
      {
        "label": "body size",
        "value": "10 × 10 mm"
      },
      {
        "label": "body thickness",
        "value": "3 mm"
      },
      {
        "label": "Applications",
        "value": "Flow Cells\r, CO₂ Electrolysis\r, Electrocatalysis\r, Wastewater Treatment\r, Custom Reactor Development"
      },
      {
        "label": "In the box",
        "value": "1 * graphite plate electrode with gold-plated pin\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Graphite Plate Counter Electrode provides a cost-effective and chemically resistant alternative to precious metal electrodes for electrochemical and electrolysis applications."
  },
  {
    "slug": "graphite-rod-counter-electrode-6-80-mm",
    "name": "Graphite Rod Counter Electrode (Ø6 × 80 mm)",
    "brand": "METNMAT",
    "categorySlug": "counter-electrodes",
    "sku": "MT-CE-GRRD-680",
    "price": 8999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "Ø6 × 80 mm",
      "Ø6 × 60 mm",
      "Ø6 × 120 mm"
    ],
    "specs": [
      {
        "label": "body material",
        "value": "High purity graphite"
      },
      {
        "label": "graphite purity",
        "value": "99.99%"
      },
      {
        "label": "Applications",
        "value": "Electrochemical Testing\r, Water Treatment Research\r, Electrolysis\r, Corrosion Studies\r, Educational Laboratories"
      },
      {
        "label": "In the box",
        "value": "1 * graphite rod electrode with gold-plated pin\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Graphite Rod Counter Electrode is a versatile and economical auxiliary electrode designed for routine electrochemical experiments and electrolysis systems."
  },
  {
    "slug": "detachable-gold-disk-electrode",
    "name": "Detachable Gold Disk Electrode",
    "brand": "METNMAT",
    "categorySlug": "working-electrodes",
    "sku": "MT-WE-AUDL-4MM",
    "price": 7999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [
      "4 mm"
    ],
    "specs": [
      {
        "label": "Body / Material",
        "value": "L-Shaped"
      },
      {
        "label": "disk diameter",
        "value": "4 mm"
      },
      {
        "label": "conductive copper rod",
        "value": "Ø2 × 20 mm"
      },
      {
        "label": "body material",
        "value": "PEEK wrapped with PTFE isolation ring"
      },
      {
        "label": "PTFE isolation ring diameter",
        "value": "5 mm"
      },
      {
        "label": "body diameter",
        "value": "6 mm"
      },
      {
        "label": "body length",
        "value": "80 mm"
      },
      {
        "label": "L-rod diameter",
        "value": "12 mm"
      },
      {
        "label": "L-rod length",
        "value": "10.5 mm"
      },
      {
        "label": "Applications",
        "value": "Biosensor Development\r, Surface Functionalization Studies\r, Cyclic Voltammetry (CV)\r, Electrochemical Impedance Spectroscopy (EIS)\r, Electrochemical Sensing\r, Electrocatalysis Research\r, Molecular and Surface Chemistry"
      },
      {
        "label": "In the box",
        "value": "1 * Detachable L-shaped gold disk Electrode with gold-plated pin\r, , 1 * cap\r, , 1 * fluorine rubber O-ring\r,"
      }
    ],
    "shortDesc": "The Detachable L-Shaped Gold Plate Disk Electrode is a high-performance working electrode designed for precision electrochemical analysis, biosensing, and surface chemistry research."
  },
  {
    "slug": "detachable-gold-disk-electrode-2-mm",
    "name": "Detachable Gold Disk Electrode (2 mm)",
    "brand": "METNMAT",
    "categorySlug": "working-electrodes",
    "sku": "MT-WE-AUDS-2KF",
    "price": 7999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "2 mm"
    ],
    "specs": [
      {
        "label": "disk diameter",
        "value": "2 mm"
      },
      {
        "label": "conductive copper rod",
        "value": "Ø2 × 20 mm"
      },
      {
        "label": "body material",
        "value": "PTCFE(Kel-F）"
      },
      {
        "label": "body diameter",
        "value": "6.4 mm"
      },
      {
        "label": "body length",
        "value": "80 mm"
      },
      {
        "label": "In the box",
        "value": "1 * gold electrode with gold-plated pin\r, , 1 * cap\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Detachable Gold Disk Electrode (Straight Type) is a precision-engineered working electrode designed for high-accuracy electrochemical measurements, surface characterization, and sensor development."
  },
  {
    "slug": "detachable-gold-disk-electrode-3-mm",
    "name": "Detachable Gold Disk Electrode (3 mm)",
    "brand": "METNMAT",
    "categorySlug": "working-electrodes",
    "sku": "MT-WE-AUDS-3PK",
    "price": 7999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "3 mm"
    ],
    "specs": [
      {
        "label": "disk diameter",
        "value": "3 mm"
      },
      {
        "label": "conductive copper rod",
        "value": "Ø2 × 20 mm"
      },
      {
        "label": "electrode head length",
        "value": "7 mm"
      },
      {
        "label": "body material",
        "value": "PEEK"
      },
      {
        "label": "body diameter",
        "value": "6 mm"
      },
      {
        "label": "body length",
        "value": "80 mm"
      },
      {
        "label": "In the box",
        "value": "1 * gold electrode with gold-plated pin\r, , 1 * cap\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Detachable Gold Disk Electrode (Straight Type) is a precision-engineered working electrode designed for high-accuracy electrochemical measurements, surface characterization, and sensor development."
  },
  {
    "slug": "detachable-gold-disk-electrode-2-mm-auds",
    "name": "Detachable Gold Disk Electrode (2 mm) · AUDS",
    "brand": "METNMAT",
    "categorySlug": "working-electrodes",
    "sku": "MT-WE-AUDS-2PT",
    "price": 7999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "2 mm"
    ],
    "specs": [
      {
        "label": "disk diameter",
        "value": "2 mm"
      },
      {
        "label": "conductive copper rod",
        "value": "Ø2 × 20 mm"
      },
      {
        "label": "body material",
        "value": "PTFE"
      },
      {
        "label": "body diameter",
        "value": "6 mm"
      },
      {
        "label": "body length",
        "value": "80 mm"
      },
      {
        "label": "In the box",
        "value": "1 * gold electrode with gold-plated pin\r, , 1 * cap\r, , 1 * fluorine rubber O-ring"
      }
    ],
    "shortDesc": "The Detachable Gold Disk Electrode (Straight Type) is a precision-engineered working electrode designed for high-accuracy electrochemical measurements, surface characterization, and sensor development."
  },
  {
    "slug": "detachable-platinum-disk-electrode",
    "name": "Detachable Platinum Disk Electrode",
    "brand": "METNMAT",
    "categorySlug": "working-electrodes",
    "sku": "MT-WE-PTDL-2MM",
    "price": 7999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "2 mm"
    ],
    "specs": [
      {
        "label": "Body / Material",
        "value": "L-Shaped"
      },
      {
        "label": "Electrode Material",
        "value": "High-Purity Platinum"
      },
      {
        "label": "Disk Diameter",
        "value": "2 mm"
      },
      {
        "label": "Body Material",
        "value": "PTFE"
      },
      {
        "label": "Body Diameter",
        "value": "6 mm"
      },
      {
        "label": "Body Length",
        "value": "80 mm"
      },
      {
        "label": "Connector",
        "value": "Gold-Plated Pin"
      },
      {
        "label": "Compatibility",
        "value": "Suitable for most potentiostat systems"
      },
      {
        "label": "Applications",
        "value": "Cyclic Voltammetry (CV)\r, Electrochemical Impedance Spectroscopy (EIS)\r, Electrocatalysis Research\r, Corrosion Studies\r, Sensor Development\r, HER and OER Studies"
      },
      {
        "label": "In the box",
        "value": "1 × Platinum Disk Working Electrode (Straight Type, 2 mm)\r, 1 × Protective Cap\r, 1 × Fluororubber O-Ring"
      }
    ],
    "shortDesc": "The Platinum Disk Working Electrode (Straight Type) is a precision electrochemical electrode designed for accurate and reproducible electrochemical measurements."
  },
  {
    "slug": "detachable-l-shaped-platinum-disk-electrode-4-mm",
    "name": "Detachable L-Shaped Platinum Disk Electrode (4 mm)",
    "brand": "METNMAT",
    "categorySlug": "working-electrodes",
    "sku": "MT-WE-PTDS-4ST",
    "price": 7999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "4 mm"
    ],
    "specs": [
      {
        "label": "Electrode Material",
        "value": "High-Purity Platinum"
      },
      {
        "label": "Electrode Type",
        "value": "Detachable L-Shaped Disk Working Electrode"
      },
      {
        "label": "Disk Diameter",
        "value": "4 mm"
      },
      {
        "label": "Body Material",
        "value": "PEEK with PTFE Insulation Ring"
      },
      {
        "label": "PTFE Insulation Ring Diameter",
        "value": "5 mm"
      },
      {
        "label": "Body Diameter",
        "value": "6 mm"
      },
      {
        "label": "Body Length",
        "value": "80 mm"
      },
      {
        "label": "Conductive Rod",
        "value": "Copper Rod, Ø2 × 20 mm"
      },
      {
        "label": "L-Rod Diameter",
        "value": "12 mm"
      },
      {
        "label": "L-Rod Length",
        "value": "10.5 mm"
      },
      {
        "label": "Connector",
        "value": "Gold-Plated Pin"
      },
      {
        "label": "Compatibility",
        "value": "Suitable for most commercial potentiostat systems"
      },
      {
        "label": "In the box",
        "value": "1 × Detachable L-Shaped Platinum Disk Electrode (4 mm)\r, 1 × Protective Cap\r, 1 × Fluororubber O-Ring"
      }
    ],
    "shortDesc": "The Detachable L-Shaped Platinum Disk Electrode is a high-performance working electrode designed for precise electrochemical analysis and electrocatalysis research."
  },
  {
    "slug": "titanium-felt-electrode",
    "name": "Titanium Felt Electrode",
    "brand": "METNMAT",
    "categorySlug": "working-electrodes",
    "sku": "MT-WE-TIFE-100",
    "price": 7999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Material",
        "value": "Titanium (Ti)"
      },
      {
        "label": "Structure",
        "value": "Porous Fiber Felt"
      },
      {
        "label": "Purity",
        "value": "≥ 99%"
      },
      {
        "label": "Size",
        "value": "100 × 100 mm (Custom sizes available)"
      },
      {
        "label": "Thickness",
        "value": "0.25 mm"
      },
      {
        "label": "Porosity",
        "value": "60–90%"
      },
      {
        "label": "Electrical Conductivity",
        "value": "High"
      },
      {
        "label": "Corrosion Resistance",
        "value": "Excellent"
      },
      {
        "label": "Temperature Resistance",
        "value": "Excellent"
      },
      {
        "label": "Application Environment",
        "value": "Acidic and Alkaline Electrochemical Systems"
      },
      {
        "label": "In the box",
        "value": "1 × Titanium Felt Electrode (100 × 100 mm)\r, Protective Packaging"
      }
    ],
    "shortDesc": "The Titanium Felt Electrode is a high-surface-area porous electrode material manufactured from sintered titanium fibers for demanding electrochemical and energy applications."
  },
  {
    "slug": "glassy-carbon-electrode-straight-type-ptfe-rod",
    "name": "Glassy Carbon Electrode Straight Type PTFE Rod",
    "brand": "METNMAT",
    "categorySlug": "working-electrodes",
    "sku": "MT-WE-GCDS-3PT",
    "price": 7999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "3 mm"
    ],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Straight Type"
      },
      {
        "label": "Electrode Material",
        "value": "Glassy Carbon"
      },
      {
        "label": "Electrode Type",
        "value": "Disk Working Electrode"
      },
      {
        "label": "Disk Diameter",
        "value": "3 mm"
      },
      {
        "label": "Body Material",
        "value": "PTFE"
      },
      {
        "label": "Body Diameter",
        "value": "6 mm"
      },
      {
        "label": "Body Length",
        "value": "80 mm"
      },
      {
        "label": "Conductive Rod",
        "value": "Copper Rod, Ø2 × 20 mm"
      },
      {
        "label": "Connector",
        "value": "Gold-Plated Pin"
      },
      {
        "label": "Compatibility",
        "value": "Suitable for most commercial potentiostat systems"
      },
      {
        "label": "Chemical Resistance",
        "value": "Excellent"
      },
      {
        "label": "In the box",
        "value": "1 × Glassy Carbon Disk Working Electrode (3 mm)\r, 1 × Protective Cap\r, 1 × Fluororubber O-Ring\r, USP"
      }
    ],
    "shortDesc": "The Glassy Carbon Disk Working Electrode is a versatile and widely used electrode for electrochemical analysis, electrocatalysis, and sensor research."
  },
  {
    "slug": "l-shaped-glassy-carbon-disk-working-electrode-3-mm",
    "name": "L-Shaped Glassy Carbon Disk Working Electrode (3 mm)",
    "brand": "METNMAT",
    "categorySlug": "working-electrodes",
    "sku": "MT-WE-GCDL-3PT",
    "price": 7999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [
      "3 mm"
    ],
    "specs": [
      {
        "label": "Electrode Material",
        "value": "Glassy Carbon"
      },
      {
        "label": "Electrode Type",
        "value": "L-Shaped Disk Working Electrode"
      },
      {
        "label": "Disk Diameter",
        "value": "3 mm"
      },
      {
        "label": "Body Material",
        "value": "PTFE"
      },
      {
        "label": "Body Diameter",
        "value": "6 mm"
      },
      {
        "label": "Body Length",
        "value": "80 mm"
      },
      {
        "label": "Conductive Rod",
        "value": "Copper Rod, Ø2 × 20 mm"
      },
      {
        "label": "L-Rod Diameter",
        "value": "12 mm"
      },
      {
        "label": "L-Rod Length",
        "value": "12 mm"
      },
      {
        "label": "Connector",
        "value": "Gold-Plated Pin"
      },
      {
        "label": "Compatibility",
        "value": "Suitable for most commercial potentiostat systems"
      },
      {
        "label": "Chemical Resistance",
        "value": "Excellent"
      },
      {
        "label": "In the box",
        "value": "1 × L-Shaped Glassy Carbon Disk Working Electrode (3 mm)\r, 1 × Gold-Plated Connector Pin\r, 1 × Protective Cap\r, 1 × Fluororubber O-Ring"
      }
    ],
    "shortDesc": "The L-Shaped Glassy Carbon Disk Working Electrode is designed for high-precision electrochemical analysis and research applications requiring reliable and reproducible measurements."
  },
  {
    "slug": "perfluorosulfonic-acid-pfsa-proton-exchange-membrane-n117-pem",
    "name": "Perfluorosulfonic acid (PFSA)-Proton exchange membrane N117 (PEM)",
    "brand": "METNMAT",
    "categorySlug": "pem-membranes",
    "sku": "MT-MB-PFSN-117",
    "price": 4999,
    "moq": 1,
    "unit": "sheet",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Perfluorosulfonic acid (PFSA)"
      },
      {
        "label": "Type",
        "value": "Proton Exchange Membrane"
      },
      {
        "label": "Ionic Form",
        "value": "H⁺ (Proton form)"
      },
      {
        "label": "Thickness",
        "value": "~183 μm (0.007 inch)"
      },
      {
        "label": "Density",
        "value": "~2.0 g/cm³"
      },
      {
        "label": "Equivalent Weight (EW)",
        "value": "~1100 g/mol"
      },
      {
        "label": "Ion Exchange Capacity (IEC)",
        "value": "~0.91 meq/g (dry)"
      },
      {
        "label": "Water Uptake",
        "value": "~22% (at 100% RH)"
      },
      {
        "label": "Proton Conductivity",
        "value": "~0.10 S/cm (at 100% RH and 30–80°C)"
      },
      {
        "label": "Area Resistance",
        "value": "~0.25–0.35 Ω·cm²"
      },
      {
        "label": "Tensile Strength",
        "value": ">30 MPa (dry); lower when hydrated"
      },
      {
        "label": "Swelling",
        "value": "10–15% in thickness when fully hydrated"
      },
      {
        "label": "Thermal Stability",
        "value": "Up to ~190 °C (decomposes >250°C)"
      },
      {
        "label": "pH Stability Range",
        "value": "0 – 4 (acidic conditions preferred)"
      },
      {
        "label": "Water Permeability",
        "value": "~2.0 × 10⁻⁶ cm²/s"
      },
      {
        "label": "Hydrogen Permeability",
        "value": "~2.5 × 10⁻⁶ cm³·cm/cm²·s·cmHg"
      },
      {
        "label": "Applications",
        "value": "PEM Water Electrolyzers\r, Hydrogen Fuel Cells\r, CO₂ Electrolysis\r, Redox Flow Batteries\r, Electrocatalysis Research\r, Photoelectrochemical Systems"
      },
      {
        "label": "In the box",
        "value": "1 × PFSA N117 membrane (100 × 100 mm)"
      }
    ],
    "shortDesc": "N117 (PEM) is a chemically-stable, proton-conductive membrane widely used in proton exchange membrane (PEM) fuel cells, water electrolyzers, chlor-alkali processes, and electrochemical research. It is a non-reinforced, PFSA membrane in the acid (H⁺) form."
  },
  {
    "slug": "perfluorosulfonic-acid-pfsa-proton-exchange-membrane-n212-pem",
    "name": "Perfluorosulfonic acid (PFSA)-Proton exchange membrane N212 (PEM)",
    "brand": "METNMAT",
    "categorySlug": "pem-membranes",
    "sku": "MT-MB-PFSN-212",
    "price": 4999,
    "moq": 1,
    "unit": "sheet",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Perfluorosulfonic acid (PFSA)"
      },
      {
        "label": "Type",
        "value": "Proton Exchange Membrane"
      },
      {
        "label": "Ionic Form",
        "value": "H⁺ (Proton form)"
      },
      {
        "label": "Thickness",
        "value": "~183 μm (0.007 inch)"
      },
      {
        "label": "Density",
        "value": "~2.0 g/cm³"
      },
      {
        "label": "Equivalent Weight (EW)",
        "value": "~1100 g/mol"
      },
      {
        "label": "Ion Exchange Capacity (IEC)",
        "value": "~0.91 meq/g (dry)"
      },
      {
        "label": "Water Uptake",
        "value": "~22% (at 100% RH)"
      },
      {
        "label": "Proton Conductivity",
        "value": "~0.10 S/cm (at 100% RH and 30–80°C)"
      },
      {
        "label": "Area Resistance",
        "value": "~0.25–0.35 Ω·cm²"
      },
      {
        "label": "Tensile Strength",
        "value": ">30 MPa (dry); lower when hydrated"
      },
      {
        "label": "Swelling",
        "value": "10–15% in thickness when fully hydrated"
      },
      {
        "label": "Thermal Stability",
        "value": "Up to ~190 °C (decomposes >250°C)"
      },
      {
        "label": "pH Stability Range",
        "value": "0 – 4 (acidic conditions preferred)"
      },
      {
        "label": "Water Permeability",
        "value": "~2.0 × 10⁻⁶ cm²/s"
      },
      {
        "label": "Hydrogen Permeability",
        "value": "~2.5 × 10⁻⁶ cm³·cm/cm²·s·cmHg"
      },
      {
        "label": "Applications",
        "value": "PEM Fuel Cells (portable & stationary)\r, PEM Water Electrolyzers\r, Hydrogen Pumps\r, Electrochemical Sensors\r, CO₂ Reduction & Electrolyzers\r, Redox Flow Batteries"
      },
      {
        "label": "In the box",
        "value": "1 × PFSA N212 membrane (100 × 100 mm)"
      }
    ],
    "shortDesc": "N212 is a non-reinforced PFSA membrane known for its thin profile, high proton conductivity, and excellent mechanical and chemical stability."
  },
  {
    "slug": "perfluorosulfonic-acid-pfsa-proton-exchange-membrane-n115-pem",
    "name": "Perfluorosulfonic acid (PFSA)-Proton exchange membrane N115 (PEM)",
    "brand": "METNMAT",
    "categorySlug": "pem-membranes",
    "sku": "MT-MB-PFSN-115",
    "price": 4999,
    "moq": 1,
    "unit": "sheet",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Perfluorosulfonic acid (PFSA)"
      },
      {
        "label": "Type",
        "value": "Proton Exchange Membrane (PEM)"
      },
      {
        "label": "Ionic Form",
        "value": "H⁺ (Proton form)"
      },
      {
        "label": "Thickness",
        "value": "~127 μm (0.005 inch)"
      },
      {
        "label": "Equivalent Weight (EW)",
        "value": "~1100 g/mol"
      },
      {
        "label": "Ion Exchange Capacity (IEC)",
        "value": "~0.91 meq/g (dry)"
      },
      {
        "label": "Proton Conductivity",
        "value": "~0.09 – 0.11 S/cm (fully hydrated at 25–80°C)"
      },
      {
        "label": "Area Resistance",
        "value": "~0.07 – 0.12 Ω·cm²"
      },
      {
        "label": "Water Uptake",
        "value": "~23–25%"
      },
      {
        "label": "Tensile Strength",
        "value": "~30 MPa (dry); decreases when wet"
      },
      {
        "label": "Swelling in Water",
        "value": "~10–12% (in thickness)"
      },
      {
        "label": "Thermal Stability",
        "value": "Up to ~190 °C (decomposes >250 °C)"
      },
      {
        "label": "pH Stability Range",
        "value": "0 – 4 (acidic environments)"
      },
      {
        "label": "Applications",
        "value": "PEM Fuel Cells (stationary and mobile)\r, PEM Water Electrolyzers\r, Electrolytic CO₂ Reduction\r, Electrochemical Sensors\r, Redox Flow Batteries\r, Electrochemical Research & Testing"
      },
      {
        "label": "In the box",
        "value": "1 × PFSA N115 membrane (100 × 100 mm)"
      }
    ],
    "shortDesc": "N115 is a moderately thick, non-reinforced PFSA cation exchange membrane designed for high chemical stability and efficient proton transport. It provides a balance between mechanical strength and low ionic resistance, making it ideal for fuel cells, electrolyzers, and electrochemical research."
  },
  {
    "slug": "fumasep-faa-3-50-anion-exchange-membrane",
    "name": "Fumasep FAA-3-50 – Anion Exchange Membrane",
    "brand": "METNMAT",
    "categorySlug": "aem-membranes",
    "sku": "MT-MB-AEMF-350",
    "price": 5499,
    "moq": 1,
    "unit": "sheet",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Fumasep FAA-3-50"
      },
      {
        "label": "Membrane Type",
        "value": "Anion Exchange Membrane (AEM)"
      },
      {
        "label": "Ionic Form (as shipped)",
        "value": "Chloride (Cl⁻)"
      },
      {
        "label": "Polymer Type",
        "value": "Quaternary ammonium functionalized polymer"
      },
      {
        "label": "Thickness (dry)",
        "value": "~50 μm"
      },
      {
        "label": "Ion Exchange Capacity (IEC)",
        "value": "1.5 – 2.0 mmol/g"
      },
      {
        "label": "In-plane Conductivity",
        "value": "~8 – 12 mS/cm (in Cl⁻ form)"
      },
      {
        "label": "Area Resistance",
        "value": "5 – 15 Ω·cm² (in 0.5M NaCl at 25°C)"
      },
      {
        "label": "Water Uptake",
        "value": "15 – 25%"
      },
      {
        "label": "Operating Temperature",
        "value": "Up to 60°C"
      },
      {
        "label": "pH Stability Range",
        "value": "2 – 10 (long-term), up to 12 (short-term)"
      },
      {
        "label": "Chemical Stability",
        "value": "Good in mild acids, bases, and solvents"
      },
      {
        "label": "Storage",
        "value": "Store dry or in Cl⁻ form, sealed from air"
      },
      {
        "label": "Applications",
        "value": "AEM water electrolysis (hydrogen production)\r, Alkaline AEM fuel cells\r, Electrodialysis\r, CO2 electrolysis research\r, Anion transport membrane studies"
      },
      {
        "label": "In the box",
        "value": "1x Fumasep FAA-3-50 membrane (100 × 100 mm)"
      }
    ],
    "shortDesc": "Fumasep FAA-3-50 is an anion exchange membrane (AEM) made from a polymer backbone with quaternary ammonium groups, specifically designed for applications like anion exchange membrane fuel cells (AEMFCs), CO₂ electrolysis, and electrochemical separation processes."
  },
  {
    "slug": "fumasep-fab-pk-130-anion-exchange-membrane",
    "name": "Fumasep FAB-PK-130 – Anion Exchange Membrane",
    "brand": "METNMAT",
    "categorySlug": "aem-membranes",
    "sku": "MT-MB-AFPK-130",
    "price": 5499,
    "moq": 1,
    "unit": "sheet",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Fumasep FAB-PK-130"
      },
      {
        "label": "Type",
        "value": "Anion Exchange Membrane (AEM)"
      },
      {
        "label": "Reinforcement",
        "value": "Polymeric mesh (PEEK-type or similar)"
      },
      {
        "label": "Ionic Form",
        "value": "Cl⁻ (Chloride)"
      },
      {
        "label": "Thickness (dry)",
        "value": "~130 μm"
      },
      {
        "label": "Ion Exchange Capacity (IEC)",
        "value": "~1.1 – 1.5 mmol/g"
      },
      {
        "label": "In-plane Conductivity",
        "value": "~10 – 15 mS/cm (in Cl⁻ form, wet)"
      },
      {
        "label": "Area Resistance",
        "value": "~5 – 10 Ω·cm² (in 0.5M NaCl, 25°C)"
      },
      {
        "label": "Water Uptake",
        "value": "15 – 25%"
      },
      {
        "label": "Stability Range (pH)",
        "value": "2 – 10 (long-term), up to 12 (short-term)"
      },
      {
        "label": "Operating Temperature",
        "value": "Up to 60°C (recommended)"
      },
      {
        "label": "Chemical Stability",
        "value": "Stable in alkaline & weak acidic media"
      },
      {
        "label": "Applications",
        "value": "Alkaline Fuel Cells (AEMFCs)\r, CO₂ Electrolysis / Reduction\r, Redox Flow Batteries (Zinc-air, Vanadium)\r, Electrodialysis & Ion Separation\r, Electrochemical Reactors"
      },
      {
        "label": "In the box",
        "value": "1 × Fumasep FAB-PK-130 membrane (100 × 100 mm)"
      }
    ],
    "shortDesc": "Fumasep FAB-PK-130 is a reinforced anion exchange membrane (AEM) designed for high-performance electrochemical applications."
  },
  {
    "slug": "fumasep-faa-3-20-anion-exchange-membrane",
    "name": "Fumasep FAA-3-20 – Anion Exchange Membrane",
    "brand": "METNMAT",
    "categorySlug": "aem-membranes",
    "sku": "MT-MB-AEMF-320",
    "price": 5499,
    "moq": 1,
    "unit": "sheet",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Fumasep FAA-3-20"
      },
      {
        "label": "Type",
        "value": "Anion Exchange Membrane (non-reinforced)"
      },
      {
        "label": "Ionic Form",
        "value": "Br⁻ (can be exchanged to Cl⁻, OH⁻, CO₃²⁻)"
      },
      {
        "label": "Appearance",
        "value": "Transparent light-brown thin foil"
      },
      {
        "label": "Backing",
        "value": "PET support foil"
      },
      {
        "label": "Thickness (dry)",
        "value": "~18 – 22 μm"
      },
      {
        "label": "Ion Exchange Capacity (IEC)",
        "value": "1.65 – 1.85 mmol/g"
      },
      {
        "label": "Area Resistance (Cl⁻ form, 0.5 M NaCl @25 °C)",
        "value": "< 2.0 Ω·cm²"
      },
      {
        "label": "Conductivity (Cl⁻ form)",
        "value": "> 5 mS/cm"
      },
      {
        "label": "Selectivity (KCl 0.1/0.5 M @25 °C)",
        "value": "> 90%"
      },
      {
        "label": "Water Uptake (Br⁻ form)",
        "value": "~7 wt%"
      },
      {
        "label": "Swelling in Water (Br⁻ form)",
        "value": "< 2%"
      },
      {
        "label": "pH Stability Range",
        "value": "1 – 12 (at 25 – 50 °C)"
      },
      {
        "label": "Applications",
        "value": "Alkaline Fuel Cells (AFC)\r, CO₂ Electrolysis Systems\r, Redox Flow Batteries\r, Electrodialysis and Ion Separation\r, Electrochemical Sensors\r, Alkaline Water Electrolyzers\r, R&D and Material Testing for AEM Technology"
      },
      {
        "label": "In the box",
        "value": "1 × Fumasep FAA-3-20 membrane (100 × 100 mm)"
      }
    ],
    "shortDesc": "Fumasep FAA-3-20 is a non-reinforced anion exchange membrane (AEM) based on a proprietary polymer structure. It is specially designed for electrochemical applications such as alkaline fuel cells, CO₂ electrolysis, redox flow batteries, and electrodialysis."
  },
  {
    "slug": "metnmat-aem-amberlite-pvp",
    "name": "METNMAT AEM Amberlite (PVP)",
    "brand": "METNMAT",
    "categorySlug": "aem-membranes",
    "sku": "MT-MB-AEAM-PVP",
    "price": 5499,
    "moq": 1,
    "unit": "sheet",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Crosslinked Polyvinylpyridine (PVP)"
      },
      {
        "label": "Membrane Type",
        "value": "Anion Exchange Membrane (AEM)"
      },
      {
        "label": "Polymer Base",
        "value": "Crosslinked Polyvinylpyridine (PVP)"
      },
      {
        "label": "Ionic Form (as supplied)",
        "value": "Chloride (Cl⁻)"
      },
      {
        "label": "Color",
        "value": "Amber-yellow"
      },
      {
        "label": "Physical Form",
        "value": "Flat Sheet"
      },
      {
        "label": "Thickness",
        "value": "~400 μm"
      },
      {
        "label": "Ion Exchange Capacity (IEC)",
        "value": "~1.5–2.0 meq/g"
      },
      {
        "label": "Water Uptake",
        "value": "20–40%"
      },
      {
        "label": "Tensile Strength (dry)",
        "value": "~10–20 MPa"
      },
      {
        "label": "Operating pH Range",
        "value": "1 – 14"
      },
      {
        "label": "Recommended Operating Temperature",
        "value": "Up to 60°C (long-term); short-term up to 80°C"
      },
      {
        "label": "Storage Form",
        "value": "Dry or stored in alkaline medium"
      },
      {
        "label": "Area-Specific Resistance (ASR)",
        "value": "~10–20 Ω·cm² (in OH⁻ form)"
      },
      {
        "label": "Applications",
        "value": "247"
      }
    ],
    "shortDesc": "Activation Instructions (Before First Use): To convert the membrane from chloride (Cl⁻) to hydroxide (OH⁻) form: 1.Prepare 5M KOH Solution using analytical-grade KOH and deionized water. 2.Soak the membrane in 5M KOH for 20 minutes at room temperature. 3."
  },
  {
    "slug": "sustainion-x37-50-grade-rt-anion-exchange-membrane-aem",
    "name": "Sustainion® X37-50 Grade RT – Anion Exchange Membrane (AEM)",
    "brand": "METNMAT",
    "categorySlug": "aem-membranes",
    "sku": "MT-MB-SX37-GRT",
    "price": 5499,
    "moq": 1,
    "unit": "sheet",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Imidazolium-functionalized polystyrene (Sustainion®)"
      },
      {
        "label": "Membrane Type",
        "value": "Anion Exchange Membrane (AEM)"
      },
      {
        "label": "Thickness",
        "value": "~50 μm"
      },
      {
        "label": "Ionic Form",
        "value": "Cl⁻ (as delivered)"
      },
      {
        "label": "Conductivity",
        "value": "80–120 mS/cm (in 1 M KOH)"
      },
      {
        "label": "Area Resistance",
        "value": "< 0.1 Ω·cm²"
      },
      {
        "label": "pH Stability",
        "value": "Up to pH 14"
      },
      {
        "label": "Operating Temperature",
        "value": "RT to 60°C"
      },
      {
        "label": "Reinforcement",
        "value": "Polymeric fiber matrix (high mechanical strength)"
      },
      {
        "label": "Applications",
        "value": "CO₂ electrolysis\r, AEM water electrolysis (H₂ production)\r, Alkaline fuel cells\r, Flow batteries (e.g., Zn-air)\r, Electrochemical sensors\r, Ion separation systems\r, Alkaline wastewater treatment"
      },
      {
        "label": "In the box",
        "value": "1 × Sustainion X37-50 Grade RT membrane (5 × 5 cm)"
      }
    ],
    "shortDesc": "Sustainion® X37-50 Grade RT is a premium anion exchange membrane (AEM) developed by Dioxide Materials, optimized for low-resistance, high-selectivity applications such as CO₂ electrolysis, AEM water electrolysis, and fuel cells."
  },
  {
    "slug": "sustainion-x37-fa-anion-exchange-membrane-aem",
    "name": "Sustainion® X37-FA - Anion Exchange Membrane (AEM)",
    "brand": "METNMAT",
    "categorySlug": "aem-membranes",
    "sku": "MT-MB-SX37-FAX",
    "price": 5499,
    "moq": 1,
    "unit": "sheet",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Fluoroalkyl-backbone imidazolium polymer (Sustainion® FA)"
      },
      {
        "label": "Membrane Type",
        "value": "Anion Exchange Membrane (AEM)"
      },
      {
        "label": "Polymer Backbone",
        "value": "Fluoroalkyl-based (FA)"
      },
      {
        "label": "Thickness",
        "value": "~50 μm"
      },
      {
        "label": "Ionic Form (as delivered)",
        "value": "Cl⁻ (Chloride)"
      },
      {
        "label": "Conductivity",
        "value": "~90–130 mS/cm (in 1 M KOH)"
      },
      {
        "label": "Area Resistance",
        "value": "< 0.1 Ω·cm²"
      },
      {
        "label": "Operating Temperature",
        "value": "Room Temperature (RT) to 60°C"
      },
      {
        "label": "pH Stability",
        "value": "Up to pH 14"
      },
      {
        "label": "Reinforcement",
        "value": "Polymeric fiber matrix"
      },
      {
        "label": "Water Uptake",
        "value": "Moderate (20–30%)"
      },
      {
        "label": "Applications",
        "value": "CO₂ electrolysis\r, AEM water electrolysis (H₂ production)\r, Alkaline fuel cells\r, Flow batteries (e.g., Zn-air)\r, Long-life alkaline electrochemical systems\r, Ion separation in harsh alkaline environments"
      },
      {
        "label": "In the box",
        "value": "1 × Sustainion X37-FA membrane (5 × 5 cm)"
      }
    ],
    "shortDesc": "Sustainion® X37-FA is a high-performance Anion Exchange Membrane (AEM) designed with a fluoroalkyl polymer backbone for superior chemical and mechanical durability."
  },
  {
    "slug": "fumasep-fbm-bipolar-ion-exchange-membrane",
    "name": "Fumasep FBM – Bipolar Ion Exchange Membrane",
    "brand": "METNMAT",
    "categorySlug": "bipolar-membranes",
    "sku": "MT-MB-BPMF-FBM",
    "price": 6999,
    "moq": 1,
    "unit": "sheet",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Composite Bipolar Ion Exchange Polymer comprising a Cation Exchange Layer (CEL) and an Anion Exchange Layer (AEL) laminated through a chemically stable interfacial layer."
      },
      {
        "label": "Type",
        "value": "Bipolar Membrane (CEM + AEM)"
      },
      {
        "label": "Function",
        "value": "Water dissociation into H⁺ and OH⁻"
      },
      {
        "label": "Structure",
        "value": "Anion Layer / Interface / Cation Layer"
      },
      {
        "label": "Thickness (dry)",
        "value": "~140 – 180 μm (typical)"
      },
      {
        "label": "Water Uptake",
        "value": "~20 – 30%"
      },
      {
        "label": "Area Resistance",
        "value": "< 10 Ω·cm²"
      },
      {
        "label": "Operating Temperature",
        "value": "Up to 60°C"
      },
      {
        "label": "pH Stability",
        "value": "1 – 10 (on each side, depending on configuration)"
      },
      {
        "label": "Dissociation Voltage",
        "value": "~0.8 – 1.0 V (typical)"
      },
      {
        "label": "Reinforcement",
        "value": "Optional (available in reinforced/unreinforced versions)"
      },
      {
        "label": "Storage",
        "value": "Dry or wet (sealed) in neutral ionic form"
      },
      {
        "label": "Applications",
        "value": "Electrodialysis and bipolar electrodialysis\r, Water treatment and resource recovery\r, pH control and acid/base production\r, CO₂ capture and conversion systems\r, Electro-synthesis and electrochemical separations"
      },
      {
        "label": "In the box",
        "value": "1 × Fumasep FBM bipolar membrane (100 × 100 mm)"
      }
    ],
    "shortDesc": "Fumasep FBM is a high-performance bipolar membrane designed for electrochemical applications requiring in-situ generation of acid and base. It combines a cation exchange layer (CEL) and an anion exchange layer (AEL) joined by a chemically stable interface to enable water dissociation under an electric field."
  },
  {
    "slug": "fumasep-fs-9100-pk-cation-exchange-membrane",
    "name": "Fumasep FS-9100-PK – Cation Exchange Membrane",
    "brand": "METNMAT",
    "categorySlug": "cem-membranes",
    "sku": "MT-MB-CEMF-9PK",
    "price": 4499,
    "moq": 1,
    "unit": "sheet",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Body / Material",
        "value": "Perfluorinated Sulfonic Acid Polymer (PFSA) reinforced with PK woven mesh"
      },
      {
        "label": "Type",
        "value": "Cation Exchange Membrane (PFSA-based)"
      },
      {
        "label": "Ionic Form",
        "value": "H⁺ (Proton form) Appearance: Translucent yellow-beige Thickness (dry): 85 – 100 μm"
      },
      {
        "label": "Areal Weight",
        "value": "19 – 21 mg/cm²"
      },
      {
        "label": "Ion Exchange Capacity (IEC)",
        "value": "1.08 – 1.15 meq/g"
      },
      {
        "label": "Area Resistance (0.5 M H₂SO₄)",
        "value": "< 0.45 Ω·cm²"
      },
      {
        "label": "Proton Conductivity",
        "value": "> 80 mS/cm"
      },
      {
        "label": "Selectivity",
        "value": "> 95% (KCl 0.1/0.5 M at 25 °C)"
      },
      {
        "label": "Acid Uptake (2 M H₂SO₄)",
        "value": "~14 wt%"
      },
      {
        "label": "Swelling (25 °C)",
        "value": "< 2%"
      },
      {
        "label": "Bubble Point",
        "value": "> 3 bar"
      },
      {
        "label": "Young’s Modulus",
        "value": "> 700 MPa"
      },
      {
        "label": "Tensile Strength",
        "value": "33 – 40 MPa"
      },
      {
        "label": "Elongation at Break",
        "value": "38 – 42%"
      },
      {
        "label": "Proton Resistance at 80 °C",
        "value": "< 0.16 Ω·cm²"
      },
      {
        "label": "Applications",
        "value": "PEM Water Electrolyzers\r, PEM Fuel Cells\r, Redox Flow Batteries\r, Hydrogen Generators\r, Electrodialysis Systems\r, Electrosynthesis"
      },
      {
        "label": "In the box",
        "value": "1 × Fumasep FS-9100-PK membrane (100 × 100 mm)"
      }
    ],
    "shortDesc": "Fumasep FS-9100-PK is a high-performance perfluorinated cation exchange membrane reinforced with PK woven mesh."
  },
  {
    "slug": "ewb-water-splitting-reactor",
    "name": "EWB Water Splitting Reactor",
    "brand": "METNMAT",
    "categorySlug": "water-splitting-reactors",
    "sku": "MT-RC-EWBR-STD",
    "price": 49999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Product Category",
        "value": "Water Electrolyzer"
      },
      {
        "label": "Model",
        "value": "EWB"
      },
      {
        "label": "Configuration",
        "value": "2-Electrode / 3-Electrode"
      },
      {
        "label": "Body Material",
        "value": "Transparent PMMA (Acrylic)"
      },
      {
        "label": "Electrode Area",
        "value": "Up to 5 cm²"
      },
      {
        "label": "Electrolyte Volume",
        "value": "40 mL per chamber"
      },
      {
        "label": "Electrode Spacing",
        "value": "< 2.5 cm"
      },
      {
        "label": "Membrane Compatible",
        "value": "Replaceable Ion-Exchange Membrane"
      },
      {
        "label": "Gas Port",
        "value": "Included"
      },
      {
        "label": "Sealing",
        "value": "Gas-Tight & Electrolyte Leak-Proof"
      },
      {
        "label": "Applications",
        "value": "Water electrolysis research\r, HER and OER catalyst evaluation\r, Green hydrogen production studies\r, Faradaic efficiency measurements\r, Membrane performance testing\r, Academic and industrial electrochemical research"
      },
      {
        "label": "In the box",
        "value": "EWB Reactor Assembly\r, Transparent PMMA Cell Body\r, Gas Collection Chambers\r, Membrane Holding Assembly\r, Sealing Gaskets and O-Rings\r, Fasteners and Fittings"
      }
    ],
    "shortDesc": "The METNMAT EWB Water Splitting Reactor is a transparent, gas-tight electrolyzer designed for hydrogen evolution (HER), oxygen evolution (OER), and overall water splitting studies."
  },
  {
    "slug": "photo-ewb-water-splitting-reactor-quartz-window",
    "name": "Photo-EWB Water Splitting Reactor (Quartz Window)",
    "brand": "METNMAT",
    "categorySlug": "water-splitting-reactors",
    "sku": "MT-RC-PEWB-QTZ",
    "price": 49999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Model",
        "value": "Photo-EWB"
      },
      {
        "label": "Configuration",
        "value": "2-Electrode / 3-Electrode"
      },
      {
        "label": "Body Material",
        "value": "Transparent PMMA (Acrylic)"
      },
      {
        "label": "Optical Window",
        "value": "UV-Transparent Quartz"
      },
      {
        "label": "Electrode Area",
        "value": "Up to 5 cm²"
      },
      {
        "label": "Electrolyte Volume",
        "value": "40 mL per chamber"
      },
      {
        "label": "Electrode Spacing",
        "value": "< 2.5 cm"
      },
      {
        "label": "Membrane Compatible",
        "value": "Replaceable Ion-Exchange Membrane"
      },
      {
        "label": "Gas Collection",
        "value": "Integrated H₂ and O₂ Collection"
      },
      {
        "label": "Sealing",
        "value": "Gas-Tight & Electrolyte Leak-Proof"
      },
      {
        "label": "In the box",
        "value": "Photo-EWB Reactor Assembly\r, Quartz Window Assembly\r, Transparent PMMA Cell Body\r, Gas Collection Chambers\r, Membrane Holding Assembly\r, Sealing Gaskets and O-Rings\r, Fasteners and Fittings"
      }
    ],
    "shortDesc": "The METNMAT Photo-EWB Reactor is a specialized photoelectrochemical water splitting cell designed for studying light-driven hydrogen production, photoelectrode performance, and solar fuel generation."
  },
  {
    "slug": "high-temperature-pem-aem-electrolyzer-hardware",
    "name": "High Temperature PEM/AEM Electrolyzer Hardware",
    "brand": "METNMAT",
    "categorySlug": "water-splitting-reactors",
    "sku": "MT-RC-PAEL-HTM",
    "price": 49999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Product Category",
        "value": "High-Temperature Water Electrolyzer"
      },
      {
        "label": "Models",
        "value": "ETH-5 and ETH-25"
      },
      {
        "label": "ETH-5",
        "value": "5 cm²"
      },
      {
        "label": "ETH-25",
        "value": "25 cm²"
      },
      {
        "label": "Anode Flow Field",
        "value": "Titanium Plate"
      },
      {
        "label": "Cathode Flow Field",
        "value": "Graphite Plate"
      },
      {
        "label": "End Plates",
        "value": "316 Stainless Steel or Anodized Aluminum"
      },
      {
        "label": "Heating Plate",
        "value": "316 Stainless Steel"
      },
      {
        "label": "Temperature Monitoring",
        "value": "Integrated Thermocouple"
      },
      {
        "label": "Electrolyzer Type",
        "value": "PEM / AEM Compatible"
      }
    ],
    "shortDesc": "The METNMAT High-Temperature Electrolyzer is a research-grade electrolyzer hardware platform designed for advanced PEM and AEM water electrolysis studies."
  },
  {
    "slug": "ewf-transparent-flow-electrolyzer-zero-gap",
    "name": "EWF Transparent Flow Electrolyzer(Zero Gap)",
    "brand": "METNMAT",
    "categorySlug": "water-splitting-reactors",
    "sku": "MT-RC-EWFZ-GAP",
    "price": 49999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Model",
        "value": "EWF"
      },
      {
        "label": "Cell Type",
        "value": "Zero-Gap Electrolyzer"
      },
      {
        "label": "Body Material",
        "value": "Transparent PMMA (Acrylic)"
      },
      {
        "label": "Dimensions",
        "value": "90 mm × 90 mm × 30 mm"
      },
      {
        "label": "Electrode Area",
        "value": "10 cm²"
      },
      {
        "label": "Electrolyte Volume",
        "value": "5 mL per side"
      },
      {
        "label": "Electrode Distance",
        "value": "Zero Gap"
      },
      {
        "label": "Membrane Compatibility",
        "value": "PEM / AEM"
      },
      {
        "label": "Flow Configuration",
        "value": "Electrolyte Inlet & Outlet Channels"
      },
      {
        "label": "Sealing",
        "value": "Leak-Proof Construction"
      },
      {
        "label": "In the box",
        "value": "EWF Zero-Gap Electrolyzer Assembly\r, Transparent PMMA End Plates\r, Flow Field Components\r, Membrane Holding Assembly\r, Sealing Gaskets and O-Rings\r, Fasteners and Hardware Kit"
      }
    ],
    "shortDesc": "The METNMAT EWF Zero-Gap Electrolyzer is a compact research-grade water electrolysis reactor designed for evaluating membrane electrode assemblies (MEA) under realistic operating conditions."
  },
  {
    "slug": "transparent-carbon-dioxide-gas-diffusion-flow-cell",
    "name": "Transparent Carbon Dioxide Gas Diffusion Flow Cell",
    "brand": "METNMAT",
    "categorySlug": "co2-electrolysis",
    "sku": "MT-RC-GDCT-CO2",
    "price": 54999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Model",
        "value": "GDC-1"
      },
      {
        "label": "Cell Type",
        "value": "Gas Diffusion Flow Cell"
      },
      {
        "label": "Body Material",
        "value": "PEEK and Transparent PMMA"
      },
      {
        "label": "Active Area",
        "value": "4 cm² (2 cm × 2 cm)"
      },
      {
        "label": "Flow Configuration",
        "value": "Continuous Electrolyte Flow"
      },
      {
        "label": "Electrode Compatibility",
        "value": "Gas Diffusion Electrodes (GDE)"
      },
      {
        "label": "Design",
        "value": "Modular and Customizable"
      },
      {
        "label": "In the box",
        "value": "Transparent CO₂ Flow Cell Assembly\r, PEEK and PMMA Cell Components\r, Flow Field Assembly\r, Sealing Gaskets\r, Fasteners and Hardware Kit\r, Fluidic Connection Ports"
      }
    ],
    "shortDesc": "The METNMAT Transparent Carbon Dioxide Gas Diffusion Flow Cell is a research-grade electrochemical reactor developed for CO₂ reduction reaction (CO₂RR) studies under continuous-flow conditions."
  },
  {
    "slug": "zero-gap-electrolyzer-for-carbon-dioxide-reduction",
    "name": "Zero-gap Electrolyzer for Carbon Dioxide Reduction",
    "brand": "METNMAT",
    "categorySlug": "co2-electrolysis",
    "sku": "MT-RC-ZGCO-MEA",
    "price": 54999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Cell Type",
        "value": "Zero-Gap MEA Electrolyzer"
      },
      {
        "label": "Active Area Options",
        "value": "5 cm², 25 cm², 100 cm²"
      },
      {
        "label": "Electrode Distance",
        "value": "Zero Gap"
      },
      {
        "label": "Anode Flow Field",
        "value": "Titanium"
      },
      {
        "label": "Cathode Flow Field",
        "value": "Stainless Steel"
      },
      {
        "label": "Modular Hardware DesignCell Type",
        "value": "Zero-Gap MEA Electrolyzer"
      },
      {
        "label": "Active Area Options",
        "value": "5 cm², 25 cm², 100 cm²"
      },
      {
        "label": "Electrode Distance",
        "value": "Zero Gap"
      },
      {
        "label": "Anode Flow Field",
        "value": "Titanium"
      },
      {
        "label": "Cathode Flow Field",
        "value": "Stainless Steel"
      }
    ],
    "shortDesc": "The METNMAT Zero-Gap CO₂ Electrolyzer is a membrane electrode assembly (MEA)-based electrolysis platform designed for high-performance carbon dioxide reduction research."
  },
  {
    "slug": "carbon-dioxide-gas-diffusion-flow-cell-ptfe",
    "name": "Carbon Dioxide Gas Diffusion Flow Cell (PTFE)",
    "brand": "METNMAT",
    "categorySlug": "co2-electrolysis",
    "sku": "MT-RC-GDCP-CO2",
    "price": 54999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Model",
        "value": "GDC-1"
      },
      {
        "label": "Cell Type",
        "value": "Gas Diffusion Flow Cell"
      },
      {
        "label": "Body Material",
        "value": "PTFE (Teflon)"
      },
      {
        "label": "Active Area",
        "value": "1 cm² (1 cm × 1 cm)"
      },
      {
        "label": "Electrode Configuration",
        "value": "Gas Diffusion Electrode Compatible"
      },
      {
        "label": "Flow Operation",
        "value": "Continuous Flow"
      },
      {
        "label": "In the box",
        "value": "PTFE Flow Cell Assembly\r, Flow Field Components\r, Sealing Gaskets and O-Rings\r, Fasteners and Hardware Kit\r, Fluidic Connection Ports"
      }
    ],
    "shortDesc": "The METNMAT Carbon Dioxide Gas Diffusion Flow Cell is a PTFE-based electrochemical reactor developed for high-performance CO₂ reduction reaction (CO₂RR) studies."
  },
  {
    "slug": "dual-chambered-in-situ-raman-spectroscopy-cell-with-single-light-windo",
    "name": "Dual Chambered In-Situ Raman Spectroscopy Cell With Single Light Window",
    "brand": "METNMAT",
    "categorySlug": "co2-electrolysis",
    "sku": "MT-RC-IRE4-RAM",
    "price": 54999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Model",
        "value": "IRE-4"
      },
      {
        "label": "Cell Type",
        "value": "Photoelectrochemical Electrolyzer"
      },
      {
        "label": "Body Material",
        "value": "PEEK"
      },
      {
        "label": "Optical Window",
        "value": "Sapphire"
      },
      {
        "label": "Window Diameter",
        "value": "40 mm (Effective)"
      },
      {
        "label": "Working Distance",
        "value": "3 mm"
      },
      {
        "label": "Reaction Area",
        "value": "20 × 20 mm"
      },
      {
        "label": "Working Electrode Size",
        "value": "15 × 15 mm / 10 × 10 mm"
      },
      {
        "label": "Counter Electrode",
        "value": "Platinum Spring Electrode"
      },
      {
        "label": "Reference Electrode",
        "value": "Ag/AgCl or SCE"
      },
      {
        "label": "Membrane Separation",
        "value": "Ion Exchange Membrane Compatible"
      },
      {
        "label": "In the box",
        "value": "IRE-4 Raman Cell Assembly\r, Sapphire Window Assembly\r, PEEK Cell Body\r, Platinum Spring Counter Electrode\r, Electrode Holders\r, Sealing Gaskets and O-Rings\r, Fluidic Connection Ports\r, Fasteners and Assembly Hardware"
      }
    ],
    "shortDesc": "The METNMAT IRE-4 In-Situ Raman Spectroscopy Cell is a specialized photoelectrochemical reactor designed for simultaneous electrochemical testing and Raman spectroscopic analysis."
  },
  {
    "slug": "photovoltaic-pv-biased-photoelectrochemical-cell-pec",
    "name": "Photovoltaic (PV) biased Photoelectrochemical Cell (PEC)",
    "brand": "METNMAT",
    "categorySlug": "photo-ec-reactors",
    "sku": "MT-RC-PCPV-DUL",
    "price": 59999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Product Category",
        "value": "Photoelectrochemical Water Splitting Reactor"
      },
      {
        "label": "Model",
        "value": "PEC-PV"
      },
      {
        "label": "Active Photoelectrode Area",
        "value": "2.5 × 2.5 cm"
      },
      {
        "label": "Electrolyte Volume",
        "value": "150 mL"
      },
      {
        "label": "Window Configuration",
        "value": "Dual Open Window"
      },
      {
        "label": "Counter Electrode Configuration",
        "value": "Dual Counter Electrode"
      },
      {
        "label": "Electrode Distance",
        "value": "< 30 mm"
      },
      {
        "label": "Gas Analysis Compatible",
        "value": "Yes (GC Compatible)"
      },
      {
        "label": "Cell Type",
        "value": "Tandem PEC Reactor"
      },
      {
        "label": "In the box",
        "value": "PEC-PV Reactor Assembly\r, Dual Window Cell Body\r, Counter Electrode Assembly\r, Electrode Holders\r, Sealing Gaskets and O-Rings\r, Fluidic Connections and Ports\r, Fasteners and Hardware Kit"
      }
    ],
    "shortDesc": "The METNMAT Photovoltaic Biased Photoelectrochemical Cell (PEC-PV) is an advanced tandem photoelectrochemical reactor designed for solar-driven water splitting and hydrogen production research."
  },
  {
    "slug": "photocatalytic-water-splitting-panel-reactors-app-400",
    "name": "Photocatalytic Water Splitting Panel Reactors APP-400",
    "brand": "METNMAT",
    "categorySlug": "photo-ec-reactors",
    "sku": "MT-RC-APP4-PNL",
    "price": 59999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Models",
        "value": "PPR-100, PPR-400"
      },
      {
        "label": "Body Material",
        "value": "Transparent PMMA (Acrylic)"
      },
      {
        "label": "PPR-100",
        "value": "100 cm² (10 × 10 cm)"
      },
      {
        "label": "PPR-400",
        "value": "400 cm² (20 × 20 cm)"
      },
      {
        "label": "PPR-100",
        "value": "15 mL"
      },
      {
        "label": "PPR-400",
        "value": "60 mL"
      },
      {
        "label": "Catalyst Thickness Compatibility",
        "value": "0.1 – 1000 μm"
      },
      {
        "label": "Catalyst Support",
        "value": "SS316 Plate / Acrylic Plate"
      },
      {
        "label": "Window Material",
        "value": "UV-Transparent Glass"
      },
      {
        "label": "Reactor Geometry",
        "value": "Inclined Panel Design"
      }
    ],
    "shortDesc": "The METNMAT Artificial Photosynthesis Panel Reactor (APP Series) is a large-area photocatalytic reactor designed for solar hydrogen generation and artificial photosynthesis research."
  },
  {
    "slug": "microbial-fuel-cell-stack-ma-mfc-5",
    "name": "Microbial Fuel Cell Stack (MA-MFC-5)",
    "brand": "METNMAT",
    "categorySlug": "fuel-cells",
    "sku": "MT-RC-MMFC-STK",
    "price": 44999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Product Category",
        "value": "Fuel Cell Reactor"
      },
      {
        "label": "Model",
        "value": "MA-MFC-5"
      },
      {
        "label": "Body Material",
        "value": "Transparent PMMA"
      },
      {
        "label": "Number of Cells",
        "value": "5"
      },
      {
        "label": "Active Area",
        "value": "2 cm² to 25 cm² (per unit)"
      },
      {
        "label": "Electrode Spacing",
        "value": "< 3 cm"
      },
      {
        "label": "Configuration",
        "value": "Single-Chamber / Dual-Chamber Compatible"
      },
      {
        "label": "Operating Conditions",
        "value": "Aerobic and Anaerobic"
      }
    ],
    "shortDesc": "Microbial Fuel Cell Stack (MA-MFC-5) Description The METNMAT Microbial Fuel Cell Stack (MA-MFC-5) is a modular research platform designed for studying bioelectrochemical systems, microbial fuel cells (MFCs), and wastewater-to-energy conversion technologies."
  },
  {
    "slug": "pem-fuel-cell-hardware",
    "name": "PEM Fuel Cell Hardware",
    "brand": "METNMAT",
    "categorySlug": "fuel-cells",
    "sku": "MT-RC-PEMF-5C2",
    "price": 44999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Product Category",
        "value": "PEM Fuel Cell"
      },
      {
        "label": "Models",
        "value": "MPH-5, MPH-25"
      },
      {
        "label": "MPH-5",
        "value": "5 cm²"
      },
      {
        "label": "MPH-25",
        "value": "25 cm²"
      },
      {
        "label": "Flow Field Design",
        "value": "Serpentine"
      },
      {
        "label": "Flow Field Material",
        "value": "Graphite"
      },
      {
        "label": "Current Collectors",
        "value": "Gold-Plated Copper"
      },
      {
        "label": "End Plates",
        "value": "Aluminum"
      },
      {
        "label": "Heating System",
        "value": "Integrated Silicone Rubber Heater (120 W)"
      },
      {
        "label": "Gas Connections",
        "value": "1/4\" Tube Compatible"
      },
      {
        "label": "Cell Type",
        "value": "Single-Cell PEM Fuel Cell Hardware"
      },
      {
        "label": "Applications",
        "value": "PEM fuel cell research\r, MEA evaluation and optimization\r, Catalyst performance testing\r, Gas diffusion layer studies\r, Flow field design research\r, Fuel cell durability testing\r, Academic and industrial R&D"
      }
    ],
    "shortDesc": "The METNMAT PEM Fuel Cell Hardware is a research-grade single-cell fuel cell platform designed for evaluating membrane electrode assemblies (MEA), electrocatalysts, gas diffusion layers (GDLs), and bipolar plate designs."
  },
  {
    "slug": "vanadium-flow-cell-reactor",
    "name": "Vanadium Flow Cell Reactor",
    "brand": "METNMAT",
    "categorySlug": "fuel-cells",
    "sku": "MT-RC-VFCR-FT2",
    "price": 44999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Product Category",
        "value": "Flow Battery Reactor"
      },
      {
        "label": "Model",
        "value": "FT2-E"
      },
      {
        "label": "Body Material",
        "value": "Transparent PMMA"
      },
      {
        "label": "Electrolyte Volume",
        "value": "6 mL per chamber"
      },
      {
        "label": "Active Area",
        "value": "20 × 20 mm (Customizable)"
      },
      {
        "label": "Electrode Distance",
        "value": "3 cm"
      },
      {
        "label": "Tube Compatibility",
        "value": "4 mm OD PTFE / PU Tubing"
      },
      {
        "label": "Membrane Compatible",
        "value": "Yes"
      },
      {
        "label": "Flow Configuration",
        "value": "Dual-Chamber Flow Cell"
      },
      {
        "label": "In the box",
        "value": "Vanadium Flow Cell Reactor Assembly\r, Transparent PMMA Cell Body\r, Membrane Holding Assembly\r, PTFE/PU Tube Connectors\r, Sealing Gaskets and O-Rings\r, Stainless Steel Fasteners\r, Liquid Inlet and Outlet Fittings"
      }
    ],
    "shortDesc": "The METNMAT Vanadium Flow Cell Reactor is a transparent electrochemical flow reactor designed for vanadium redox flow battery (VRFB) research and development."
  },
  {
    "slug": "swagelok-battery-test-fixture",
    "name": "Swagelok Battery Test Fixture",
    "brand": "METNMAT",
    "categorySlug": "battery-reactors",
    "sku": "MT-RC-SWGL-BAT",
    "price": 39999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Product Category",
        "value": "Battery Research Cell"
      },
      {
        "label": "Cell Type",
        "value": "Swagelok Test Cell"
      },
      {
        "label": "Cell Body Material",
        "value": "316 Stainless Steel"
      },
      {
        "label": "Insulation Material",
        "value": "PEEK"
      },
      {
        "label": "Sealing Material",
        "value": "Fluoroelastomer"
      },
      {
        "label": "Standard Internal Diameter",
        "value": "20 mm"
      },
      {
        "label": "Custom Diameter Range",
        "value": "10–20 mm"
      },
      {
        "label": "Assembly Type",
        "value": "6-Part Modular Design"
      },
      {
        "label": "Applications",
        "value": "Lithium-ion battery research\r, Sodium-ion battery development\r, Zinc-ion battery studies\r, Solid-state battery testing\r, Electrode material screening\r, Electrolyte evaluation\r, Academic and industrial battery R&D"
      },
      {
        "label": "In the box",
        "value": "Swagelok Cell Body Assembly\r, Stainless Steel Current Collectors\r, PTFE Insulation Components\r, Fluoroelastomer Seals\r, Compression Hardware\r, Assembly Components"
      }
    ],
    "shortDesc": "The METNMAT Swagelok Cell is a reusable electrochemical test cell designed for rapid evaluation of battery materials, electrolytes, separators, and electrode architectures."
  },
  {
    "slug": "metal-air-battery-reactor",
    "name": "Metal-Air Battery Reactor",
    "brand": "METNMAT",
    "categorySlug": "battery-reactors",
    "sku": "MT-RC-MARX-AIR",
    "price": 39999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Available Models",
        "value": "T1, T2, T3, T4"
      },
      {
        "label": "Cell Type",
        "value": "Air-Breathing Metal-Air Battery"
      },
      {
        "label": "Body Material",
        "value": "Transparent PMMA"
      },
      {
        "label": "Air Cathode Configuration",
        "value": "Integrated"
      },
      {
        "label": "Electrolyte Chamber",
        "value": "Leak-Proof Design"
      },
      {
        "label": "Electrode Configuration",
        "value": "Customizable"
      },
      {
        "label": "In the box",
        "value": "Metal-Air Battery Reactor Assembly\r, Transparent PMMA Cell Body\r, Air Cathode Holder\r, Anode Holder Assembly\r, Sealing Gaskets and O-Rings\r, Stainless Steel Fasteners\r, Electrical Connection Hardware"
      }
    ],
    "shortDesc": "The METNMAT Metal-Air Battery Reactor is a modular electrochemical platform designed for the development and evaluation of metal-air battery technologies, including aluminum-air, zinc-air, iron-air, and magnesium-air systems."
  },
  {
    "slug": "metal-flow-battery-reactor",
    "name": "Metal-Flow Battery Reactor",
    "brand": "METNMAT",
    "categorySlug": "battery-reactors",
    "sku": "MT-RC-MFLW-BAT",
    "price": 39999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Cell Type",
        "value": "Metal-Flow Battery Test Cell"
      },
      {
        "label": "Body Material",
        "value": "PMMA / PTFE / PEEK (Customizable)"
      },
      {
        "label": "Configuration",
        "value": "Dual-Chamber Flow Cell"
      },
      {
        "label": "Membrane Compatible",
        "value": "Yes"
      },
      {
        "label": "Electrolyte Flow",
        "value": "Continuous Circulation"
      },
      {
        "label": "Active Area",
        "value": "Customizable"
      },
      {
        "label": "Flow Field Design",
        "value": "Customizable"
      },
      {
        "label": "Tube Connections",
        "value": "PTFE / PU Compatible"
      },
      {
        "label": "In the box",
        "value": "Metal-Flow Battery Reactor Assembly\r, Flow Field Components\r, Membrane Holding Assembly\r, Sealing Gaskets and O-Rings\r, Fluidic Connectors and Fittings\r, Stainless Steel Fasteners\r, Assembly Hardware Kit"
      }
    ],
    "shortDesc": "The METNMAT Metal-Flow Battery Reactor is a versatile electrochemical flow cell platform designed for the development and evaluation of metal-based flow battery systems."
  },
  {
    "slug": "intelligent-peristaltic-pump-dual-channel-dc-24v",
    "name": "Intelligent Peristaltic Pump - Dual Channel, DC 24V",
    "brand": "METNMAT",
    "categorySlug": "peristaltic-pumps",
    "sku": "MT-EQ-PPDU-24V",
    "price": 12999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Power Supply",
        "value": "DC 24 V"
      },
      {
        "label": "Power Consumption",
        "value": "< 36 W"
      },
      {
        "label": "Speed Range",
        "value": "0.1 – 350 rpm"
      },
      {
        "label": "Speed Resolution",
        "value": "0.1 rpm"
      },
      {
        "label": "Dimensions",
        "value": "249 × 111 × 154 mm"
      },
      {
        "label": "Weight",
        "value": "Approx. 2.5 kg"
      },
      {
        "label": "Motor Type",
        "value": "57 Closed-Loop Stepper Motor"
      },
      {
        "label": "Motor Life",
        "value": "≥ 6000 hours"
      },
      {
        "label": "Pump Head",
        "value": "3-Rotor (KK1800)"
      },
      {
        "label": "Tube Material",
        "value": "BPT / Silicone"
      },
      {
        "label": "Control Methods",
        "value": "Button, Foot Pedal, RS-485 (Modbus)"
      },
      {
        "label": "Operating Temperature",
        "value": "0°C to 40°C"
      },
      {
        "label": "Humidity",
        "value": "< 80% RH (Non-condensing)"
      },
      {
        "label": "Noise Level",
        "value": "≤ 58 dB"
      },
      {
        "label": "Applications",
        "value": "Flow battery electrolyte recirculation\r, Continuous flow electrochemical cells\r, Electrolyser electrolyte management\r, Analytical flow injection systems"
      }
    ],
    "shortDesc": "The Dual-Channel Peristaltic Pump is a precision fluid delivery system designed for laboratory, industrial, and electrochemical applications requiring accurate and contamination-free liquid transfer."
  },
  {
    "slug": "kamoer-kcp2-kxf-s08-peristaltic-lab-pump-12v-dc-17-50-ml-min",
    "name": "Kamoer KCP2-KXF-S08 Peristaltic Lab Pump - 12V DC, 17-50 ml/min",
    "brand": "METNMAT",
    "categorySlug": "peristaltic-pumps",
    "sku": "MT-EQ-PPK2-12V",
    "price": 12999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Model",
        "value": "KCP2-KXF-S08"
      },
      {
        "label": "Pump Type",
        "value": "Peristaltic Lab Pump"
      },
      {
        "label": "Operating Voltage",
        "value": "12 V DC"
      },
      {
        "label": "Flow Rate",
        "value": "17–50 mL/min"
      },
      {
        "label": "Maximum Flow Rate",
        "value": "210 mL/min"
      },
      {
        "label": "Power Source",
        "value": "AC Adapter Powered"
      },
      {
        "label": "Dimensions",
        "value": "13.9 × 7.9 × 11 cm"
      },
      {
        "label": "Weight",
        "value": "756 g"
      },
      {
        "label": "Manufacturer",
        "value": "Kamoer Fluid Tech"
      },
      {
        "label": "Applications",
        "value": "Electrochemical Flow Cells\r, CO₂ Electrolysis Systems\r, Water Electrolysis\r, Laboratory Dosing\r, Chemical Transfer\r, Analytical Instruments\r, Titration Systems\r, Research & Development"
      }
    ],
    "shortDesc": "The Kamoer KCP2-KXF-S08 Peristaltic Pump is a compact and reliable laboratory dosing pump designed for precise liquid transfer in research, analytical, and electrochemical applications."
  },
  {
    "slug": "kamoer-kcp-x-mini-peristaltic-pump-24v-19-65-ml-min-with-control",
    "name": "Kamoer KCP-X Mini Peristaltic Pump - 24V, 19-65 ml/min, with Control",
    "brand": "METNMAT",
    "categorySlug": "peristaltic-pumps",
    "sku": "MT-EQ-PPKX-24V",
    "price": 12999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Model",
        "value": "KCP-X"
      },
      {
        "label": "Pump Type",
        "value": "Mini Peristaltic Pump"
      },
      {
        "label": "Operating Voltage",
        "value": "24 V DC"
      },
      {
        "label": "Flow Rate Range",
        "value": "19–65 mL/min"
      },
      {
        "label": "Tube Size",
        "value": "3 mm ID × 5 mm OD Silicone Tube"
      },
      {
        "label": "Dimensions",
        "value": "72 × 86.5 × 80.2 mm"
      },
      {
        "label": "Weight",
        "value": "185 g"
      },
      {
        "label": "Operating Temperature",
        "value": "0–40°C"
      },
      {
        "label": "Humidity",
        "value": "< 80% RH"
      },
      {
        "label": "Flow Control",
        "value": "Adjustable Rotary Knob"
      },
      {
        "label": "Pump Head",
        "value": "Snap-Fit Design"
      },
      {
        "label": "Applications",
        "value": "Electrochemical Flow Cells\r, CO₂ Electrolysis Systems\r, Water Electrolysis Research\r, Chemical Dosing\r, Laboratory Fluid Transfer\r, Analytical Instruments\r, Continuous Flow Reactors\r, Scientific Research & Development"
      },
      {
        "label": "Key features",
        "value": "Compact and lightweight design\r, Adjustable flow rate control\r, Low-noise operation\r, Contamination-free liquid transfer\r, Easy tubing replacement and maintenance\r, Suitable for continuous laboratory operation"
      }
    ],
    "shortDesc": "The Kamoer KCP-X Mini Peristaltic Pump is a compact and user-friendly fluid transfer solution designed for precise low-flow applications in laboratories, electrochemical systems, and research environments."
  },
  {
    "slug": "kamoer-m1-stp-intelligent-peristaltic-pump-dc-24v-48w-by-metnmat",
    "name": "Kamoer M1-STP Intelligent peristaltic Pump DC 24V <48W by METNMAT",
    "brand": "METNMAT",
    "categorySlug": "peristaltic-pumps",
    "sku": "MT-EQ-PPM1-24V",
    "price": 12999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Model",
        "value": "M1-STP"
      },
      {
        "label": "Pump Type",
        "value": "Intelligent Peristaltic Pump"
      },
      {
        "label": "Operating Voltage",
        "value": "24 V DC"
      },
      {
        "label": "Power Consumption",
        "value": "< 48 W"
      },
      {
        "label": "Flow Rate",
        "value": "0–20 mL/min"
      },
      {
        "label": "Maximum Speed",
        "value": "350 RPM"
      },
      {
        "label": "Display",
        "value": "1.8-inch LCD Screen"
      },
      {
        "label": "Communication",
        "value": "RS485"
      },
      {
        "label": "Motor Type",
        "value": "High-Precision Stepper Motor"
      },
      {
        "label": "Noise Level",
        "value": "< 47 dB"
      },
      {
        "label": "Operating Modes",
        "value": "Time Mode, Volume Mode, Cycle Mode"
      },
      {
        "label": "Manufacturer",
        "value": "Kamoer Fluid Tech"
      }
    ],
    "shortDesc": "The Kamoer M1-STP Intelligent Peristaltic Pump is a high-precision fluid handling system designed for laboratory automation, electrochemical research, and analytical applications."
  },
  {
    "slug": "triboelectric-measurement-setup",
    "name": "Triboelectric Measurement Setup",
    "brand": "METNMAT",
    "categorySlug": "specialised-equipment",
    "sku": "MT-EQ-TRBO-SET",
    "price": 74999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Travel Length",
        "value": "100 mm"
      },
      {
        "label": "Maximum Feed Speed",
        "value": "200 mm/s"
      },
      {
        "label": "Plate Size",
        "value": "100 × 100 mm"
      },
      {
        "label": "Plate Separation Range",
        "value": "2–10 mm (Adjustable)"
      },
      {
        "label": "Actuation System",
        "value": "Stepper Motor Driven Linear Actuator"
      },
      {
        "label": "Control System",
        "value": "Software-Controlled Interface"
      },
      {
        "label": "Motion Type",
        "value": "Reciprocating Linear Motion"
      },
      {
        "label": "Operating Parameters",
        "value": "Adjustable Speed, Pressure, RPM, and Motion Profiles"
      }
    ],
    "shortDesc": "The Triboelectric Measurement Setup is a precision-engineered testing platform designed for the characterization and evaluation of triboelectric materials and triboelectric nanogenerators (TENGs)."
  },
  {
    "slug": "fuel-cell-test-station",
    "name": "Fuel Cell Test Station",
    "brand": "METNMAT",
    "categorySlug": "specialised-equipment",
    "sku": "MT-EQ-FCTS-STN",
    "price": 74999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Product Category",
        "value": "Fuel Cell Testing System"
      },
      {
        "label": "Available Models",
        "value": "300 W, 500 W, 1 kW"
      },
      {
        "label": "Data Acquisition System",
        "value": "Integrated"
      },
      {
        "label": "Display & Monitoring",
        "value": "Real-Time Parameter Display"
      }
    ],
    "shortDesc": "The METNMAT Fuel Cell Test Station is a versatile research platform designed for performance evaluation, durability testing, and characterization of PEM fuel cells and other fuel cell technologies."
  },
  {
    "slug": "fuel-cell-metal-air-battery-testing-device-400-w",
    "name": "Fuel Cell / Metal-Air Battery Testing Device (400 W)",
    "brand": "METNMAT",
    "categorySlug": "specialised-equipment",
    "sku": "MT-EQ-FCAT-40W",
    "price": 74999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Product Category",
        "value": "Fuel Cell & Battery Testing Equipment"
      },
      {
        "label": "Model",
        "value": "400 W"
      },
      {
        "label": "Channel Configuration",
        "value": "Dual Channel"
      },
      {
        "label": "Voltage Range",
        "value": "0 – 150 V"
      },
      {
        "label": "Current Range",
        "value": "0 – 20 A"
      },
      {
        "label": "Channel 1",
        "value": "0 – 200 W"
      },
      {
        "label": "Channel 2",
        "value": "0 – 200 W"
      },
      {
        "label": "Total System Power",
        "value": "400 W"
      }
    ],
    "shortDesc": "The METNMAT 400 W Fuel Cell & Metal-Air Battery Testing Device is a versatile electrochemical testing platform designed for performance characterization, durability analysis, and discharge testing of fuel cells, metal-air batteries, and primary battery systems."
  },
  {
    "slug": "temperature-controlling-unit",
    "name": "Temperature Controlling Unit",
    "brand": "METNMAT",
    "categorySlug": "specialised-equipment",
    "sku": "MT-EQ-TEMP-PID",
    "price": 74999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Maximum Temperature",
        "value": "200°C"
      },
      {
        "label": "Temperature Range",
        "value": "0–200°C"
      },
      {
        "label": "Heating Plate Power",
        "value": "100 W"
      },
      {
        "label": "Temperature Accuracy",
        "value": "±1°C"
      },
      {
        "label": "PID Control Accuracy",
        "value": "Up to ±0.5°C"
      },
      {
        "label": "Sensor Compatibility",
        "value": "K-Type, J-Type, PT100, RTD, Thermistors"
      },
      {
        "label": "Control Modes",
        "value": "PID / On-Off Control"
      },
      {
        "label": "Power Input",
        "value": "110V AC, 220V AC, 24V/48V DC"
      },
      {
        "label": "Display",
        "value": "Digital LED Display"
      },
      {
        "label": "Wiring",
        "value": "PTFE-Coated SS Braided High-Temperature Wiring"
      }
    ],
    "shortDesc": "The PID Controlled Heating Plate System is a compact and precision temperature control solution designed for electrochemical cells, fuel cell hardware, electrolyzers, and laboratory heating applications."
  },
  {
    "slug": "hot-press-machine-for-pefc-membrane-electrode-assembly-hydraulic-hot-p",
    "name": "Hot Press Machine for PEFC Membrane Electrode Assembly, hydraulic Hot Press Mach",
    "brand": "METNMAT",
    "categorySlug": "mea-fabrication",
    "sku": "MT-EQ-HPMA-MEA",
    "price": 89999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Model",
        "value": "MEA Thermopress 2000"
      },
      {
        "label": "Press Capacity",
        "value": "20 Ton Hydraulic Press"
      },
      {
        "label": "Hydraulic Pressure",
        "value": "0–120 MPa"
      },
      {
        "label": "Temperature Range",
        "value": "Room Temperature to 200°C"
      },
      {
        "label": "Temperature Accuracy",
        "value": "±1°C"
      },
      {
        "label": "Working Plate Size",
        "value": "Up to 20 × 20 cm"
      },
      {
        "label": "MEA Production Size",
        "value": "1 × 1 cm to 18 × 18 cm"
      },
      {
        "label": "Maximum Working Distance",
        "value": "100 mm"
      },
      {
        "label": "Frame Type",
        "value": "Four-Pillar High-Rigidity Frame"
      },
      {
        "label": "Working Plate Material",
        "value": "SS316 with Non-Stick Coating"
      },
      {
        "label": "Heating Plate Material",
        "value": "Dual-Layer SS316"
      },
      {
        "label": "Pressure Stability",
        "value": "≤ 1 MPa / 10 min"
      },
      {
        "label": "Pressurization",
        "value": "Manual Hydraulic Actuation"
      }
    ],
    "shortDesc": "The MEA Thermopress (Model 2000) is a high-performance hydraulic hot press designed for the fabrication of Membrane Electrode Assemblies (MEAs), gas diffusion electrodes, and air cathodes used in fuel cells, electrolyzers, and electrochemical energy systems."
  },
  {
    "slug": "30-ton-hydraulic-press-four-pillar-hand-operated-semi-automatic-model",
    "name": "30 Ton Hydraulic Press, Four Pillar, Hand Operated, Semi Automatic Model MHP-30",
    "brand": "METNMAT",
    "categorySlug": "mea-fabrication",
    "sku": "MT-EQ-HP30-MHP",
    "price": 89999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Model",
        "value": "MHP-30"
      },
      {
        "label": "Press Capacity",
        "value": "30 Tons"
      },
      {
        "label": "Press Type",
        "value": "Four-Pillar Hydraulic Press"
      },
      {
        "label": "Working Area",
        "value": "20 × 20 cm / 30 × 30 cm"
      },
      {
        "label": "Hydraulic Pressure",
        "value": "0–100 MPa (Up to 1000 bar)"
      },
      {
        "label": "Maximum Working Distance",
        "value": "100 mm"
      },
      {
        "label": "Frame Material",
        "value": "Mild Steel (MS)"
      },
      {
        "label": "Working Plate Material",
        "value": "Stainless Steel (SS316)"
      },
      {
        "label": "Pressurization Mode",
        "value": "Manual or Hydraulic Power Assisted"
      },
      {
        "label": "Pressure Stability",
        "value": "≤ 1 MPa / 10 min"
      }
    ],
    "shortDesc": "The MHP-30 Hydraulic Press Machine is a robust four-pillar hydraulic press designed for MEA fabrication, electrode manufacturing, membrane lamination, and laboratory-scale material processing."
  },
  {
    "slug": "hydraulic-pressing-machine",
    "name": "Hydraulic Pressing Machine",
    "brand": "METNMAT",
    "categorySlug": "mea-fabrication",
    "sku": "MT-EQ-HP20-MHP",
    "price": 89999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Model",
        "value": "MHP-20"
      },
      {
        "label": "Press Capacity",
        "value": "20 Tons"
      },
      {
        "label": "Pressure Range",
        "value": "0–80 MPa"
      },
      {
        "label": "Piston Diameter",
        "value": "60 mm"
      },
      {
        "label": "Working Area",
        "value": "30 × 30 cm"
      },
      {
        "label": "Pressure Gauge",
        "value": "Dual Scale (PSI & kg/cm²)"
      },
      {
        "label": "Pressure Range (PSI)",
        "value": "0–15,000 PSI"
      },
      {
        "label": "Pressure Range (kg/cm²)",
        "value": "0–1000 kg/cm²"
      },
      {
        "label": "Pressurization Mode",
        "value": "Manual Pressurization"
      },
      {
        "label": "Pressure Stability",
        "value": "≤ 1 MPa / 10 min"
      },
      {
        "label": "Machine Dimensions",
        "value": "40 × 36 × 60 cm"
      },
      {
        "label": "Machine Weight",
        "value": "125"
      }
    ],
    "shortDesc": "The MHP-20 Hydraulic Press Machine is a compact four-pillar laboratory press designed for MEA fabrication, membrane lamination, electrode manufacturing, and advanced material processing applications."
  },
  {
    "slug": "manganese-dioxide-nanoparticles",
    "name": "Manganese Dioxide Nanoparticles",
    "brand": "METNMAT",
    "categorySlug": "accessories",
    "sku": "MT-AC-MNO2-NPS",
    "price": 1999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice",
      "Made by METNMAT"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Product Name",
        "value": "Manganese Dioxide Nanoparticles"
      },
      {
        "label": "Chemical Formula",
        "value": "MnO₂"
      },
      {
        "label": "CAS Number",
        "value": "1313-13-9"
      },
      {
        "label": "Particle Size",
        "value": "< 120 nm"
      },
      {
        "label": "Molecular Weight",
        "value": "86.94 g/mol"
      },
      {
        "label": "Appearance",
        "value": "Gray Powder"
      },
      {
        "label": "Density",
        "value": "5.02 g/cm³"
      },
      {
        "label": "Melting Point",
        "value": "535°C"
      },
      {
        "label": "Solubility",
        "value": "Insoluble in Water"
      },
      {
        "label": "Form",
        "value": "Nanopowder"
      }
    ],
    "shortDesc": "Manganese Dioxide (MnO₂) Nanoparticles are high-purity nanostructured materials widely used in energy storage, catalysis, environmental remediation, and electrochemical applications."
  },
  {
    "slug": "high-purity-zinc-sheet",
    "name": "High Purity Zinc Sheet",
    "brand": "METNMAT",
    "categorySlug": "accessories",
    "sku": "MT-AC-ZNSH-HPR",
    "price": 1999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Material",
        "value": "Zinc (Zn)"
      },
      {
        "label": "Purity",
        "value": "99.99% / 99.995% (Metal Basis)"
      },
      {
        "label": "CAS No.",
        "value": "7440-66-6"
      },
      {
        "label": "Thickness Range",
        "value": "0.5 mm – 2 mm"
      },
      {
        "label": "Available Sizes",
        "value": "10 cm, 30 cm, 50 cm"
      },
      {
        "label": "Form",
        "value": "Sheet"
      },
      {
        "label": "Color",
        "value": "Metallic Gray"
      },
      {
        "label": "Applications",
        "value": "Electrochemical and battery research\r, Corrosion and galvanization studies\r, Electrode fabrication\r, Material science experiments\r, Educational and laboratory projects\r, Industrial testing and prototyping"
      }
    ],
    "shortDesc": "METNMAT High Purity Zinc Sheets are manufactured from 99.99%–99.995% pure zinc and offer excellent corrosion resistance, conductivity, and material consistency. These sheets are ideal for laboratory research, electrochemical studies, educational experiments, and industrial applications requiring high-purity zinc."
  },
  {
    "slug": "aluminum-sheet",
    "name": "Aluminum Sheet",
    "brand": "METNMAT",
    "categorySlug": "accessories",
    "sku": "MT-AC-ALSH-HPR",
    "price": 1999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": false,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Material",
        "value": "High-Purity Aluminum"
      },
      {
        "label": "Purity",
        "value": "≥99.8%"
      },
      {
        "label": "Thickness",
        "value": "0.5 mm – 2 mm"
      },
      {
        "label": "Available Sizes",
        "value": "10 cm, 30 cm, 50 cm"
      },
      {
        "label": "Molecular Formula",
        "value": "Al"
      },
      {
        "label": "Molecular Weight",
        "value": "26.98 g/mol"
      },
      {
        "label": "CAS No.",
        "value": "7429-90-5"
      },
      {
        "label": "Form",
        "value": "Sheet"
      },
      {
        "label": "Color",
        "value": "Silvery White"
      },
      {
        "label": "Applications",
        "value": "Sheet metal fabrication\r, Electronics and heat sinks\r, Research and laboratory projects\r, Robotics and DIY projects\r, Automotive and aerospace prototypes\r, Industrial machinery components"
      },
      {
        "label": "Key features",
        "value": "Lightweight and durable\r, Excellent corrosion resistance\r, High thermal conductivity\r, Good electrical conductivity\r, Easy to cut, drill, and machine\r, Smooth metallic finish"
      }
    ],
    "shortDesc": "High-purity Aluminum Sheet (≥99.8%) designed for engineering, fabrication, research, and industrial applications. Lightweight, corrosion-resistant, and easy to machine, cut, bend, and form, making it suitable for a wide range of manufacturing and prototyping needs."
  },
  {
    "slug": "gas-sampling-bag-1-litre-with-ptfe-valve",
    "name": "Gas Sampling Bag 1 Litre with PTFE Valve",
    "brand": "METNMAT",
    "categorySlug": "accessories",
    "sku": "MT-AC-GSBG-01L",
    "price": 1999,
    "moq": 1,
    "unit": "pc",
    "inStock": true,
    "featured": true,
    "badges": [
      "GST invoice"
    ],
    "sizes": [],
    "specs": [
      {
        "label": "Capacity",
        "value": "1 Litre"
      },
      {
        "label": "Film Material",
        "value": "PVF (Polyvinyl Fluoride)"
      },
      {
        "label": "Valve Material",
        "value": "PP (Polypropylene) / PTFE Valve"
      },
      {
        "label": "Film Thickness",
        "value": "2 mil"
      },
      {
        "label": "Operating Temperature",
        "value": "Up to 477 K"
      },
      {
        "label": "Tensile Strength",
        "value": "7,980 psi"
      },
      {
        "label": "Applications",
        "value": "Environmental air monitoring\r, Industrial gas sampling\r, Laboratory analysis\r, Stack emission testing\r, Biogas and landfill gas collection\r, Research and educational experiments"
      },
      {
        "label": "Key features",
        "value": "Excellent chemical resistance\r, Low gas adsorption and permeability\r, Leak-resistant valve design\r, Durable and lightweight construction\r, Suitable for repeated sampling\r, Easy filling, storage, and transportation"
      }
    ],
    "shortDesc": "The Gas Sampling Bag is designed for reliable collection, storage, and transportation of gas samples for laboratory, environmental, and industrial applications."
  }
];
