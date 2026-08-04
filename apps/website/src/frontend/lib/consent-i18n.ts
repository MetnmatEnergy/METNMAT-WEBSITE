/**
 * The consent notice, in English and Eighth Schedule languages.
 *
 * DPDP s.5(3): the Data Fiduciary "shall give the Data Principal the option to
 * access the contents of the notice ... in English or any language specified in
 * the Eighth Schedule to the Constitution of India." The dialog IS the notice at
 * the point of collection, so the option belongs there rather than only on the
 * policy page.
 *
 * ENGLISH IS AUTHORITATIVE. The translations exist so the notice can actually be
 * understood; where a rendering is ambiguous, the English text governs, and that
 * is stated in the dialog itself rather than left implicit.
 *
 * Adding a language is one entry — nothing else changes. Only languages with a
 * translation that has been read by someone who speaks it should be listed here;
 * a machine-rendered legal notice is worse than an honest English-only one.
 */

export type NoticeCopy = {
  /** Endonym, shown in the picker in its own script. */
  label: string;
  /** BCP-47 tag for the lang attribute, so screen readers switch voice. */
  lang: string;
  heading: string;
  act: string;
  body1: string;
  body2: string;
  manage: string;
  reject: string;
  accept: string;
  save: string;
  closeNoChange: string;
  necessaryTitle: string;
  necessaryDesc: string;
  alwaysOn: string;
  analyticsTitle: string;
  analyticsDesc: string;
  footerPre: string;
  footerLink: string;
  authoritative: string;
  languageLabel: string;
};

