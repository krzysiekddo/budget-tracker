// Categories, keyword rules for Polish merchants, and the classifier.

/** kind: need = koszty stałe/niezbędne, want = przyjemności, save = oszczędności/długi, income */
export const CATEGORIES = [
  { id: "spozywcze", name: "Zakupy spożywcze", icon: "🛒", color: "#2f9e6e", kind: "need" },
  { id: "restauracje", name: "Jedzenie na mieście", icon: "🍔", color: "#e8803a", kind: "want" },
  { id: "transport", name: "Transport i paliwo", icon: "🚗", color: "#3b7dd8", kind: "need" },
  { id: "rachunki", name: "Mieszkanie i rachunki", icon: "🏠", color: "#6b5bd2", kind: "need" },
  { id: "subskrypcje", name: "Subskrypcje", icon: "📺", color: "#c2459a", kind: "want" },
  { id: "zakupy", name: "Zakupy (ubrania, dom, elektronika)", icon: "🛍️", color: "#d9a520", kind: "want" },
  { id: "zdrowie", name: "Zdrowie, sport i uroda", icon: "💊", color: "#1fa3a8", kind: "need" },
  { id: "rozrywka", name: "Rozrywka i hobby", icon: "🎮", color: "#e0566b", kind: "want" },
  { id: "podroze", name: "Podróże", icon: "✈️", color: "#4ab0e0", kind: "want" },
  { id: "edukacja", name: "Edukacja i rozwój", icon: "📚", color: "#8a6d3b", kind: "need" },
  { id: "przelewy", name: "Przelewy do ludzi / BLIK", icon: "↔️", color: "#7d8796", kind: "other" },
  { id: "gotowka", name: "Gotówka (bankomat)", icon: "💵", color: "#5f8f3a", kind: "other" },
  { id: "dlugi", name: "Raty i spłata długów", icon: "📉", color: "#a33b3b", kind: "save" },
  { id: "oszczednosci", name: "Oszczędności i inwestycje", icon: "🐷", color: "#17766b", kind: "save" },
  { id: "prezenty", name: "Prezenty i darowizny", icon: "🎁", color: "#b5651d", kind: "want" },
  { id: "zwierzeta", name: "Zwierzęta", icon: "🐾", color: "#9c7a54", kind: "need" },
  { id: "inne", name: "Inne", icon: "📦", color: "#9aa4b2", kind: "other" },
  // income
  { id: "wynagrodzenie", name: "Wypłata", icon: "💰", color: "#17766b", kind: "income" },
  { id: "wplywy", name: "Inne wpływy", icon: "📥", color: "#4fa36b", kind: "income" },
];

export const EXPENSE_CATS = CATEGORIES.filter((c) => c.kind !== "income");
export const INCOME_CATS = CATEGORIES.filter((c) => c.kind === "income");
export const REVIEW = "do_sprawdzenia";

const byId = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export function cat(id) {
  return byId[id] ?? { id: REVIEW, name: "Do sprawdzenia", icon: "❓", color: "#b0590a", kind: "other" };
}

