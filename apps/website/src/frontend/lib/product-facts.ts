import { formatINR, inclGSTForProduct, isQuoteOnly, type Product } from "@/frontend/lib/catalog";
import { NERNST_SLOPE } from "@/frontend/lib/potential-convert";

/**
 * What is true of this one model, in words.
 *
 * Measured 2026-11-05: on electrode pages only about 5% of the text was unique to
 * the page, because the copy is written per family. Google cannot tell twenty
 * near-identical pages apart, so few of them can rank. Every sentence here comes
 * from the product's own specs and price, or is arithmetic on them (a disk's area
 * from its diameter, litres per hour from mL/min). Nothing is estimated, and a
 * product with no such spec simply gets no such sentence.
 */
export type ProductFacts = {
  /** About the product itself. Also used as highlights in the Merchant feed. */
  model: string[];
  /** Its price, and where it sits among the other models. */
  buying: string[];
  faqs: { q: string; a: string }[];
};

type Faq = ProductFacts["faqs"][number];
type Dims = { a: number; b: number; t?: number };

const tidy = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/(\d)(mm|cm|µm|μm)\b/g, "$1 $2")
    .replace(/\s*,\s*,\s*/g, ", ")
    .replace(/[,;\s]+$/, "")
    .trim();

/** A spec value by label, whatever case the catalogue wrote the label in. */
function spec(p: Pick<Product, "specs">, ...labels: string[]): string | undefined {
  for (const label of labels) {
    const hit = p.specs?.find((s) => s.label?.trim().toLowerCase() === label);
    if (hit?.value?.trim()) return tidy(hit.value);
  }
  return undefined;
}

