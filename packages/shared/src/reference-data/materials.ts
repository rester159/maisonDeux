import type { MaterialEntry } from "../attribute-types.js";

/**
 * Material vocabulary for attribute extraction.
 * Includes luxury leathers, fabrics, and common marketplace terms.
 */
export const MATERIAL_VOCABULARY: MaterialEntry[] = [
  // Leather (general)
  { canonical: "Leather", aliases: ["leather", "cuir", "pelle", "genuine leather"], family: "leather" },
  { canonical: "Saffiano Leather", aliases: ["saffiano", "saffiano leather", "saffiano lux", "saffiano calfskin"], family: "leather" },
  { canonical: "Epsom Leather", aliases: ["epsom", "epsom leather", "epsom calf"], family: "leather" },
  { canonical: "Togo Leather", aliases: ["togo", "togo leather", "togo calf"], family: "leather" },
  { canonical: "Clemence Leather", aliases: ["clemence", "clemence leather"], family: "leather" },
  { canonical: "Box Leather", aliases: ["box leather", "box calf", "box calfskin"], family: "leather" },
  { canonical: "Barenia Leather", aliases: ["barenia", "barenia leather", "barenia calf"], family: "leather" },
  { canonical: "Vachetta", aliases: ["vachetta", "vachetta leather", "natural leather", "raw leather"], family: "leather" },
  { canonical: "Calfskin", aliases: ["calfskin", "calf leather", "calf", "veau"], family: "leather" },
  { canonical: "Lambskin", aliases: ["lambskin", "lamb leather", "lamb", "agneau"], family: "leather" },
  { canonical: "Goatskin", aliases: ["goatskin", "goat leather", "chevre"], family: "leather" },
  { canonical: "Suede", aliases: ["suede", "daim", "sueded"], family: "leather" },
  { canonical: "Nubuck", aliases: ["nubuck", "nubuck leather"], family: "leather" },
  { canonical: "Patent Leather", aliases: ["patent", "patent leather", "vernis", "patent calf"], family: "leather" },
  { canonical: "Exotic Leather", aliases: ["exotic leather", "crocodile", "alligator", "croc", "lizard", "ostrich", "python", "snake"], family: "leather" },
  { canonical: "Crocodile", aliases: ["crocodile", "croc", "crocodile leather"], family: "leather" },
  { canonical: "Alligator", aliases: ["alligator", "alligator leather"], family: "leather" },
  { canonical: "Ostrich", aliases: ["ostrich", "ostrich leather"], family: "leather" },
  { canonical: "Python", aliases: ["python", "python leather", "snake"], family: "leather" },
  { canonical: "Lizard", aliases: ["lizard", "lizard leather"], family: "leather" },
  // Canvas & coated
  { canonical: "Canvas", aliases: ["canvas", "toile", "cotton canvas"], family: "fabric" },
  { canonical: "Coated Canvas", aliases: ["coated canvas", "pvc canvas", "monogram canvas"], family: "fabric" },
  { canonical: "GG Supreme Canvas", aliases: ["gg supreme", "gg supreme canvas", "gucci canvas"], family: "fabric" },
  { canonical: "Monogram Canvas", aliases: ["monogram", "monogram canvas", "lv canvas", "louis vuitton canvas"], family: "fabric" },
  { canonical: "Damier", aliases: ["damier", "damier canvas", "damier ebene", "damier azur"], family: "fabric" },
  { canonical: "Toile", aliases: ["toile", "toile de jouy", "toile canvas"], family: "fabric" },
  { canonical: "Jacquard", aliases: ["jacquard", "jacquard fabric"], family: "fabric" },
  // Fabrics
  { canonical: "Cotton", aliases: ["cotton", "coton"], family: "fabric" },
  { canonical: "Linen", aliases: ["linen", "lin"], family: "fabric" },
  { canonical: "Silk", aliases: ["silk", "soie", "seta"], family: "fabric" },
  { canonical: "Satin", aliases: ["satin", "sateen"], family: "fabric" },
  { canonical: "Velvet", aliases: ["velvet", "velours", "velluto"], family: "fabric" },
  { canonical: "Wool", aliases: ["wool", "laine", "lana"], family: "fabric" },
  { canonical: "Cashmere", aliases: ["cashmere", "cachemire"], family: "fabric" },
  { canonical: "Tweed", aliases: ["tweed", "tweed fabric"], family: "fabric" },
  { canonical: "Denim", aliases: ["denim", "jean"], family: "fabric" },
  { canonical: "Nylon", aliases: ["nylon", "nylon fabric"], family: "fabric" },
  { canonical: "Polyester", aliases: ["polyester", "poly"], family: "fabric" },
  { canonical: "Felt", aliases: ["felt", "felt fabric"], family: "fabric" },
  // Metals (hardware / watches / jewelry)
  { canonical: "Stainless Steel", aliases: ["stainless steel", "steel", "acier", "inox", "ss"], family: "metal" },
  { canonical: "Gold", aliases: ["gold", "yellow gold", "18k gold", "14k gold", "solid gold"], family: "metal" },
  { canonical: "Rose Gold", aliases: ["rose gold", "pink gold", "rg"], family: "metal" },
  { canonical: "White Gold", aliases: ["white gold", "wg"], family: "metal" },
  { canonical: "Platinum", aliases: ["platinum", "plat"], family: "metal" },
  { canonical: "Silver", aliases: ["silver", "sterling silver", "925"], family: "metal" },
  { canonical: "Brass", aliases: ["brass", "brass hardware", "antique brass"], family: "metal" },
  { canonical: "PVD", aliases: ["pvd", "pvd coating", "black pvd", "gunmetal pvd"], family: "metal" },
  { canonical: "Ceramic", aliases: ["ceramic", "ceramics", "ceramic bezel"], family: "other" },
  { canonical: "Titanium", aliases: ["titanium", "ti"], family: "metal" },
  // Other
  { canonical: "Rubber", aliases: ["rubber", "caoutchouc", "silicone strap"], family: "other" },
  { canonical: "Cork", aliases: ["cork", "cork leather"], family: "other" },
  { canonical: "Straw", aliases: ["straw", "raffia", "woven straw"], family: "other" },
  { canonical: "Recycled Material", aliases: ["recycled", "upcycled", "eco leather"], family: "other" }
];