// Keyword → category. Matched against the normalized merchant + description.
const RULES = [
  ["spozywcze", ["biedronka", "lidl", "zabka", "kaufland", "auchan", "carrefour", "dino", "netto", "stokrotka", "lewiatan", "aldi", "intermarche", "polomarket", "frisco", "spolem", "groszek", "abc ", "delikatesy", "piekarnia", "warzywniak", "mieso", "sklep spozywczy", "eurospar", "spar ", "mila ", "topaz", "chata polska", "lisek", "barbora", "selgros", "makro"]],
  ["restauracje", ["mcdonald", "kfc", "burger king", "pyszne", "glovo", "uber eats", "ubereats", "wolt", "starbucks", "costa coffee", "pizza", "pizzeria", "kebab", "sushi", "restauracja", "bistro", "bar ", "cafe", "kawiarnia", "subway", "north fish", "max premium", "pasibus", "bobby burger", "thai", "ramen", "telepizza", "dominos", "da grasso", "salad story", "green caffe", "coffee", "lody"]],
  ["transport", ["orlen", "bp ", "shell", "circle k", "moya", "amic", "lotos", "stacja paliw", "uber", "bolt", "free now", "freenow", "pkp", "intercity", "koleo", "jakdojade", "mpk", "ztm", "skm", "parking", "mobilet", "skycash", "autostrada", "a4 ", "e-toll", "etoll", "myjnia", "flixbus", "polregio", "koleje", "traficar", "panek", "4mobility", "lime", "tier", "dott"]],
  ["rachunki", ["pge", "tauron", "enea", "energa", "pgnig", "e.on", "eon ", "innogy", "orange", "play ", "plus ", "t-mobile", "upc", "vectra", "netia", "inea", "czynsz", "wspolnota", "spoldzielnia", "administracja", "woda", "wodociagi", "mpwik", "gaz ", "prad", "internet", "ubezpieczenie", "pzu", "warta", "allianz", "ergo hestia", "link4", "najem", "wynajem"]],
  ["subskrypcje", ["netflix", "spotify", "youtube", "apple.com", "apple com", "itunes", "google play", "google one", "hbo", "max.com", "disney", "prime video", "amazon prime", "canal+", "canal plus", "icloud", "chatgpt", "openai", "anthropic", "claude.ai", "tidal", "player.pl", "skyshowtime", "audioteka", "storytel", "legimi", "empik go", "microsoft", "adobe", "dropbox", "patreon", "onlyfans", "twitch", "xbox game pass", "playstation plus", "subskrypcja"]],
  ["zakupy", ["allegro", "amazon", "zalando", "h&m", "hm ", "reserved", "zara", "pepco", "sinsay", "action", "ikea", "media markt", "mediamarkt", "rtv euro", "euro rtv", "x-kom", "xkom", "morele", "empik", "decathlon", "ccc", "shein", "temu", "aliexpress", "castorama", "leroy", "obi ", "jysk", "tk maxx", "tkmaxx", "lpp", "cropp", "house", "mohito", "media expert", "komputronik", "ole ole", "smyk", "half price", "kik ", "primark", "vinted", "olx", "answear", "modivo", "eobuwie", "4f", "nike", "adidas", "apple store", "istore", "douglas", "notino"]],
  ["zdrowie", ["rossmann", "hebe", "super-pharm", "superpharm", "apteka", "dr.max", "drmax", "dr max", "gemini apteka", "ziko", "medicover", "luxmed", "lux med", "enel-med", "enelmed", "dentysta", "stomatolog", "przychodnia", "lekarz", "fryzjer", "barber", "kosmetyczka", "zdrofit", "cityfit", "city fit", "mcfit", "multisport", "medicus", "silownia", "fitness", "basen", "calypso", "just gym", "optyk", "vision express", "diagnostyka", "alab", "synevo"]],
  ["rozrywka", ["multikino", "cinema city", "helios", "kino", "steam", "playstation", "xbox", "nintendo", "epic games", "bilet", "ebilet", "going.", "eventim", "teatr", "koncert", "muzeum", "bowling", "escape", "kregielnia", "klub", "pub ", "piwo", "alkohol", "monopolowy", "lotto", "totalizator", "fortuna", "sts ", "betclic", "superbet", "gry"]],
  ["podroze", ["booking", "airbnb", "ryanair", "wizz", "lot polish", "polskie linie lotnicze", "hotel", "hostel", "lotnisko", "airport", "easyjet", "trivago", "itaka", "rainbow", "tui", "coral travel", "wakacje.pl", "fly4free", "nocowanie"]],
  ["edukacja", ["udemy", "coursera", "szkola", "kurs", "uczelnia", "uniwersytet", "czesne", "ksiegarnia", "duolingo", "babbel", "egzamin"]],
  ["gotowka", ["bankomat", "atm", "wyplata gotowki", "wypłata gotówki", "euronet", "planet cash", "cash"]],
  ["dlugi", ["rata", "kredyt", "pozyczka", "spłata", "splata", "leasing", "karta kredytowa", "provident", "wonga", "vivus", "smartney", "kredyt hipoteczny"]],
  ["oszczednosci", ["oszczednos", "lokata", "konto oszczednosciowe", "xtb", "revolut savings", "inwestycj", "obligacje", "ike", "ikze", "maklerski", "etoro", "trading 212", "bossa", "przelew wlasny", "przelew własny", "skarbonka", "cel oszczednosciowy"]],
  ["prezenty", ["prezent", "darowizna", "zrzutka", "pomagam", "siepomaga", "wosp", "kwiaciarnia", "kwiaty", "flowers"]],
  ["zwierzeta", ["zooplus", "kakadu", "maxi zoo", "maxizoo", "weterynarz", "zoo ", "pet "]],
  ["przelewy", ["blik na telefon", "przelew na telefon", "przelew blik", "przelew do", "przelew wychodzacy", "przelew na rachunek", "revolut", "zwrot dla"]],
  ["wynagrodzenie", ["wynagrodzenie", "wyplata", "pensja", "premia", "salary", "payroll"]],
];