/** Three significant figures, without trailing zeros. */
const fig = (n: number) => String(Number(n.toPrecision(3)));
const firstNumber = (s?: string) => {
  const m = s?.match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : undefined;
};
/** A length in mm from text such as "6mm", "500 µm" or "1 cm". */
function lengthMm(s?: string): number | undefined {
  const m = s?.match(/(\d+(?:\.\d+)?)\s*(mm|µm|μm|cm)?/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (m[2] === "cm") return n * 10;
  return m[2] === "µm" || m[2] === "μm" ? n / 1000 : n;
}

/** Width and height in mm from text such as "15x20 mm²", "10 × 10 cm" or "W 200 mm x L 300 mm x T 1.5 mm". */
export function parseDims(text?: string): Dims | undefined {
  const s = text?.replace(/\b[WLT]\s+(?=\d)/g, "");
  const m = s?.match(/(\d+(?:\.\d+)?)\s*(?:mm|cm)?\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(?:mm|cm)?(?:\s*[×xX*]\s*(\d+(?:\.\d+)?))?\s*(mm|cm)?/);
  if (!m) return undefined;
  const scale = m[4] === "cm" || /\d\s*cm/.test(m[0]) ? 10 : 1;
  return { a: Number(m[1]) * scale, b: Number(m[2]) * scale, ...(m[3] ? { t: Number(m[3]) * scale } : {}) };
}

/** Geometric area of a disk, in cm². */
export const diskAreaCm2 = (diameterMm: number) => (Math.PI * (diameterMm / 10) ** 2) / 4;
const THREE_MM_DISK = diskAreaCm2(3);

function diskFacts(p: Product, diameter: string): Pick<ProductFacts, "model" | "faqs"> {
  const d = lengthMm(diameter) as number;
  const area = diskAreaCm2(d);
  const line = `The ${fig(d)} mm disk has a geometric area of ${fig(area)} cm², so a current of 1 mA is a current density of ${fig(1 / area)} mA/cm².`;
  const body = spec(p, "body material");
  const size = [spec(p, "body diameter"), spec(p, "body length")].filter(Boolean).join(" by ");
  return {
    model: [line, ...(body ? [`It sits in a ${body} body${size ? `, ${size}` : ""}.`] : [])],
    faqs: [{ q: `What is the electrode area of the ${p.name}?`, a: line }],
  };
}

function sheetFacts(p: Product, dims: Dims): Pick<ProductFacts, "model" | "faqs"> {
  const face = (dims.a * dims.b) / 100;
  const line = `At ${fig(dims.a)} × ${fig(dims.b)} mm, it has ${fig(face)} cm² per face, or ${fig(face * 2)} cm² counting both faces.`;
  const body = spec(p, "body material");
  return {
    model: [
      line,
      `That is about ${Math.round((face * 2) / THREE_MM_DISK)} times the area of a 3 mm disk working electrode, and a counter electrode should be larger than the working electrode.`,
      ...(dims.t ? [`It is ${fig(dims.t)} mm thick.`] : []),
      ...(body ? [`The holder body is ${body}.`] : []),
    ],
    faqs: [{ q: `What is the surface area of the ${p.name}?`, a: line }],
  };
}

function meshFacts(p: Product, dims?: Dims): Pick<ProductFacts, "model" | "faqs"> {
  const count = spec(p, "mesh count");
  const wire = spec(p, "mesh wire diameter");
  const lines = [
    ...(dims ? [`The mesh covers ${fig(dims.a)} × ${fig(dims.b)} mm, an outline of ${fig((dims.a * dims.b) / 100)} cm², and its real surface is larger because it is woven.`] : []),
    ...(count ? [`It has a mesh count of ${count}${wire ? `, woven from ${wire} wire` : ""}.`] : []),
  ];
  return { model: lines, faqs: dims ? [{ q: `What size is the ${p.name}?`, a: lines[0] }] : [] };
}

function wireFacts(p: Product): Pick<ProductFacts, "model" | "faqs"> {
  const diameter = lengthMm(spec(p, "wire diameter")) ?? firstNumber(p.name.match(/[Øφ]\s*\d+(?:\.\d+)?/)?.[0]);
  const length = lengthMm(spec(p, "wire length"));
  const body = spec(p, "body material");
  if (!diameter || !length) return { model: body ? [`The holder body is ${body}.`] : [], faqs: [] };
  const area = Math.PI * (diameter / 10) * (length / 10);
  const line = `A ${fig(diameter)} mm wire ${fig(length)} mm long has about ${fig(area)} cm² of surface when fully immersed.`;
  return {
    model: [line, ...(body ? [`The holder body is ${body}.`] : [])],
    faqs: [{ q: `What is the surface area of the ${p.name}?`, a: line }],
  };
}

function rodFacts(p: Product): Pick<ProductFacts, "model" | "faqs"> {
  const diameter = lengthMm(spec(p, "body diameter"));
  const length = spec(p, "body length");
  if (!diameter) return { model: [], faqs: [] };
  const line = `Each centimetre of this ${fig(diameter)} mm rod in the electrolyte adds about ${fig(Math.PI * (diameter / 10))} cm² of surface.`;
  return { model: [line, ...(length ? [`The rod is ${length} long.`] : [])], faqs: [{ q: `How much surface does the ${p.name} give?`, a: line }] };
}

function referenceFacts(p: Product): Pick<ProductFacts, "model" | "faqs"> {
  const tube = spec(p, "tube diameter");
  const length = spec(p, "effective length");
  const filling = spec(p, "filling solution");
  const junction = spec(p, "liquid junction core");
  const potential = spec(p, "reference potential");
  const temperature = spec(p, "operating temperature");
  const stability = spec(p, "potential stability");
  const model: string[] = [];
  const faqs: Faq[] = [];
  if (tube) model.push(`This model has a ${tube} body${length ? ` with an effective length of ${length}` : ""}.`);
  if (filling) {
    const line = `It is filled with ${filling}${junction ? `, with a ${junction} as the liquid junction` : ""}.`;
    model.push(line);
    faqs.push({ q: `What is the filling solution of the ${p.name}?`, a: line });
  }
  const volts = potential?.match(/[+-]?\d+\.\d+(?=\s*V)/)?.[0];
  if (potential && volts) {
    const ph = /KOH|NaOH/i.test(filling ?? potential) ? 14 : 7;
    const shift = Number(volts) + NERNST_SLOPE * ph;
    const line = `Its reference potential is ${potential}. To put a reading on the RHE scale at pH ${ph}, add ${shift.toFixed(3)} V.`;
    model.push(line);
    faqs.push({ q: `What is the potential of the ${p.name}?`, a: line });
  }
  if (temperature) model.push(`It is rated for ${temperature}${stability ? `, with potential stability of ${stability}` : ""}.`);
  return { model, faqs };
}

function holderFacts(p: Product): Pick<ProductFacts, "model" | "faqs"> {
  const body = spec(p, "holder body material");
  const held = spec(p, "held electrode material");
  const size = spec(p, "electrode size");
  const pin = spec(p, "contact pin");
  const line = [body ? `This ${body} holder` : "This holder", held ? `takes a ${held} electrode` : "", size ? `of ${size}` : ""].filter(Boolean).join(" ");
  return {
    model: [`${line}.`, ...(pin ? [`Contact is through a ${pin.toLowerCase()}.`] : [])],
    faqs: size ? [{ q: `What electrode size does the ${p.name} hold?`, a: `${line}.` }] : [],
  };
}

function pumpFacts(p: Product): Pick<ProductFacts, "model" | "faqs"> {
  const flow = spec(p, "flow rate");
  const voltage = spec(p, "operating voltage", "working voltage", "voltage");
  const drive = spec(p, "drive");
  const control = spec(p, "control");
  const noise = spec(p, "noise");
  const life = spec(p, "motor life");
  const model: string[] = [];
  const faqs: Faq[] = [];
  if (flow) {
    const top = /mL\/min/i.test(flow) ? Math.max(...(flow.match(/\d+(?:\.\d+)?/g) ?? ["0"]).map(Number)) : 0;
    const line = `Flow rate is ${flow}${top ? `, which is up to ${fig((top * 60) / 1000)} litres per hour` : ""}.`;
    model.push(line);
    faqs.push({ q: `What flow rate does the ${p.name} give?`, a: line });
  }
  if (voltage || drive) model.push(`It runs on ${[voltage, drive ? `a ${drive.toLowerCase()}` : ""].filter(Boolean).join(" with ")}.`);
  if (control) model.push(`Control is by ${control.charAt(0).toLowerCase()}${control.slice(1)}.`);
  if (noise || life) model.push([noise ? `Noise is ${noise}` : "", life ? `motor life is ${life.charAt(0).toLowerCase()}${life.slice(1)}` : ""].filter(Boolean).join(", and ") + ".");
  return { model, faqs };
}

function membraneFacts(p: Product): Pick<ProductFacts, "model" | "faqs"> {
  const thickness = spec(p, "thickness");
  const microns = thickness?.match(/(\d+(?:\.\d+)?)\s*[µμ]m/)?.[1];
  const box = spec(p, "in the box");
  const dims = parseDims(box) ?? parseDims(p.name);
  const resistance = spec(p, "area resistance");
  const form = spec(p, "ionic form");
  const model: string[] = [];
  const faqs: Faq[] = [];
  if (thickness) {
    const line = `It is ${thickness} thick${microns && !/inch/i.test(thickness) ? `, about ${fig(Number(microns) / 25.4)} mil` : ""}.`;
    model.push(line);
    faqs.push({ q: `How thick is the ${p.name}?`, a: line });
  }
  if (dims) model.push(`Each sheet is ${fig(dims.a / 10)} × ${fig(dims.b / 10)} cm, which is ${fig((dims.a * dims.b) / 100)} cm².`);
  if (resistance) model.push(`Area resistance is ${resistance}.`);
  if (form) model.push(`It is supplied in ${form} form.`);
  return { model, faqs };
}

function porousFacts(p: Product): Pick<ProductFacts, "model" | "faqs"> {
  const dims = parseDims(spec(p, "size")) ?? parseDims(p.name);
  const porosity = spec(p, "porosity");
  const ppi = spec(p, "cell size (ppi)");
  const thickness = spec(p, "thickness");
  const model: string[] = [];
  const faqs: Faq[] = [];
  if (dims) {
    const small = Math.floor(dims.a / 10) * Math.floor(dims.b / 10);
    const large = Math.floor(dims.a / 50) * Math.floor(dims.b / 50);
    const line = `A ${fig(dims.a)} × ${fig(dims.b)} mm sheet gives up to ${small} electrodes of 1 × 1 cm${large ? `, or ${large} of 5 × 5 cm` : ""}.`;
    model.push(line);
    faqs.push({ q: `How many electrodes can I cut from the ${p.name}?`, a: line });
  }
  const rest = [thickness ? `${thickness} thick` : "", ppi, porosity ? `${porosity} porosity` : ""].filter(Boolean);
  if (rest.length) model.push(`It is ${rest.join(", ")}.`);
  return { model, faqs };
}

function pressFacts(p: Product): Pick<ProductFacts, "model" | "faqs"> {
  const tons = firstNumber(spec(p, "press capacity"));
  const area = spec(p, "working area");
  const pressure = spec(p, "hydraulic pressure", "pressure range");
  if (!tons) return { model: [], faqs: [] };
  const line = `A ${tons} ton press applies up to about ${Math.round(tons * 9.80665)} kN of force.`;
  return {
    model: [line, ...(area ? [`The working area is ${area}.`] : []), ...(pressure ? [`Hydraulic pressure is ${pressure}.`] : [])],
    faqs: [{ q: `How much force does the ${p.name} apply?`, a: line }],
  };
}

/** Specs that tell one cell or instrument from another, for families with no arithmetic to do. */
const GENERAL_LABELS = [
  "model",
  "chamber capacity",
  "product configuration",
  "product capacity",
  "electrolyte volume",
  "electrode area",
  "active area",
  "active area options",
  "body material",
  "cell body material",
  "chamber material",
  "lid material",
  "optical window",
  "standard internal diameter",
  "tube compatibility",
  "total system power",
  "voltage range",
  "current range",
  "temperature range",
  "concentration",
  "purity",
  "capacity",
];

function generalFacts(p: Product): Pick<ProductFacts, "model" | "faqs"> {
  const model: string[] = [];
  for (const label of GENERAL_LABELS) {
    const value = spec(p, label);
    if (value && value.length <= 90) model.push(`${label.charAt(0).toUpperCase()}${label.slice(1)}: ${value}.`);
    if (model.length === 5) break;
  }
  return { model, faqs: [] };
}

function familyFacts(p: Product): Pick<ProductFacts, "model" | "faqs"> {
  const disk = spec(p, "disk diameter");
  if (disk && lengthMm(disk)) return diskFacts(p, disk);
  if (spec(p, "filling solution")) return referenceFacts(p);
  if (p.categorySlug === "electrode-holders") return holderFacts(p);
  if (p.categorySlug === "peristaltic-pumps") return pumpFacts(p);
  if (["aem-membranes", "cem-membranes", "pem-membranes", "bipolar-membranes"].includes(p.categorySlug)) return membraneFacts(p);
  if (p.categorySlug === "carbon-gdl") return porousFacts(p);
  if (p.categorySlug === "mea-fabrication") return pressFacts(p);
  if (p.categorySlug === "counter-electrodes") {
    const dims = parseDims(spec(p, "size")) ?? parseDims(p.name.replace(/[Øφ]\s*\d+(?:\.\d+)?\s*[×xX]\s*\d+(?:\.\d+)?\s*mm/g, ""));
    if (/mesh/i.test(p.name)) return meshFacts(p, dims);
    if (/wire|ring|spiral|spring/i.test(p.name)) return wireFacts(p);
    if (dims && /sheet|plate/i.test(p.name)) return sheetFacts(p, dims);
    if (/rod/i.test(p.name)) return rodFacts(p);
  }
  return generalFacts(p);
}

const hasPrice = (p: Product) => p.price > 0 && !isQuoteOnly(p);

function buyingFacts(p: Product, siblings: Product[], head: string | undefined): string[] {
  if (!hasPrice(p)) return [];
  const price = inclGSTForProduct(p, p.price);
  const lines = [`The price is ${formatINR(p.price)} plus ${p.gstRate}% GST, which comes to ${formatINR(price)}, with free shipping in India.`];
  const others = siblings.filter(hasPrice).map((s) => ({ s, price: inclGSTForProduct(s, s.price) }));
  if (!head || others.length === 0) return lines;

  const lower = others.filter((o) => o.price < price).sort((a, b) => b.price - a.price);
  const higher = others.filter((o) => o.price > price);
  const total = others.length + 1;
  if (lower.length === 0 && higher.length > 0) lines.push(`It is the lowest priced of the ${total} ${head} models we list.`);
  else if (higher.length === 0 && lower.length > 0) lines.push(`It is the highest priced of the ${total} ${head} models we list.`);
  else if (lower.length > 0) lines.push(`Of the ${total} ${head} models we list, ${lower.length} cost less and ${higher.length} cost more.`);
  if (lower[0]) lines.push(`The next lower priced model is the ${lower[0].s.seoTitle || lower[0].s.name}, at ${formatINR(lower[0].price)}.`);
  return lines;
}

export function productFacts(p: Product, siblings: Product[] = [], head?: string): ProductFacts {
  const { model, faqs } = familyFacts(p);
  const box = spec(p, "in the box")?.replace(/(\d)\s*\*\s*/g, "$1 × ");
  return {
    model: model.filter((line) => line.length > 1),
    buying: buyingFacts(p, siblings, head),
    faqs: [...faqs, ...(box ? [{ q: `What comes in the box with the ${p.name}?`, a: `${box}.` }] : [])],
  };
}
