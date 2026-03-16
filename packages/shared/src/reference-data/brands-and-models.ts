import type { BrandEntry, ModelEntry } from "../attribute-types.js";

/** Helper to build model entries with common alias patterns */
function models(entries: Array<{ canonical: string; aliases?: string[] }>): ModelEntry[] {
  return entries.map((m) => ({
    canonical: m.canonical,
    aliases: [m.canonical.toLowerCase(), ...(m.aliases ?? [])].filter(
      (a, i, arr) => arr.indexOf(a) === i
    ),
    variants: undefined,
    categories: undefined,
    signature_materials: undefined
  }));
}

/**
 * Brand and model catalog for attribute extraction.
 * Models are scoped per brand to avoid false positives.
 */
export const BRANDS_AND_MODELS: BrandEntry[] = [
  // —— Luxury houses (bags, shoes, accessories) ——
  {
    canonical: "Gucci",
    aliases: ["gucci", "guccio gucci", "gg"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "Ophidia", aliases: ["ophidia", "ophidia gg", "ophidia gg supreme"] },
      { canonical: "Dionysus", aliases: ["dionysus", "dionysus bag"] },
      { canonical: "Marmont", aliases: ["marmont", "marmont matelassé", "marmont matelasse"] },
      { canonical: "Jackie", aliases: ["jackie", "jackie 1961"] },
      { canonical: "Horsebit", aliases: ["horsebit", "horse bit", "1955 horsebit"] },
      { canonical: "Bamboo", aliases: ["bamboo", "bamboo bag", "bamboo 1947"] },
      { canonical: "Sylvie", aliases: ["sylvie", "sylvie bag"] },
      { canonical: "Padlock", aliases: ["padlock", "padlock bag"] },
      { canonical: "Rajah", aliases: ["rajah"] },
      { canonical: "Blondie", aliases: ["blondie"] },
      { canonical: "Giglio", aliases: ["giglio", "giglio print"] },
      { canonical: "Ace", aliases: ["ace", "ace sneaker"] },
      { canonical: "Rhyton", aliases: ["rhyton", "rhyton sneaker"] },
      { canonical: "Princetown", aliases: ["princetown", "princetown loafers", "fur loafers"] }
    ])
  },
  {
    canonical: "Louis Vuitton",
    aliases: ["louis vuitton", "louisvuitton", "lv"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "Neverfull", aliases: ["neverfull", "neverfull mm", "neverfull gm"] },
      { canonical: "Speedy", aliases: ["speedy", "speedy 25", "speedy 30", "speedy b"] },
      { canonical: "Alma", aliases: ["alma", "alma bb", "alma pm"] },
      { canonical: "Pochette Métis", aliases: ["pochette metis", "pochette métis", "metis"] },
      { canonical: "Capucines", aliases: ["capucines"] },
      { canonical: "Twist", aliases: ["twist", "twist mm"] },
      { canonical: "Pochette Accessoires", aliases: ["pochette accessoires", "pochette"] },
      { canonical: "Noé", aliases: ["noe", "noé", "noe bb"] },
      { canonical: "Bumbag", aliases: ["bumbag", "bum bag"] },
      { canonical: "Palm Springs", aliases: ["palm springs", "palm springs mini", "palm springs backpack"] },
      { canonical: "Onthego", aliases: ["onthego", "on the go"] },
      { canonical: "Cannes", aliases: ["cannes", "cannes bag"] },
      { canonical: "Boîte Chapeau", aliases: ["boite chapeau", "boîte chapeau", "hat box"] },
      { canonical: "Petite Malle", aliases: ["petite malle", "mini malle"] },
      { canonical: "Soft Trunk", aliases: ["soft trunk", "soft trunk bag"] }
    ])
  },
  {
    canonical: "Chanel",
    aliases: ["chanel"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "Classic Flap", aliases: ["classic flap", "classic double flap", "cf", "medium flap", "jumbo flap"] },
      { canonical: "Boy", aliases: ["boy", "boy bag", "le boy"] },
      { canonical: "2.55", aliases: ["2.55", "255", "reissue"] },
      { canonical: "19", aliases: ["19", "chanel 19", "c19"] },
      { canonical: "22", aliases: ["22", "chanel 22", "c22"] },
      { canonical: "Gabrielle", aliases: ["gabrielle", "gabrielle bag", "hobo"] },
      { canonical: "Coco Handle", aliases: ["coco handle", "coco handle bag"] },
      { canonical: "WOC", aliases: ["woc", "wallet on chain", "wallet on a chain"] },
      { canonical: "Vanity", aliases: ["vanity", "vanity case", "vanity bag"] },
      { canonical: "Trendy CC", aliases: ["trendy cc", "trendy"] },
      { canonical: "Mini Flap", aliases: ["mini flap", "square mini", "rectangle mini"] },
      { canonical: "Classic Card Holder", aliases: ["card holder", "classic card holder"] },
      { canonical: "Balloon", aliases: ["balloon", "balloon bag"] },
      { canonical: "Cambon", aliases: ["cambon"] },
      { canonical: "Espadrilles", aliases: ["espadrilles", "chanel espadrilles"] }
    ])
  },
  {
    canonical: "Hermès",
    aliases: ["hermes", "hermès", "hermes paris"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "Birkin", aliases: ["birkin", "birkin bag"] },
      { canonical: "Kelly", aliases: ["kelly", "kelly bag", "kelly 25", "kelly 28", "kelly 32"] },
      { canonical: "Constance", aliases: ["constance", "constance bag"] },
      { canonical: "Evelyne", aliases: ["evelyne", "evelyne pm", "evelyne gm"] },
      { canonical: "Herbag", aliases: ["herbag", "herbag zip"] },
      { canonical: "Lindy", aliases: ["lindy", "lindy 26", "lindy 30"] },
      { canonical: "Picotin", aliases: ["picotin", "picotin 18", "picotin 22"] },
      { canonical: "Garden Party", aliases: ["garden party", "garden party 30"] },
      { canonical: "Bolide", aliases: ["bolide", "bolide 1923"] },
      { canonical: "Roulis", aliases: ["roulis", "roulis bag"] },
      { canonical: "Halzan", aliases: ["halzan", "halzan 31"] },
      { canonical: "Jypsière", aliases: ["jypsiere", "jypsière", "jypsiere"] },
      { canonical: "Toolbox", aliases: ["toolbox", "toolbox 26"] },
      { canonical: "Oran", aliases: ["oran", "oran sandals"] },
      { canonical: "Orans", aliases: ["orans"] }
    ])
  },
  {
    canonical: "Prada",
    aliases: ["prada"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "Re-Edition", aliases: ["re-edition", "re edition", "re-edition 2000", "2000 re-edition"] },
      { canonical: "Galleria", aliases: ["galleria", "galleria bag", "saffiano galleria"] },
      { canonical: "Cahier", aliases: ["cahier", "cahier bag"] },
      { canonical: "Sidonie", aliases: ["sidonie", "sidonie bag"] },
      { canonical: "Cleo", aliases: ["cleo", "cleo bag"] },
      { canonical: "Nylon", aliases: ["nylon", "prada nylon", "nylon bag"] },
      { canonical: "Belt Bag", aliases: ["belt bag", "prada belt bag"] },
      { canonical: "Monolith", aliases: ["monolith", "monolith boots"] },
      { canonical: "America's Cup", aliases: ["americas cup", "america's cup", "america cup"] },
      { canonical: "Cloudbust", aliases: ["cloudbust", "cloud bust"] }
    ])
  },
  {
    canonical: "Dior",
    aliases: ["dior", "christian dior", "cd"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "Lady Dior", aliases: ["lady dior", "lady dior bag", "lady dior medium"] },
      { canonical: "Saddle", aliases: ["saddle", "saddle bag", "dior saddle"] },
      { canonical: "Book Tote", aliases: ["book tote", "book tote bag", "oblique book tote"] },
      { canonical: "Bobby", aliases: ["bobby", "bobby bag"] },
      { canonical: "Carousel", aliases: ["carousel", "carousel bag"] },
      { canonical: "Diorama", aliases: ["diorama"] },
      { canonical: "30 Montaigne", aliases: ["30 montaigne", "montaigne"] },
      { canonical: "Bubble", aliases: ["bubble", "bubble bag"] },
      { canonical: "J'adior", aliases: ["jadior", "j'adior", "j adior"] },
      { canonical: "B22", aliases: ["b22", "b22 sneakers"] },
      { canonical: "B30", aliases: ["b30", "b30 sneakers"] }
    ])
  },
  {
    canonical: "Saint Laurent",
    aliases: ["saint laurent", "ysl", "yves saint laurent"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "LouLou", aliases: ["loulou", "loulou bag", "loulou toy"] },
      { canonical: "Kate", aliases: ["kate", "kate bag", "kate tassel"] },
      { canonical: "Sac de Jour", aliases: ["sac de jour", "sac de jour bag", "sdj"] },
      { canonical: "Niki", aliases: ["niki", "niki bag"] },
      { canonical: "Sunset", aliases: ["sunset", "sunset bag"] },
      { canonical: "Le 5 à 7", aliases: ["le 5 a 7", "le 5 à 7", "5 a 7", "5 à 7"] },
      { canonical: "College", aliases: ["college", "college bag"] },
      { canonical: "Envelope", aliases: ["envelope", "envelope bag"] },
      { canonical: "Cassandra", aliases: ["cassandra"] },
      { canonical: "Tribtoo", aliases: ["tribtoo", "tribtoo boots"] },
      { canonical: "Tribute", aliases: ["tribute", "tribute sandals"] },
      { canonical: "Wyatt", aliases: ["wyatt", "wyatt boots"] }
    ])
  },
  {
    canonical: "Bottega Veneta",
    aliases: ["bottega veneta", "bv", "bottega"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "Pouch", aliases: ["pouch", "the pouch", "pouch bag"] },
      { canonical: "Cassette", aliases: ["cassette", "cassette bag"] },
      { canonical: "Jodie", aliases: ["jodie", "jodie bag"] },
      { canonical: "Arco", aliases: ["arco", "arco tote"] },
      { canonical: "BV Twist", aliases: ["bv twist", "twist", "bottega twist"] },
      { canonical: "Kalimero", aliases: ["kalimero"] },
      { canonical: "Sardine", aliases: ["sardine", "sardine bag"] },
      { canonical: "Andiamo", aliases: ["andiamo", "andiamo bag"] },
      { canonical: "Lido", aliases: ["lido", "lido sandals"] },
      { canonical: "Tire", aliases: ["tire", "tire boots"] }
    ])
  },
  {
    canonical: "Celine",
    aliases: ["celine"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "Triomphe", aliases: ["triomphe", "triomphe bag", "triomphe canvas"] },
      { canonical: "Box", aliases: ["box", "classic box", "celine box"] },
      { canonical: "Luggage", aliases: ["luggage", "luggage tote", "phantom"] },
      { canonical: "Belt", aliases: ["belt", "belt bag", "belt bag nano"] },
      { canonical: "16", aliases: ["16", "celine 16"] },
      { canonical: "Ava", aliases: ["ava", "ava bag"] },
      { canonical: "Tabou", aliases: ["tabou"] }
    ])
  },
  {
    canonical: "Fendi",
    aliases: ["fendi"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "Baguette", aliases: ["baguette", "baguette bag", "fendi baguette"] },
      { canonical: "Peekaboo", aliases: ["peekaboo", "peekaboo bag", "peekaboo iseeu"] },
      { canonical: "By the Way", aliases: ["by the way", "btw", "by the way bag"] },
      { canonical: "Sunshine", aliases: ["sunshine", "sunshine tote"] },
      { canonical: "First", aliases: ["first", "first bag"] },
      { canonical: "Kan I", aliases: ["kan i", "kan i bag"] }
    ])
  },
  {
    canonical: "Balenciaga",
    aliases: ["balenciaga", "balenci"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "Hourglass", aliases: ["hourglass", "hourglass bag"] },
      { canonical: "City", aliases: ["city", "city bag", "motorcycle city"] },
      { canonical: "Le Cagole", aliases: ["le cagole", "cagole", "cagole bag"] },
      { canonical: "Neo Classic", aliases: ["neo classic", "neoclassic"] },
      { canonical: "Triangle", aliases: ["triangle", "triangle bag"] },
      { canonical: "Track", aliases: ["track", "track sneakers", "track 2"] },
      { canonical: "Triple S", aliases: ["triple s", "triple s sneakers", "triple-s"] },
      { canonical: "Speed", aliases: ["speed", "speed sneakers", "speed 2.0"] },
      { canonical: "Defender", aliases: ["defender", "defender sneakers"] }
    ])
  },
  {
    canonical: "Loewe",
    aliases: ["loewe"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "Puzzle", aliases: ["puzzle", "puzzle bag"] },
      { canonical: "Gate", aliases: ["gate", "gate bag"] },
      { canonical: "Hammock", aliases: ["hammock", "hammock bag"] },
      { canonical: "Flamenco", aliases: ["flamenco", "flamenco bag"] },
      { canonical: "Basket", aliases: ["basket", "basket bag"] },
      { canonical: "Cubi", aliases: ["cubi"] },
      { canonical: "Anagram", aliases: ["anagram", "anagram bag"] }
    ])
  },
  {
    canonical: "Givenchy",
    aliases: ["givenchy"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "Antigona", aliases: ["antigona", "antigona bag"] },
      { canonical: "GV3", aliases: ["gv3", "gv3 bag"] },
      { canonical: "Voyou", aliases: ["voyou", "voyou bag"] },
      { canonical: "Pandora", aliases: ["pandora", "pandora box"] },
      { canonical: "Mystic", aliases: ["mystic", "mystic bag"] },
      { canonical: "Cut-Out", aliases: ["cut out", "cut-out"] }
    ])
  },
  {
    canonical: "Valentino",
    aliases: ["valentino", "valentino garavani"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "Rockstud", aliases: ["rockstud", "rockstud bag", "rockstud heels"] },
      { canonical: "Roman Stud", aliases: ["roman stud", "roman stud bag"] },
      { canonical: "Locò", aliases: ["loco", "locò", "locò bag"] },
      { canonical: "One Stud", aliases: ["one stud", "one stud bag"] },
      { canonical: "Garavani", aliases: ["garavani", "garavani rockstud"] },
      { canonical: "VLogo", aliases: ["vlogo", "v logo", "v logo signature"] }
    ])
  },
  {
    canonical: "Burberry",
    aliases: ["burberry", "burb"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "TB", aliases: ["tb", "tb bag", "thomas burberry"] },
      { canonical: "Banner", aliases: ["banner", "banner bag"] },
      { canonical: "Lola", aliases: ["lola", "lola bag"] },
      { canonical: "Pocket", aliases: ["pocket", "pocket bag"] },
      { canonical: "Check", aliases: ["check", "nova check", "burberry check"] }
    ])
  },
  {
    canonical: "Versace",
    aliases: ["versace"],
    categories: ["bag", "shoes", "apparel", "accessory", "jewelry"],
    models: models([
      { canonical: "La Medusa", aliases: ["la medusa", "medusa", "medusa bag"] },
      { canonical: "Palazzo", aliases: ["palazzo", "palazzo bag"] },
      { canonical: "Greca", aliases: ["greca", "greca bag"] },
      { canonical: "Chain Reaction", aliases: ["chain reaction", "chain reaction sneakers"] }
    ])
  },
  // —— Watches ——
  {
    canonical: "Rolex",
    aliases: ["rolex"],
    categories: ["watch"],
    models: models([
      { canonical: "Submariner", aliases: ["submariner", "sub", "submariner date"] },
      { canonical: "Daytona", aliases: ["daytona", "cosmograph daytona"] },
      { canonical: "Datejust", aliases: ["datejust", "date just"] },
      { canonical: "Day-Date", aliases: ["day-date", "day date", "president"] },
      { canonical: "GMT-Master II", aliases: ["gmt master ii", "gmt master 2", "gmt ii", "batman", "pepsi"] },
      { canonical: "Explorer", aliases: ["explorer", "explorer i", "explorer ii"] },
      { canonical: "Yacht-Master", aliases: ["yacht master", "yacht-master", "yachtmaster"] },
      { canonical: "Oyster Perpetual", aliases: ["oyster perpetual", "op"] },
      { canonical: "Sky-Dweller", aliases: ["sky dweller", "sky-dweller"] },
      { canonical: "Milgauss", aliases: ["milgauss"] },
      { canonical: "Air-King", aliases: ["air king", "air-king"] }
    ])
  },
  {
    canonical: "Omega",
    aliases: ["omega"],
    categories: ["watch"],
    models: models([
      { canonical: "Speedmaster", aliases: ["speedmaster", "speedmaster professional", "moonwatch"] },
      { canonical: "Seamaster", aliases: ["seamaster", "seamaster 300", "seamaster diver"] },
      { canonical: "Constellation", aliases: ["constellation", "constellation globemaster"] },
      { canonical: "Aqua Terra", aliases: ["aqua terra", "aquaterra"] },
      { canonical: "De Ville", aliases: ["de ville", "deville"] },
      { canonical: "Planet Ocean", aliases: ["planet ocean", "planet ocean 600m"] }
    ])
  },
  {
    canonical: "Patek Philippe",
    aliases: ["patek philippe", "patek", "pp"],
    categories: ["watch"],
    models: models([
      { canonical: "Nautilus", aliases: ["nautilus", "nautilus 5711", "5711"] },
      { canonical: "Aquanaut", aliases: ["aquanaut", "aquanaut 5167"] },
      { canonical: "Calatrava", aliases: ["calatrava"] },
      { canonical: "Perpetual Calendar", aliases: ["perpetual calendar", "perpetual"] },
      { canonical: "Complications", aliases: ["complications"] }
    ])
  },
  {
    canonical: "Audemars Piguet",
    aliases: ["audemars piguet", "ap", "audemars"],
    categories: ["watch"],
    models: models([
      { canonical: "Royal Oak", aliases: ["royal oak", "royal oak offshore", "ro", "15400", "15500"] },
      { canonical: "Royal Oak Offshore", aliases: ["royal oak offshore", "roo", "offshore"] },
      { canonical: "Royal Oak Concept", aliases: ["royal oak concept", "concept"] },
      { canonical: "Millenary", aliases: ["millenary"] },
      { canonical: "Code 11.59", aliases: ["code 11.59", "code 1159"] }
    ])
  },
  {
    canonical: "Cartier",
    aliases: ["cartier"],
    categories: ["watch", "jewelry", "accessory"],
    models: models([
      { canonical: "Tank", aliases: ["tank", "tank francaise", "tank louis", "tank americaine"] },
      { canonical: "Santos", aliases: ["santos", "santos de cartier", "santos dumont"] },
      { canonical: "Ballon Bleu", aliases: ["ballon bleu", "ballon bleu de cartier"] },
      { canonical: "Panthère", aliases: ["panthere", "panthère", "panthere de cartier"] },
      { canonical: "Love", aliases: ["love", "love bracelet", "love ring"] },
      { canonical: "Juste un Clou", aliases: ["juste un clou", "juc", "nail bracelet"] },
      { canonical: "Trinity", aliases: ["trinity", "trinity ring"] },
      { canonical: "Clash", aliases: ["clash", "clash de cartier"] }
    ])
  },
  {
    canonical: "IWC",
    aliases: ["iwc", "iwc schaffhausen"],
    categories: ["watch"],
    models: models([
      { canonical: "Portugieser", aliases: ["portugieser", "portuguese"] },
      { canonical: "Pilot", aliases: ["pilot", "big pilot", "pilot chronograph"] },
      { canonical: "Portofino", aliases: ["portofino"] },
      { canonical: "Ingenieur", aliases: ["ingenieur", "ingenieur automatic"] }
    ])
  },
  {
    canonical: "Tudor",
    aliases: ["tudor"],
    categories: ["watch"],
    models: models([
      { canonical: "Black Bay", aliases: ["black bay", "black bay 58", "black bay 41"] },
      { canonical: "Pelagos", aliases: ["pelagos"] },
      { canonical: "Royal", aliases: ["royal", "tudor royal"] },
      { canonical: "GMT", aliases: ["gmt", "tudor gmt"] }
    ])
  },
  {
    canonical: "Longines",
    aliases: ["longines"],
    categories: ["watch"],
    models: models([
      { canonical: "HydroConquest", aliases: ["hydroconquest", "hydro conquest"] },
      { canonical: "Master", aliases: ["master", "master collection"] },
      { canonical: "Spirit", aliases: ["spirit"] },
      { canonical: "Conquest", aliases: ["conquest"] }
    ])
  },
  // —— Contemporary / accessible luxury ——
  {
    canonical: "Coach",
    aliases: ["coach"],
    categories: ["bag", "shoes", "apparel", "accessory"],
    models: models([
      { canonical: "Tabby", aliases: ["tabby", "tabby bag", "tabby 26"] },
      { canonical: "Willow", aliases: ["willow", "willow bag"] },
      { canonical: "Bandit", aliases: ["bandit"] },
      { canonical: "Rogue", aliases: ["rogue", "rogue bag"] },
      { canonical: "Turnlock", aliases: ["turnlock", "turnlock bag"] }
    ])
  },
  {
    canonical: "Tory Burch",
    aliases: ["tory burch", "tory"],
    categories: ["bag", "shoes", "apparel", "accessory"],
    models: models([
      { canonical: "Kira", aliases: ["kira", "kira bag"] },
      { canonical: "Fleming", aliases: ["fleming", "fleming bag"] },
      { canonical: "Miller", aliases: ["miller", "miller sandals"] },
      { canonical: "Minerva", aliases: ["minerva"] },
      { canonical: "Lee Radziwill", aliases: ["lee radziwill", "lee radziwill bag"] }
    ])
  },
  {
    canonical: "Longchamp",
    aliases: ["longchamp"],
    categories: ["bag", "accessory"],
    models: models([
      { canonical: "Le Pliage", aliases: ["le pliage", "pliage", "le pliage tote"] },
      { canonical: "Le Pliage Neo", aliases: ["le pliage neo", "pliage neo"] },
      { canonical: "Boxford", aliases: ["boxford"] },
      { canonical: "Roseau", aliases: ["roseau", "roseau bag"] }
    ])
  },
  {
    canonical: "MCM",
    aliases: ["mcm"],
    categories: ["bag", "accessory"],
    models: models([
      { canonical: "Stark", aliases: ["stark", "stark backpack"] },
      { canonical: "Milla", aliases: ["milla", "milla bag"] },
      { canonical: "Visetos", aliases: ["visetos", "visetos tote"] }
    ])
  },
  // More brands without full model lists (extractor can still match brand)
  {
    canonical: "Christian Louboutin",
    aliases: ["christian louboutin", "louboutin", "louboutins", "cl"],
    categories: ["shoes", "bag", "accessory"],
    models: models([
      { canonical: "Pigalle", aliases: ["pigalle", "pigalle follies"] },
      { canonical: "So Kate", aliases: ["so kate", "so kate heels"] },
      { canonical: "Simple", aliases: ["simple", "simple pump"] },
      { canonical: "Spike", aliases: ["spike", "spike bag"] },
      { canonical: "Loubishark", aliases: ["loubishark", "loubi shark"] }
    ])
  },
  {
    canonical: "Salvatore Ferragamo",
    aliases: ["salvatore ferragamo", "ferragamo"],
    categories: ["bag", "shoes", "apparel", "accessory"],
    models: models([
      { canonical: "Gancini", aliases: ["gancini", "gancini bag"] },
      { canonical: "Vara", aliases: ["vara", "vara bow"] },
      { canonical: "Varina", aliases: ["varina", "varina flats"] }
    ])
  },
  {
    canonical: "Bvlgari",
    aliases: ["bvlgari", "bulgari"],
    categories: ["bag", "jewelry", "watch", "accessory"],
    models: models([
      { canonical: "Serpenti", aliases: ["serpenti", "serpenti bag", "serpenti bracelet"] },
      { canonical: "Divas' Dream", aliases: ["divas dream", "divas dream bag"] },
      { canonical: "Octo", aliases: ["octo", "octo finissimo"] }
    ])
  },
  {
    canonical: "Chloé",
    aliases: ["chloe", "chloé"],
    categories: ["bag", "shoes", "apparel", "accessory"],
    models: models([
      { canonical: "Drew", aliases: ["drew", "drew bag"] },
      { canonical: "Marcie", aliases: ["marcie", "marcie bag"] },
      { canonical: "Nile", aliases: ["nile", "nile bag"] },
      { canonical: "Tess", aliases: ["tess", "tess bag"] },
      { canonical: "Woody", aliases: ["woody", "woody tote"] }
    ])
  },
  {
    canonical: "Bally",
    aliases: ["bally"],
    categories: ["bag", "shoes", "apparel", "accessory"],
    models: models([
      { canonical: "Scribe", aliases: ["scribe", "scribe loafers"] },
      { canonical: "Janelle", aliases: ["janelle", "janelle bag"] }
    ])
  },
  {
    canonical: "Ferragamo",
    aliases: ["ferragamo"],
    categories: ["bag", "shoes", "apparel", "accessory"],
    models: models([
      { canonical: "Gancini", aliases: ["gancini"] },
      { canonical: "Vara", aliases: ["vara", "varina"] }
    ])
  }
];
