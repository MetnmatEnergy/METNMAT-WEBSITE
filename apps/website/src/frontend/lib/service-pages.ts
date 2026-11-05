import type { GuideSection } from "@/frontend/lib/guides";

/**
 * Landing pages for testing services (/services/<slug>).
 *
 * metnmat.in drew about 640 impressions in 90 days for "microstructure analysis"
 * and "metallurgical testing", and the only page for them was the general
 * /services page. Every technique named here is one the site already publishes in
 * service-details.ts. Nothing here may claim an accreditation, a test standard, a
 * turnaround time or a price: none is on record.
 */
export type ServicePage = {
  title: string;
  h1: string;
  description: string;
  answer: string;
  sections: GuideSection[];
  faqs: { q: string; a: string }[];
  links: { href: string; name: string }[];
  keywords: string[];
  /** Blog posts on this subject, which link here. */
  posts: string[];
};

export const SERVICE_PAGES: Record<string, ServicePage> = {
  "microstructure-analysis": {
    title: "Microstructure Analysis Services in India",
    h1: "Microstructure Analysis Services",
    description: "METNMAT examines the microstructure of metals and alloys by optical microscopy, SEM, XRD and EDS, and reports what it means for your material.",
    answer:
      "Microstructure analysis shows what a material looks like at the scale of its grains and phases, and why it behaves as it does. METNMAT images your samples by optical microscopy and SEM, identifies phases by XRD and checks local composition by EDS, then reports what the structure means for properties, processing and failures.",
    sections: [
      {
        h2: "What microstructure analysis tells you",
        list: [
          "Grain size and shape, which affect strength and toughness.",
          "Which phases are present, and how much of each, and how they are spread.",
          "Inclusions and how clean the material is.",
          "Porosity, cracks and casting defects.",
          "Whether a heat treatment gave the structure you wanted.",
        ],
      },
      {
        h2: "Techniques we use",
        table: {
          caption: "Microstructure analysis techniques and what each shows",
          head: ["Technique", "What it shows"],
          rows: [
            ["Optical microscopy", "Grains, phases, inclusions and defects at lower magnification"],
            ["SEM", "Fine detail of the structure and fracture surfaces at high magnification"],
            ["EDS", "The elements present in a chosen spot, such as an inclusion"],
            ["XRD", "Which crystalline phases are present"],
            ["Hardness testing", "How the structure translates into a measured property"],
          ],
        },
      },
      {
        h2: "When to ask for it",
        list: [
          "A part has cracked, worn out or failed early, and you need the cause.",
          "You changed a supplier, a material grade or a process, and want to check the result.",
          "You are tuning a heat treatment and need to see the phases and grain size it produced.",
          "You want to compare your product with a competitor's, measured the same way.",
          "You are developing a new alloy or process.",
        ],
      },
      {
        h2: "How it works",
        list: [
          "Tell us the material, how it was made and what you want to find out.",
          "We scope the tests and send you a quote.",
          "We prepare the samples, then image and analyse them.",
          "You get a report that ties the structure back to your question.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is microstructure analysis?",
        a: "It is the study of a material's internal structure, such as its grains, phases and defects, usually under a microscope. That structure sets properties like strength, hardness and toughness.",
      },
      {
        q: "Why does microstructure matter?",
        a: "Two parts of the same composition can behave very differently if their microstructure differs. Heat treatment and processing change the structure, which is why it is checked when a part fails or a process changes.",
      },
      {
        q: "Which materials can you analyse?",
        a: "Metals and alloys are our core work. Tell us your material and we will confirm whether we can test it.",
      },
      {
        q: "What do I get at the end?",
        a: "A data-backed report with images and results, written to answer the question you came with.",
      },
      {
        q: "How do I get a price?",
        a: "Send your request through the quote form. The price depends on the material, the number of samples and the tests needed.",
      },
    ],
    links: [
      { href: "/services/metallurgical-testing", name: "Metallurgical testing" },
      { href: "/services", name: "All services" },
      { href: "/projects/microstructure-control-heat-treatment", name: "Project: microstructure control and heat treatment" },
      { href: "/blog/microstructural-analysis-advanced-materials-and-quality-control", name: "Article: microstructural analysis" },
      { href: "/blog/defect-and-microstructure-analysis-by-diffraction", name: "Article: analysis by diffraction" },
    ],
    keywords: ["microstructure analysis", "microstructure analysis services", "microstructural analysis", "microstructure evaluation", "metallography services India"],
    posts: ["microstructural-analysis-advanced-materials-and-quality-control", "defect-and-microstructure-analysis-by-diffraction"],
  },

  "metallurgical-testing": {
    title: "Metallurgical Testing Services in India",
    h1: "Metallurgical Testing Services",
    description: "Mechanical testing, composition analysis, metallography and failure investigation for metals and alloys from METNMAT, with a report you can act on.",
    answer:
      "Metallurgical testing measures what a metal or alloy is made of, how strong it is, and why it behaved as it did. METNMAT runs tensile, hardness and impact tests, composition analysis by OES, XRF and EDS, microstructure work and thermal analysis, and ties the results together in one report.",
    sections: [
      {
        h2: "Tests we run",
        table: {
          caption: "Metallurgical tests and what each tells you",
          head: ["Test", "What it tells you"],
          rows: [
            ["Tensile", "Strength and ductility"],
            ["Hardness", "Resistance to indentation, a quick check on heat treatment"],
            ["Impact", "Toughness under a sudden load"],
            ["OES and XRF", "The composition of the material"],
            ["Optical microscopy and SEM", "The microstructure and any defects"],
            ["XRD", "The phases present"],
            ["EDS", "The composition of a chosen spot"],
            ["DSC and TGA", "How the material behaves as it is heated"],
            ["Inclusion rating", "How clean the steel or alloy is"],
            ["Fractography", "How and where a part broke"],
          ],
        },
      },
      {
        h2: "Why companies test",
        list: [
          "To check that incoming material matches its specification.",
          "To find why a part failed in service.",
          "To control quality in casting, forging, rolling and heat treatment.",
          "To compare a product with a competitor's on the same bench.",
          "To support research on a new alloy or process.",
        ],
      },
      {
        h2: "Finding out why a part failed",
        text: [
          "When a line loses yield to cracks, porosity or inclusions, we section and examine the failed parts to trace each defect to its source. Fractography shows how the part broke, metallography shows the structure around the crack, and composition analysis checks the material itself.",
          "Because METNMAT also works on processes, the report can go further than the test result, to what to change so that the defect does not return.",
        ],
      },
      {
        h2: "How it works",
        list: [
          "Tell us the material and what you need to know.",
          "We choose the tests that answer it and send you a quote.",
          "We test your samples.",
          "You get one report that brings the results together.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is metallurgical testing?",
        a: "It is the testing of metals and alloys to find their composition, structure and mechanical properties. It is used in quality control, failure analysis and research.",
      },
      {
        q: "What is the difference between mechanical and metallurgical testing?",
        a: "Mechanical tests measure properties such as strength and hardness. Metallurgical testing is wider: it also covers composition and microstructure, which explain those properties.",
      },
      {
        q: "Can you find out why a part failed?",
        a: "Yes. We examine the fracture and the structure around it, check the composition, and report the likely cause and what to change.",
      },
      {
        q: "How do I get a price?",
        a: "Send your request through the quote form. The price depends on the material, the number of samples and the tests needed.",
      },
    ],
    links: [
      { href: "/services/microstructure-analysis", name: "Microstructure analysis" },
      { href: "/services", name: "All services" },
      { href: "/blog/metallurgical-testing-in-quality-control-and-assurance", name: "Article: testing in quality control" },
      { href: "/projects", name: "Our projects" },
    ],
    keywords: ["metallurgical testing", "metallurgy testing", "metallurgical testing services", "metallurgy tests", "metal testing lab India", "failure analysis India"],
    posts: ["metallurgical-testing-in-quality-control-and-assurance", "introduction-to-metallurgy"],
  },
};

/** Every service landing page, for the footer and the services page. */
export const servicePageLinks = () => Object.entries(SERVICE_PAGES).map(([slug, s]) => ({ href: `/services/${slug}`, name: s.h1 }));

/** The service a blog post on this subject should point to. */
export const serviceForPost = (post: string) => {
  const hit = Object.entries(SERVICE_PAGES).find(([, s]) => s.posts.includes(post));
  return hit ? { href: `/services/${hit[0]}`, name: hit[1].h1 } : undefined;
};
