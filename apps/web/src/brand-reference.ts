export type BrandMatchSource = "dictionary_exact" | "dictionary_fuzzy" | "seller_brand" | "none";

export type BrandMatch = {
  brand: string | null;
  confidence: number;
  source: BrandMatchSource;
};

type BrandEntry = {
  canonical: string;
  aliases: string[];
};

const BRAND_STOPWORDS = new Set([
  "mens",
  "men",
  "womens",
  "women",
  "vintage",
  "new",
  "preowned",
  "preowneds",
  "pre-owned",
  "authentic",
  "rare",
  "classic",
  "small",
  "medium",
  "large",
  "wallet",
  "wallets",
  "bag",
  "bags",
  "dress",
  "dresses"
]);

const BRAND_DICTIONARY: BrandEntry[] = [
  { canonical: "Gucci", aliases: ["gucci"] },
  { canonical: "Louis Vuitton", aliases: ["louis vuitton", "louisvuitton", "lv"] },
  { canonical: "Chanel", aliases: ["chanel"] },
  { canonical: "Hermes", aliases: ["hermes", "hermes paris"] },
  { canonical: "Prada", aliases: ["prada"] },
  { canonical: "Fendi", aliases: ["fendi"] },
  { canonical: "Dior", aliases: ["dior", "christian dior"] },
  { canonical: "Saint Laurent", aliases: ["saint laurent", "ysl", "yves saint laurent"] },
  { canonical: "Bottega Veneta", aliases: ["bottega veneta"] },
  { canonical: "Balenciaga", aliases: ["balenciaga"] },
  { canonical: "Celine", aliases: ["celine"] },
  { canonical: "Givenchy", aliases: ["givenchy"] },
  { canonical: "Versace", aliases: ["versace"] },
  { canonical: "Burberry", aliases: ["burberry"] },
  { canonical: "Valentino", aliases: ["valentino"] },
  { canonical: "Cartier", aliases: ["cartier"] },
  { canonical: "Rolex", aliases: ["rolex"] },
  { canonical: "Omega", aliases: ["omega"] },
  { canonical: "Patek Philippe", aliases: ["patek philippe", "patek"] },
  { canonical: "Audemars Piguet", aliases: ["audemars piguet", "ap"] },
  { canonical: "IWC", aliases: ["iwc", "iwc schaffhausen"] },
  { canonical: "Longines", aliases: ["longines"] },
  { canonical: "Tudor", aliases: ["tudor"] },
  { canonical: "MCM", aliases: ["mcm"] },
  { canonical: "Coach", aliases: ["coach"] },
  { canonical: "Tory Burch", aliases: ["tory burch"] },
  { canonical: "Longchamp", aliases: ["longchamp"] }
];

type AliasEntry = { alias: string; canonical: string };
const ALIASES: AliasEntry[] = BRAND_DICTIONARY.flatMap((entry) =>
  entry.aliases.map((alias) => ({ alias: normalize(alias), canonical: entry.canonical }))
).sort((a, b) => b.alias.length - a.alias.length);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value).split(" ").filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function fuzzySingleTokenBrand(text: string): BrandMatch | null {
  const tokens = tokenize(text).filter((token) => token.length >= 4 && !BRAND_STOPWORDS.has(token));
  for (const token of tokens) {
    for (const aliasEntry of ALIASES) {
      if (aliasEntry.alias.includes(" ")) continue;
      const maxDistance = aliasEntry.alias.length >= 7 ? 2 : 1;
      const distance = levenshtein(token, aliasEntry.alias);
      if (distance <= maxDistance) {
        return { brand: aliasEntry.canonical, confidence: 0.78, source: "dictionary_fuzzy" };
      }
    }
  }
  return null;
}

export function inferBrandFromText(input: {
  title?: string | null;
  description?: string | null;
  sellerBrand?: string | null;
}): BrandMatch {
  const title = normalize(input.title ?? "");
  const description = normalize(input.description ?? "");
  const haystack = `${title} ${description}`.trim();
  const sellerBrand = normalize(input.sellerBrand ?? "");

  if (sellerBrand && !BRAND_STOPWORDS.has(sellerBrand)) {
    const knownSellerBrand = ALIASES.find((entry) => entry.alias === sellerBrand);
    if (knownSellerBrand) return { brand: knownSellerBrand.canonical, confidence: 0.97, source: "dictionary_exact" };
  }

  for (const aliasEntry of ALIASES) {
    const pattern = ` ${aliasEntry.alias} `;
    const padded = ` ${haystack} `;
    if (padded.includes(pattern)) {
      return { brand: aliasEntry.canonical, confidence: 0.93, source: "dictionary_exact" };
    }
  }

  const fuzzy = fuzzySingleTokenBrand(haystack);
  if (fuzzy) return fuzzy;

  if (sellerBrand && !BRAND_STOPWORDS.has(sellerBrand)) {
    return {
      brand: sellerBrand
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
      confidence: 0.55,
      source: "seller_brand"
    };
  }

  return { brand: null, confidence: 0, source: "none" };
}