export const NOTICE_LANGUAGES: Record<string, NoticeCopy> = {
  en: {
    label: "English",
    lang: "en-IN",
    heading: "Your privacy choice",
    act: "Digital Personal Data Protection Act, 2023",
    body1:
      "We'd like to measure how this site is used — pages viewed, how you arrived, device type — using a random identifier in your browser. It is first-party only: never shared with advertisers, and no IP address is stored with it.",
    body2: "The site works exactly the same if you decline.",
    manage: "Manage preferences",
    reject: "Reject",
    accept: "Accept",
    save: "Save choices",
    closeNoChange: "Close without changing",
    necessaryTitle: "Strictly necessary",
    necessaryDesc:
      "Your cart, sign-in session, theme and currency. The site cannot work without these, so they are always on and are never used for tracking.",
    alwaysOn: "Always on",
    analyticsTitle: "Analytics",
    analyticsDesc:
      "A random visitor and session identifier, the pages you view, and how you arrived.",
    footerPre: "Change this any time from Privacy choices in the footer.",
    footerLink: "Privacy Policy",
    authoritative: "",
    languageLabel: "Notice language",
  },

  hi: {
    label: "हिन्दी",
    lang: "hi-IN",
    heading: "आपकी गोपनीयता का विकल्प",
    act: "डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023",
    body1:
      "हम यह मापना चाहते हैं कि इस साइट का उपयोग कैसे किया जाता है — कौन से पृष्ठ देखे गए, आप यहाँ कैसे पहुँचे, और डिवाइस किस प्रकार का है — इसके लिए आपके ब्राउज़र में एक यादृच्छिक पहचानकर्ता का उपयोग किया जाता है। यह केवल हमारा अपना है: इसे विज्ञापनदाताओं के साथ कभी साझा नहीं किया जाता, और इसके साथ कोई IP पता संग्रहीत नहीं किया जाता।",
    body2: "यदि आप अस्वीकार करते हैं, तब भी साइट बिल्कुल वैसे ही काम करती है।",
    manage: "प्राथमिकताएँ प्रबंधित करें",
    reject: "अस्वीकार करें",
    accept: "स्वीकार करें",
    save: "विकल्प सहेजें",
    closeNoChange: "बिना बदले बंद करें",
    necessaryTitle: "अत्यंत आवश्यक",
    necessaryDesc:
      "आपकी कार्ट, साइन-इन सत्र, थीम और मुद्रा। इनके बिना साइट काम नहीं कर सकती, इसलिए ये हमेशा चालू रहते हैं और कभी ट्रैकिंग के लिए उपयोग नहीं किए जाते।",
    alwaysOn: "हमेशा चालू",
    analyticsTitle: "विश्लेषण",
    analyticsDesc:
      "एक यादृच्छिक विज़िटर और सत्र पहचानकर्ता, आपके द्वारा देखे गए पृष्ठ, और आप यहाँ कैसे पहुँचे।",
    footerPre: "आप इसे कभी भी फ़ुटर में “गोपनीयता विकल्प” से बदल सकते हैं।",
    footerLink: "गोपनीयता नीति",
    authoritative: "इस सूचना का अंग्रेज़ी पाठ ही अंतिम रूप से मान्य है।",
    languageLabel: "सूचना की भाषा",
  },

  bn: {
    label: "বাংলা",
    lang: "bn-IN",
    heading: "আপনার গোপনীয়তার পছন্দ",
    act: "ডিজিটাল ব্যক্তিগত তথ্য সুরক্ষা আইন, ২০২৩",
    body1:
      "আমরা জানতে চাই এই সাইটটি কীভাবে ব্যবহৃত হয় — কোন পৃষ্ঠাগুলি দেখা হয়েছে, আপনি কীভাবে এসেছেন, কোন ধরনের ডিভাইস — এর জন্য আপনার ব্রাউজারে একটি এলোমেলো শনাক্তকারী ব্যবহার করা হয়। এটি সম্পূর্ণ আমাদের নিজস্ব: বিজ্ঞাপনদাতাদের সঙ্গে কখনও ভাগ করা হয় না, এবং এর সঙ্গে কোনও IP ঠিকানা সংরক্ষণ করা হয় না।",
    body2: "আপনি প্রত্যাখ্যান করলেও সাইটটি ঠিক একইভাবে কাজ করে।",
    manage: "পছন্দ পরিচালনা করুন",
    reject: "প্রত্যাখ্যান করুন",
    accept: "সম্মতি দিন",
    save: "পছন্দ সংরক্ষণ করুন",
    closeNoChange: "না বদলে বন্ধ করুন",
    necessaryTitle: "একান্ত প্রয়োজনীয়",
    necessaryDesc:
      "আপনার কার্ট, সাইন-ইন সেশন, থিম এবং মুদ্রা। এগুলি ছাড়া সাইটটি চলতে পারে না, তাই এগুলি সর্বদা চালু থাকে এবং কখনও ট্র্যাকিং-এর জন্য ব্যবহার করা হয় না।",
    alwaysOn: "সর্বদা চালু",
    analyticsTitle: "বিশ্লেষণ",
    analyticsDesc:
      "একটি এলোমেলো ভিজিটর ও সেশন শনাক্তকারী, আপনি যে পৃষ্ঠাগুলি দেখেন, এবং আপনি কীভাবে এসেছেন।",
    footerPre: "আপনি যে কোনও সময় ফুটারের “গোপনীয়তা পছন্দ” থেকে এটি পরিবর্তন করতে পারেন।",
    footerLink: "গোপনীয়তা নীতি",
    authoritative: "এই বিজ্ঞপ্তির ইংরেজি পাঠটিই চূড়ান্তভাবে প্রযোজ্য।",
    languageLabel: "বিজ্ঞপ্তির ভাষা",
  },
};

export const NOTICE_LANGUAGE_KEYS = Object.keys(NOTICE_LANGUAGES);

/**
 * Best starting language for this visitor, from the browser's own preference —
 * an option they never have to find is not much of an option. Falls back to
 * English, which is always offered.
 */
export function preferredNoticeLanguage(): string {
  if (typeof navigator === "undefined") return "en";
  try {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const base = String(tag).toLowerCase().split("-")[0];
      if (base && base in NOTICE_LANGUAGES) return base;
    }
  } catch {
    /* fall through */
  }
  return "en";
}