/** Lowercase, no Polish diacritics, no digits/punctuation noise. */
export function normalize(s) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9&+.\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable key for "remember this merchant": first 3 meaningful words, no numbers. */
export function merchantKey(merchant) {
  const words = normalize(merchant)
    .replace(/[0-9]+/g, " ")
    .replace(/\b(sp|z|o|oo|s\.a|sa|sp\.|ul|nr|pl|warszawa|krakow|wroclaw|poznan|gdansk|lodz|katowice|k\.|platnosc|karta|kartą|zakup|transakcja|blik)\b/g, " ")
    .split(/[ .\-]+/)
    .filter((w) => w.length > 1);
  return words.slice(0, 3).join(" ");
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Every keyword must start at a word boundary; short ones must also end at one ("bp", "play").
const COMPILED = RULES.map(([id, words]) => [
  id,
  words.map((w) => {
    const k = normalize(w);
    const end = k.length <= 5 || /\s$/.test(w) ? "(?![a-z0-9])" : "";
    return new RegExp(`(?<![a-z0-9])${escapeRe(k)}${end}`);
  }),
]);

export function ruleCategory(text) {
  const t = normalize(text);
  if (!t) return null;
  for (const [id, res] of COMPILED) if (res.some((re) => re.test(t))) return id;
  return null;
}

/**
 * Picks a category: the user's learned rule wins, then built-in keywords,
 * then the AI guess when it is confident. Otherwise: needs a manual check.
 */
export function classify({ merchant, description, amount, aiCategory, aiConfidence }, learned = {}) {
  const key = merchantKey(merchant);
  if (key && learned[key]) return { category: learned[key], status: "ok", via: "learned" };
  const text = `${merchant ?? ""} ${description ?? ""}`;
  const rule = ruleCategory(text);
  if (rule) {
    // An income-looking keyword on an outgoing payment (or vice versa) is not trusted.
    const isIncomeCat = cat(rule).kind === "income";
    if ((amount > 0) === isIncomeCat) return { category: rule, status: "ok", via: "rule" };
  }
  if (aiCategory && byId[aiCategory] && (aiConfidence ?? 0) >= 0.7) {
    const isIncomeCat = cat(aiCategory).kind === "income";
    if ((amount > 0) === isIncomeCat) return { category: aiCategory, status: "ok", via: "ai" };
  }
  if (amount > 0) return { category: "wplywy", status: "review", via: "default" };
  return { category: aiCategory && byId[aiCategory] ? aiCategory : REVIEW, status: "review", via: "none" };
}
