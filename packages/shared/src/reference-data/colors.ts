import type { ColorEntry } from "../attribute-types.js";

/**
 * Fashion-aware color vocabulary for attribute extraction.
 * Canonical names + aliases (incl. French/Italian luxury terms).
 */
export const COLOR_VOCABULARY: ColorEntry[] = [
  // Blacks & grays
  { canonical: "Black", aliases: ["black", "noir", "nero", "blk"], family: "black" },
  { canonical: "Charcoal", aliases: ["charcoal", "charcoal grey", "charcoal gray"], family: "gray" },
  { canonical: "Gray", aliases: ["grey", "gray", "gris", "grigio", "silver grey"], family: "gray" },
  { canonical: "Slate", aliases: ["slate", "slate gray", "slate grey"], family: "gray" },
  { canonical: "Graphite", aliases: ["graphite", "graphite grey"], family: "gray" },
  { canonical: "Taupe", aliases: ["taupe", "greige", "mushroom"], family: "gray" },
  // Whites & neutrals
  { canonical: "White", aliases: ["white", "blanc", "bianco", "wht"], family: "white" },
  { canonical: "Ivory", aliases: ["ivory", "ivoire", "avorio"], family: "white" },
  { canonical: "Cream", aliases: ["cream", "crème", "crema", "off white"], family: "white" },
  { canonical: "Beige", aliases: ["beige", "nude", "sand", "camel", "camel beige"], family: "beige" },
  { canonical: "Tan", aliases: ["tan", "caramel", "camel", "cognac"], family: "brown" },
  { canonical: "Oatmeal", aliases: ["oatmeal", "oat"], family: "beige" },
  // Browns (leather / luxury)
  { canonical: "Brown", aliases: ["brown", "brun", "marrone", "br"], family: "brown" },
  { canonical: "Cognac", aliases: ["cognac", "cognac leather", "conac"], family: "brown" },
  { canonical: "Espresso", aliases: ["espresso", "dark brown"], family: "brown" },
  { canonical: "Mahogany", aliases: ["mahogany", "mahagony"], family: "brown" },
  { canonical: "Walnut", aliases: ["walnut", "walnut brown"], family: "brown" },
  { canonical: "Honey", aliases: ["honey", "honey brown", "miel"], family: "brown" },
  { canonical: "Tobacco", aliases: ["tobacco", "tobacco brown"], family: "brown" },
  { canonical: "Chocolate", aliases: ["chocolate", "chocolat"], family: "brown" },
  { canonical: "Saddle", aliases: ["saddle", "saddle brown"], family: "brown" },
  { canonical: "Burgundy", aliases: ["burgundy", "bordeaux", "burgundy red", "wine"], family: "red" },
  { canonical: "Oxblood", aliases: ["oxblood", "ox blood", "dark red"], family: "red" },
  // Reds & pinks
  { canonical: "Red", aliases: ["red", "rouge", "rosso", "rd"], family: "red" },
  { canonical: "Bordeaux", aliases: ["bordeaux", "bordaux"], family: "red" },
  { canonical: "Pink", aliases: ["pink", "rose", "rosa", "blush", "blush pink"], family: "pink" },
  { canonical: "Blush", aliases: ["blush", "dusty pink", "nude pink"], family: "pink" },
  { canonical: "Rose", aliases: ["rose", "rose gold", "rose gold tone"], family: "pink" },
  { canonical: "Fuchsia", aliases: ["fuchsia", "magenta", "hot pink"], family: "pink" },
  { canonical: "Coral", aliases: ["coral", "salmon", "peach"], family: "orange" },
  // Blues
  { canonical: "Blue", aliases: ["blue", "bleu", "blu", "bl"], family: "blue" },
  { canonical: "Navy", aliases: ["navy", "navy blue", "bleu marine", "marine"], family: "blue" },
  { canonical: "Royal Blue", aliases: ["royal blue", "royal"], family: "blue" },
  { canonical: "Sky Blue", aliases: ["sky blue", "sky", "light blue"], family: "blue" },
  { canonical: "Turquoise", aliases: ["turquoise", "turq", "teal"], family: "blue" },
  { canonical: "Teal", aliases: ["teal", "petrol", "bleu canard"], family: "blue" },
  { canonical: "Electric Blue", aliases: ["electric blue", "bright blue"], family: "blue" },
  // Greens
  { canonical: "Green", aliases: ["green", "vert", "verde", "grn"], family: "green" },
  { canonical: "Olive", aliases: ["olive", "olive green", "army green"], family: "green" },
  { canonical: "Sage", aliases: ["sage", "sage green", "dusty green"], family: "green" },
  { canonical: "Emerald", aliases: ["emerald", "emerald green"], family: "green" },
  { canonical: "Forest Green", aliases: ["forest green", "forest"], family: "green" },
  { canonical: "Hunter Green", aliases: ["hunter green", "hunter"], family: "green" },
  { canonical: "Mint", aliases: ["mint", "mint green", "seafoam"], family: "green" },
  // Yellows & oranges
  { canonical: "Yellow", aliases: ["yellow", "jaune", "giallo", "ylw"], family: "yellow" },
  { canonical: "Gold", aliases: ["gold", "golden", "or", "oro", "gold tone", "gold-tone"], family: "yellow" },
  { canonical: "Mustard", aliases: ["mustard", "mustard yellow"], family: "yellow" },
  { canonical: "Orange", aliases: ["orange", "arancione"], family: "orange" },
  { canonical: "Amber", aliases: ["amber", "amber brown"], family: "orange" },
  // Purples
  { canonical: "Purple", aliases: ["purple", "violet", "viola", "purple"], family: "purple" },
  { canonical: "Lilac", aliases: ["lilac", "lavender", "lavande"], family: "purple" },
  { canonical: "Plum", aliases: ["plum", "aubergine", "eggplant"], family: "purple" },
  { canonical: "Mauve", aliases: ["mauve", "dusty purple"], family: "purple" },
  // Metallics & special (Hermès etc.)
  { canonical: "Silver", aliases: ["silver", "argent", "argento", "silver tone", "silver-tone"], family: "gray" },
  { canonical: "Champagne", aliases: ["champagne", "champagne gold", "champagne tone"], family: "beige" },
  { canonical: "Etoupe", aliases: ["etoupe", "étoupe", "etope"], family: "gray" },
  { canonical: "Gold", aliases: ["gold", "gold hardware", "gold hw", "ghw"], family: "yellow" },
  { canonical: "Rose Gold", aliases: ["rose gold", "rg", "rose gold tone"], family: "pink" },
  { canonical: "Gunmetal", aliases: ["gunmetal", "gun metal", "dark gray"], family: "gray" },
  { canonical: "Bronze", aliases: ["bronze", "antique brass", "brass"], family: "brown" },
  { canonical: "Copper", aliases: ["copper", "copper tone"], family: "orange" },
  // Multitone / prints
  { canonical: "Multicolor", aliases: ["multicolor", "multi color", "multi-color", "multicolour", "various"], family: "other" },
  { canonical: "Neutral", aliases: ["neutral", "neutrals"], family: "other" },
  { canonical: "Striped", aliases: ["striped", "stripes"], family: "other" },
  { canonical: "Plaid", aliases: ["plaid", "tartan", "check"], family: "other" },
  { canonical: "Animal Print", aliases: ["animal print", "leopard", "zebra", "snake print"], family: "other" }
];
