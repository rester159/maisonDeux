/**
 * @file taxonomy.js
 * @description Normalization dictionaries that map raw values from any resale
 * platform to canonical values. All raw strings are lowercased before lookup.
 *
 * Includes an unknown-term capture system that logs unrecognized words to
 * chrome.storage.local for periodic review and dictionary expansion.
 *
 * Exports:
 *  - Dictionary constants (COLORS, COLOR_FAMILIES, MATERIALS, etc.)
 *  - normalize(category, rawValue) — single-value lookup
 *  - normalizeAll(rawText) — scan text and extract all identifiable attributes
 *  - unknowns — capture system for unrecognized terms
 */

// ---------------------------------------------------------------------------
// 1. COLORS
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} Raw alias → canonical color name. */
export const COLORS = buildMap({
  'Black':      ['black', 'noir', 'nero', 'schwarz', 'onyx', 'jet', 'ebony', 'ink', 'raven',
                  'midnight', 'sable', 'carbon', 'licorice', 'obsidian', 'pitch'],
  'White':      ['white', 'blanc', 'bianco', 'cream', 'ivory', 'ecru', 'off-white', 'snow',
                  'pearl', 'eggshell', 'bone', 'alabaster', 'chalk', 'opal', 'winter white',
                  'milk', 'coconut', 'linen white', 'porcelain'],
  'Beige':      ['beige', 'tan', 'sand', 'nude', 'buff', 'camel', 'oatmeal', 'khaki', 'fawn',
                  'wheat', 'biscuit', 'parchment', 'latte', 'chai', 'taupe', 'mushroom',
                  'stone', 'natural', 'dune', 'sahara', 'desert', 'flax', 'straw'],
  'Brown':      ['brown', 'marron', 'chocolate', 'cognac', 'mocha', 'espresso', 'tobacco',
                  'chestnut', 'walnut', 'mahogany', 'cinnamon', 'toffee', 'cocoa', 'umber',
                  'sienna', 'hazelnut', 'pecan', 'maple', 'hickory', 'sepia', 'brunette',
                  'saddle', 'cafe', 'caramel', 'gingerbread', 'cedar', 'copper brown',
                  'cuoio', 'marrone', 'brun', 'braun', 'terre', 'noisette', 'gold brown',
                  'dark brown', 'light brown', 'medium brown'],
  'Red':        ['red', 'rouge', 'rosso', 'burgundy', 'crimson', 'wine', 'oxblood', 'cherry',
                  'scarlet', 'vermillion', 'garnet', 'ruby', 'cardinal', 'carmine', 'merlot',
                  'bordeaux', 'maroon', 'claret', 'cranberry', 'brick', 'rust red', 'blood red',
                  'fire red', 'poppy', 'hibiscus', 'pomegranate', 'currant', 'rosewood',
                  'rojo', 'rot', 'cerise', 'cinnabar', 'ferrari red', 'lipstick red'],
  'Pink':       ['pink', 'rose', 'blush', 'coral', 'salmon', 'fuchsia', 'magenta',
                  'bubblegum', 'carnation', 'flamingo', 'hot pink', 'baby pink', 'dusty pink',
                  'dusty rose', 'mauve pink', 'pastel pink', 'peony', 'petal', 'raspberry',
                  'rose pink', 'shell pink', 'watermelon', 'ballet pink', 'millennial pink',
                  'sakura', 'rosa', 'powder pink', 'candy pink', 'neon pink'],
  'Blue':       ['blue', 'bleu', 'navy', 'cobalt', 'royal', 'denim', 'sky', 'teal',
                  'azure', 'cerulean', 'cornflower', 'indigo', 'midnight blue', 'ocean',
                  'pacific', 'periwinkle', 'sapphire', 'steel blue', 'turquoise', 'aqua',
                  'aegean', 'baby blue', 'cadet blue', 'french blue', 'ice blue', 'powder blue',
                  'prussian blue', 'slate blue', 'ultramarine', 'celeste', 'blu', 'azzurro',
                  'marine', 'dark blue', 'light blue', 'electric blue', 'royal blue',
                  'peacock', 'petrol', 'petrole'],
  'Green':      ['green', 'vert', 'olive', 'khaki', 'emerald', 'sage', 'forest', 'mint',
                  'jade', 'hunter', 'army', 'lime', 'chartreuse', 'pistachio', 'avocado',
                  'celadon', 'fern', 'moss', 'pine', 'seafoam', 'spruce', 'teal green',
                  'verde', 'grün', 'kelly green', 'bottle green', 'racing green', 'ivy',
                  'juniper', 'malachite', 'pea green', 'shamrock', 'spearmint', 'viridian',
                  'dark green', 'light green', 'neon green', 'military green'],
  'Grey':       ['grey', 'gray', 'gris', 'charcoal', 'slate', 'graphite', 'etain',
                  'ash', 'concrete', 'fog', 'gunmetal', 'iron', 'lead', 'pewter grey',
                  'smoke', 'steel', 'stone grey', 'thundercloud', 'titanium', 'wolf',
                  'grigio', 'grau', 'silver grey', 'dark grey', 'light grey', 'heather grey',
                  'medium grey', 'dove grey', 'cement', 'flannel', 'mercury', 'nickel',
                  'anthracite', 'battleship'],
  'Gold':       ['gold', 'dore', 'champagne', 'golden', 'gilt', 'brass', 'aztec gold',
                  'honey gold', 'old gold', 'antique gold', 'oro', 'doré', 'metallic gold'],
  'Silver':     ['silver', 'argent', 'pewter', 'chrome', 'platinum silver', 'metallic silver',
                  'quicksilver', 'sterling', 'argento', 'silber'],
  'Orange':     ['orange', 'tangerine', 'rust', 'terracotta', 'amber', 'apricot', 'burnt orange',
                  'copper', 'marigold', 'peach', 'persimmon', 'pumpkin', 'papaya', 'mango',
                  'carrot', 'clementine', 'tiger', 'arancione', 'naranja', 'mandarin',
                  'nectarine', 'cantaloupe', 'fire', 'sienna orange'],
  'Yellow':     ['yellow', 'lemon', 'mustard', 'canary', 'saffron', 'buttercup', 'dandelion',
                  'goldenrod', 'maize', 'sunflower', 'banana', 'flax yellow', 'honey',
                  'primrose', 'turmeric', 'giallo', 'jaune', 'gelb', 'acid yellow',
                  'neon yellow', 'pastel yellow', 'butter'],
  'Purple':     ['purple', 'violet', 'plum', 'lavender', 'amethyst', 'mauve', 'aubergine',
                  'eggplant', 'grape', 'iris', 'lilac', 'mulberry', 'orchid', 'periwinkle purple',
                  'prune', 'raisin', 'thistle', 'wisteria', 'heliotrope', 'viola', 'pourpre',
                  'lila', 'byzantium', 'royal purple', 'deep purple', 'dark purple'],
  'Multicolor': ['multicolor', 'multi', 'rainbow', 'tie-dye', 'tie dye', 'colorblock',
                  'color block', 'print', 'floral', 'patterned', 'kaleidoscope', 'mosaic',
                  'multicolore', 'mehrfarbig'],
});

// ---------------------------------------------------------------------------
// 2. COLOR_FAMILIES
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} Canonical color → family. */
export const COLOR_FAMILIES = {
  'Black':      'Neutral',
  'White':      'Neutral',
  'Grey':       'Neutral',
  'Beige':      'Neutral',
  'Brown':      'Warm',
  'Red':        'Warm',
  'Pink':       'Warm',
  'Orange':     'Warm',
  'Yellow':     'Warm',
  'Blue':       'Cool',
  'Green':      'Cool',
  'Purple':     'Cool',
  'Gold':       'Metallic',
  'Silver':     'Metallic',
  'Multicolor': 'Neutral',
};

// ---------------------------------------------------------------------------
// 3. MATERIALS
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} Raw alias → canonical material. */
export const MATERIALS = buildMap({
  'Lambskin':         ['lambskin', 'lamb', 'agneau', 'lamb leather', 'nappa', 'nappa leather',
                        'soft lambskin', 'pearlized lambskin', 'iridescent lambskin',
                        'matelasse lambskin', 'quilted lambskin'],
  'Caviar Leather':   ['caviar', 'caviar leather', 'grained calfskin', 'grained leather',
                        'pebbled caviar', 'petit caviar', 'grand caviar'],
  'Calfskin':         ['calfskin', 'calf', 'veau', 'smooth leather', 'box leather',
                        'box calf', 'swift', 'barenia', 'togo', 'clemence', 'epsom',
                        'evercolor', 'novillo', 'sikkim', 'taurillon', 'smooth calfskin',
                        'grained calf', 'drummed calfskin', 'pebbled leather',
                        'pebbled calfskin', 'tumbled leather', 'tumbled calfskin',
                        'textured leather', 'textured calfskin', 'buffalo', 'vachetta'],
  'Goatskin':         ['goatskin', 'chevre', 'chèvre', 'mysore', 'chevre mysore',
                        'goat leather', 'chevron goatskin'],
  'Deerskin':         ['deerskin', 'deer', 'cervo', 'deer leather', 'nappa deer'],
  'Patent Leather':   ['patent', 'patent leather', 'vernis', 'lacquered', 'glossy leather',
                        'mirror leather', 'spazzolato', 'polished leather', 'glazed leather',
                        'lacquer'],
  'Suede':            ['suede', 'nubuck', 'daim', 'velour', 'chamois', 'reversed leather',
                        'suede leather', 'brushed suede', 'soft suede'],
  'Exotic':           ['python', 'crocodile', 'alligator', 'ostrich', 'lizard', 'stingray',
                        'snakeskin', 'cobra', 'caiman', 'crocodylus', 'niloticus',
                        'porosus', 'exotic leather', 'shagreen', 'galuchat', 'eel',
                        'karung', 'watersnake', 'anaconda', 'iguana', 'monitor lizard',
                        'tejus', 'pecary', 'peccary'],
  'Canvas':           ['canvas', 'toile', 'cotton canvas', 'cotton', 'linen', 'hemp',
                        'organic cotton', 'woven', 'woven fabric'],
  'Coated Canvas':    ['coated canvas', 'monogram canvas', 'damier', 'gg supreme',
                        'coated cotton', 'pvc coated', 'macadam', 'ff logo canvas',
                        'oblique canvas', 'tb monogram', 'logo coated canvas',
                        'signature canvas', 'logo canvas', 'mono canvas',
                        'damier ebene', 'damier azur', 'damier graphite'],
  'Tweed':            ['tweed', 'boucle', 'bouclé', 'wool tweed', 'fantasy tweed',
                        'lesage tweed', 'metallic tweed'],
  'Denim':            ['denim', 'jean', 'chambray', 'raw denim', 'washed denim',
                        'stonewash', 'selvedge', 'distressed denim'],
  'Silk':             ['silk', 'soie', 'satin', 'charmeuse', 'chiffon', 'organza',
                        'crepe de chine', 'habotai', 'dupioni', 'jacquard silk',
                        'silk satin', 'silk twill', 'taffeta', 'tulle'],
  'Wool':             ['wool', 'laine', 'cashmere', 'cachemire', 'kashmir', 'merino',
                        'angora', 'mohair', 'alpaca', 'virgin wool', 'felt', 'flannel',
                        'worsted', 'melton', 'boiled wool'],
  'Leather':          ['leather', 'cuir', 'pelle', 'leder', 'genuine leather',
                        'full grain leather', 'top grain', 'bonded leather'],
  'Fur':              ['fur', 'mink', 'fox', 'rabbit', 'chinchilla', 'sable fur',
                        'shearling', 'sheepskin', 'mouton', 'faux fur', 'teddy',
                        'astrakhan', 'broadtail', 'persian lamb'],
  'Raffia':           ['raffia', 'straw', 'wicker', 'rattan', 'basket weave',
                        'palm leaf', 'jute', 'seagrass', 'crochet'],
  'Nylon':            ['nylon', 'tessuto', 'technical nylon', 'recycled nylon',
                        're-nylon', 'econyl', 'ripstop', 'ballistic nylon',
                        'parachute nylon'],
  'Polyester':        ['polyester', 'poly', 'microfiber', 'technical fabric',
                        'performance fabric', 'gore-tex', 'neoprene'],
  'Rubber':           ['rubber', 'pvc', 'vinyl', 'jelly', 'silicone', 'latex',
                        'thermoplastic', 'resin'],
  'Ceramic':          ['ceramic', 'porcelain', 'enamel', 'lacquered ceramic'],
  'Carbon Fiber':     ['carbon fiber', 'carbon fibre', 'forged carbon'],
  'Wood':             ['wood', 'bamboo', 'ebony wood', 'rosewood', 'walnut wood',
                        'olive wood', 'teak'],
  'Titanium':         ['titanium', 'grade 5 titanium', 'ti'],
  '18K Yellow Gold':  ['18k gold', '18k yellow gold', '18kt yg', '750 gold',
                        '18 karat gold', '18ct gold', '750', 'or jaune'],
  '18K White Gold':   ['18k white gold', '18kt wg', '18ct white gold', 'or blanc',
                        'white gold 750'],
  '18K Rose Gold':    ['18k rose gold', '18kt rg', 'pink gold', 'or rose',
                        '18ct rose gold', 'rose gold 750', 'red gold'],
  '14K Gold':         ['14k gold', '14kt gold', '585 gold', '14 karat',
                        '14k yellow gold', '14k white gold', '14k rose gold'],
  '10K Gold':         ['10k gold', '10kt gold', '417 gold', '10 karat'],
  'Platinum':         ['platinum', 'pt950', 'pt900', '950 platinum', 'platine'],
  'Sterling Silver':  ['sterling silver', '925 silver', 'ag925', '.925',
                        'argent 925', 'silver 925', 'solid silver'],
  'Stainless Steel':  ['stainless steel', 'ss', 'acier', 'acciaio', 'stahl',
                        '316l', 'surgical steel', 'inox'],
  'Vermeil':          ['vermeil', 'gold vermeil', 'silver gilt'],
  'Gold Plated':      ['gold plated', 'gold-plated', 'plaque or', 'gold filled',
                        'gf', 'gold tone', 'gilt', 'gold overlay'],
  'Silver Plated':    ['silver plated', 'silver-plated', 'plaque argent',
                        'silver tone', 'silver overlay', 'silverplate'],
  'Costume':          ['costume', 'fashion jewelry', 'bijoux fantaisie',
                        'base metal', 'alloy', 'brass', 'zinc alloy'],
});

// ---------------------------------------------------------------------------
// 4. SIZES
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} Raw alias → canonical size. */
export const SIZES = buildMap({
  'Nano':        ['nano'],
  'Micro':       ['micro'],
  'Mini':        ['mini'],
  'Small':       ['small', 's', 'pm', 'petit'],
  'Medium':      ['medium', 'm', 'mm'],
  'Large':       ['large', 'l', 'gm', 'grand'],
  'Jumbo':       ['jumbo'],
  'Maxi':        ['maxi'],
  'Extra Large': ['xl'],
  'XXL':         ['xxl', '2xl'],
  'One Size':    ['one size', 'os', 'one sz', 'free size', 'adjustable'],
});

// ---------------------------------------------------------------------------
// 5. SIZE_CHARTS — brand-specific cm → size
// ---------------------------------------------------------------------------

/**
 * @type {Record<string, Record<string, string>>}
 * Brand → { dimension → canonical size }.
 */
export const SIZE_CHARTS = {
  'Chanel': {
    '17':  'Micro',  '17cm': 'Micro',
    '20':  'Mini',   '20cm': 'Mini',
    '23':  'Small',  '23cm': 'Small',
    '25':  'Medium', '25cm': 'Medium',
    '30':  'Jumbo',  '30cm': 'Jumbo',
    '33':  'Maxi',   '33cm': 'Maxi',
  },
  'Louis Vuitton': {
    '25': 'Small',  '30': 'Medium',  '35': 'Large',  '40': 'Extra Large',
  },
  'Hermes': {
    '25': 'Small', '28': 'Small/Medium', '30': 'Medium',
    '32': 'Medium', '35': 'Large', '40': 'Jumbo',
  },
  'Celine': {
    'nano':  'Nano',  'micro': 'Micro',  'mini':  'Mini',
    'small': 'Small', 'medium': 'Medium',
  },
  'Dior': {
    'mini':   'Mini',  'small': 'Small',  'medium': 'Medium',
    'large':  'Large',
  },
  'Fendi': {
    'mini':  'Mini', 'small': 'Small', 'medium': 'Medium',
    'large': 'Large',
  },
};

// ---------------------------------------------------------------------------
// 6. CONDITIONS
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} Raw alias → canonical condition. */
export const CONDITIONS = buildMap({
  'New':       ['new', 'nwt', 'new with tags', 'brand new', 'bnwt', 'bnib',
                 'brand new in box', 'deadstock', 'ds', 'unworn', 'unused',
                 'sealed', 'new in box', 'new in bag', 'never worn', 'never used'],
  'Excellent': ['nwot', 'new without tags', 'like new', 'mint', 'pristine',
                 'excellent', 'euc', 'excellent used condition', 'flawless',
                 'impeccable', 'near perfect', 'as new', 'worn once',
                 'hardly worn', 'barely used', 'immaculate'],
  'Very Good': ['very good', 'great', 'vguc', 'very good used condition',
                 'very good condition', 'minor wear', 'gentle wear',
                 'lightly worn', 'well maintained', 'well cared for'],
  'Good':      ['good', 'gently used', 'pre-owned', 'guc', 'good used condition',
                 'good condition', 'preowned', 'pre owned', 'previously owned',
                 'normal wear', 'some wear', 'everyday wear'],
  'Fair':      ['fair', 'well worn', 'used', 'heavily used', 'worn',
                 'shows wear', 'visible wear', 'signs of wear', 'loved',
                 'well loved', 'distressed', 'vintage wear', 'project',
                 'fixer upper', 'for repair', 'damaged', 'as is'],
});

// ---------------------------------------------------------------------------
// 7. HARDWARE
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} Raw alias → canonical hardware finish. */
export const HARDWARE = buildMap({
  'Gold':         ['gold', 'ghw', 'gold hardware', 'light gold', 'lghw',
                    'gold tone', 'gold plated hardware', 'yellow gold hardware',
                    'brushed gold', 'matte gold', 'polished gold', 'champagne gold',
                    'aged gold', 'antique gold hardware', '24k hardware'],
  'Silver':       ['silver', 'shw', 'silver hardware', 'silver tone',
                    'polished silver', 'brushed silver', 'matte silver',
                    'chrome hardware', 'nickel', 'bright silver'],
  'Ruthenium':    ['ruthenium', 'rhw', 'ruthenium hardware', 'dark silver',
                    'gunmetal', 'gunmetal hardware', 'dark metal', 'anthracite hardware'],
  'Palladium':    ['palladium', 'phw', 'palladium hardware', 'palladium plated'],
  'Rose Gold':    ['rose gold', 'rghw', 'rose gold hardware', 'pink gold hardware',
                    'copper hardware', 'copper tone'],
  'Aged Gold':    ['aged gold hardware', 'distressed gold', 'vieilli',
                    'antiqued gold', 'burnished gold'],
  'Black':        ['black hardware', 'pvd', 'blacked out', 'so black',
                    'black metal', 'matte black hardware', 'noir hardware'],
  'Mixed Metal':  ['mixed hardware', 'two-tone', 'two tone', 'bi-metal',
                    'mixed metal', 'tri-color hardware'],
});

// ---------------------------------------------------------------------------
// 8. CATEGORIES
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} Raw alias → canonical category. */
export const CATEGORIES = buildMap({
  'Handbags':     ['bag', 'handbag', 'tote', 'clutch', 'purse', 'satchel', 'crossbody',
                    'flap', 'hobo', 'bucket', 'messenger', 'shoulder bag', 'top handle',
                    'backpack', 'pouch', 'duffle', 'duffel', 'weekender', 'travel bag',
                    'evening bag', 'baguette', 'wristlet', 'minaudiere', 'frame bag',
                    'doctor bag', 'bowling bag', 'saddle bag', 'camera bag', 'belt bag',
                    'fanny pack', 'drawstring bag', 'chain bag'],
  'Small Leather Goods': ['wallet', 'card holder', 'card case', 'coin purse',
                    'key holder', 'key pouch', 'passport holder', 'zip pouch',
                    'slg', 'small leather good', 'woc', 'wallet on chain',
                    'continental wallet', 'bifold', 'trifold', 'cardholder',
                    'money clip', 'checkbook', 'organizer', 'agenda', 'planner'],
  'Jewelry':      ['ring', 'necklace', 'bracelet', 'earring', 'pendant', 'brooch',
                    'cuff', 'anklet', 'choker', 'bangle', 'chain', 'charm',
                    'stud', 'hoop', 'drop earring', 'statement necklace', 'solitaire',
                    'tennis bracelet', 'signet ring', 'cocktail ring', 'engagement ring',
                    'wedding band', 'eternity band', 'lariat', 'collar necklace',
                    'ear cuff', 'body chain', 'hair pin', 'tiara'],
  'Watches':      ['watch', 'timepiece', 'chronograph', 'wristwatch', 'automatic watch',
                    'quartz watch', 'mechanical watch', 'diving watch', 'sport watch',
                    'dress watch', 'pilot watch', 'gmt', 'tourbillon', 'perpetual calendar',
                    'moonphase', 'skeleton watch'],
  'Shoes':        ['shoe', 'heel', 'boot', 'sneaker', 'loafer', 'sandal', 'pump', 'flat',
                    'espadrille', 'mule', 'slingback', 'oxford', 'derby', 'monk strap',
                    'platform', 'wedge', 'stiletto', 'kitten heel', 'ankle boot',
                    'knee boot', 'over the knee', 'chelsea boot', 'combat boot',
                    'ballet flat', 'driving shoe', 'slip on', 'slide', 'clog',
                    'mary jane', 'peep toe', 'pointed toe', 'thong sandal',
                    'gladiator', 'high top', 'low top', 'runner', 'trainer'],
  'Clothing':     ['dress', 'jacket', 'coat', 'blazer', 'skirt', 'pants', 'top', 'shirt',
                    'sweater', 'blouse', 'jumpsuit', 'romper', 'shorts', 'jeans', 'suit',
                    'cardigan', 'hoodie', 'sweatshirt', 'vest', 'cape', 'poncho', 'kaftan',
                    'kimono', 'trench', 'parka', 'bomber', 'leather jacket', 'denim jacket',
                    'crop top', 'bodysuit', 'camisole', 'tank top', 'polo', 'henley',
                    'turtleneck', 'tunic', 'maxi dress', 'midi dress', 'mini dress',
                    'cocktail dress', 'gown', 'evening dress', 'wrap dress', 'shirt dress',
                    'leggings', 'culottes', 'palazzo pants', 'cargo pants', 'chinos',
                    'trousers', 'overalls', 'dungarees', 'swimsuit', 'bikini', 'lingerie'],
  'Accessories':  ['scarf', 'belt', 'sunglasses', 'keychain', 'hat', 'gloves', 'tie',
                    'card holder', 'hair accessory', 'headband', 'bandeau', 'beanie',
                    'cap', 'beret', 'bucket hat', 'visor', 'turban', 'fedora',
                    'fascinator', 'bow tie', 'pocket square', 'cufflinks', 'suspenders',
                    'umbrella', 'phone case', 'laptop case', 'tablet case', 'tech case',
                    'luggage tag', 'trinket tray', 'home decor', 'blanket', 'pillow',
                    'candle', 'notebook', 'pen', 'water bottle', 'mug',
                    'glasses', 'optical', 'reading glasses', 'eyeglasses', 'frames'],
});

// ---------------------------------------------------------------------------
// 9. BRAND_ALIASES
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} Abbreviation/misspelling → canonical brand. */
export const BRAND_ALIASES = {
  // French houses
  'lv':                    'Louis Vuitton',
  'louis v':               'Louis Vuitton',
  'louis vitton':          'Louis Vuitton',
  'louis vuton':           'Louis Vuitton',
  'vuitton':               'Louis Vuitton',
  'chanel':                'Chanel',
  'coco chanel':           'Chanel',
  'dior':                  'Dior',
  'christian dior':        'Dior',
  'cd':                    'Dior',
  'lady dior':             'Dior',
  'ysl':                   'Saint Laurent',
  'saint laurent paris':   'Saint Laurent',
  'slp':                   'Saint Laurent',
  'yves saint laurent':    'Saint Laurent',
  'celine':                'Celine',
  'céline':                'Celine',
  'old celine':            'Celine',
  'old céline':            'Celine',
  'hermes':                'Hermes',
  'hermès':                'Hermes',
  'givenchy':              'Givenchy',
  'goyard':                'Goyard',
  'longchamp':             'Longchamp',
  'moynat':                'Moynat',
  'berluti':               'Berluti',
  'balmain':               'Balmain',
  'chloe':                 'Chloe',
  'chloé':                 'Chloe',
  'isabel marant':         'Isabel Marant',
  'jacquemus':             'Jacquemus',
  'alaia':                 'Alaia',
  'alaïa':                 'Alaia',

  // Italian houses
  'gucci':                 'Gucci',
  'gg':                    'Gucci',
  'prada':                 'Prada',
  'miu miu':               'Miu Miu',
  'fendi':                 'Fendi',
  'bottega':               'Bottega Veneta',
  'bv':                    'Bottega Veneta',
  'bottega veneta':        'Bottega Veneta',
  'valentino':             'Valentino',
  'valentino garavani':    'Valentino',
  'versace':               'Versace',
  'bulgari':               'Bulgari',
  'bvlgari':               'Bulgari',
  'ferragamo':             'Ferragamo',
  'salvatore ferragamo':   'Ferragamo',
  'dolce & gabbana':       'Dolce & Gabbana',
  'dolce and gabbana':     'Dolce & Gabbana',
  'd&g':                   'Dolce & Gabbana',
  'tod\'s':                'Tod\'s',
  'tods':                  'Tod\'s',
  'marni':                 'Marni',
  'max mara':              'Max Mara',
  'etro':                  'Etro',
  'loro piana':            'Loro Piana',
  'brunello cucinelli':    'Brunello Cucinelli',
  'missoni':               'Missoni',
  'emilio pucci':          'Emilio Pucci',
  'pucci':                 'Emilio Pucci',
  'moschino':              'Moschino',

  // Spanish
  'loewe':                 'Loewe',
  'balenciaga':            'Balenciaga',

  // British
  'burberry':              'Burberry',
  'alexander mcqueen':     'Alexander McQueen',
  'mcqueen':               'Alexander McQueen',
  'amq':                   'Alexander McQueen',
  'mulberry':              'Mulberry',
  'vivienne westwood':     'Vivienne Westwood',
  'stella mccartney':      'Stella McCartney',
  'jimmy choo':            'Jimmy Choo',
  'anya hindmarch':        'Anya Hindmarch',
  'aspinal':               'Aspinal of London',
  'dunhill':               'Dunhill',

  // American
  'coach':                 'Coach',
  'marc jacobs':           'Marc Jacobs',
  'mj':                    'Marc Jacobs',
  'michael kors':          'Michael Kors',
  'mk':                    'Michael Kors',
  'kate spade':            'Kate Spade',
  'ks':                    'Kate Spade',
  'tory burch':            'Tory Burch',
  'tb':                    'Tory Burch',
  'ralph lauren':          'Ralph Lauren',
  'rl':                    'Ralph Lauren',
  'tom ford':              'Tom Ford',
  'tf':                    'Tom Ford',
  'alexander wang':        'Alexander Wang',
  'aw':                    'Alexander Wang',
  'proenza schouler':      'Proenza Schouler',
  'the row':               'The Row',
  'mansur gavriel':        'Mansur Gavriel',

  // Japanese
  'cdg':                   'Comme des Garcons',
  'comme des garcons':     'Comme des Garcons',
  'comme des garçons':     'Comme des Garcons',
  'issey miyake':          'Issey Miyake',
  'yohji yamamoto':        'Yohji Yamamoto',
  'kenzo':                 'Kenzo',

  // Scandinavian
  'acne studios':          'Acne Studios',
  'acne':                  'Acne Studios',
  'toteme':                'Toteme',
  'totême':                'Toteme',
  'ganni':                 'Ganni',

  // Jewelry & watches
  'cartier':               'Cartier',
  'tiffany':               'Tiffany & Co.',
  'tiffany & co':          'Tiffany & Co.',
  'tiffany and co':        'Tiffany & Co.',
  'van cleef':             'Van Cleef & Arpels',
  'vca':                   'Van Cleef & Arpels',
  'van cleef & arpels':    'Van Cleef & Arpels',
  'david yurman':          'David Yurman',
  'dy':                    'David Yurman',
  'buccellati':            'Buccellati',
  'pomellato':             'Pomellato',
  'messika':               'Messika',
  'chopard':               'Chopard',
  'piaget':                'Piaget',
  'fred':                  'Fred',
  'rolex':                 'Rolex',
  'omega':                 'Omega',
  'ap':                    'Audemars Piguet',
  'audemars piguet':       'Audemars Piguet',
  'patek':                 'Patek Philippe',
  'patek philippe':        'Patek Philippe',
  'jlc':                   'Jaeger-LeCoultre',
  'jaeger-lecoultre':      'Jaeger-LeCoultre',
  'iwc':                   'IWC',
  'breitling':             'Breitling',
  'tag heuer':             'TAG Heuer',
  'tag':                   'TAG Heuer',
  'hublot':                'Hublot',
  'panerai':               'Panerai',
  'tudor':                 'Tudor',
  'grand seiko':           'Grand Seiko',
  'zenith':                'Zenith',
  'vacheron':              'Vacheron Constantin',
  'vacheron constantin':   'Vacheron Constantin',
  'a. lange':              'A. Lange & Sohne',
  'a lange':               'A. Lange & Sohne',
  'blancpain':             'Blancpain',
  'breguet':               'Breguet',
  'girard perregaux':      'Girard-Perregaux',

  // Sneakers / streetwear
  'off-white':             'Off-White',
  'off white':             'Off-White',
  'ow':                    'Off-White',
  'rick owens':            'Rick Owens',
  'ro':                    'Rick Owens',
  'fear of god':           'Fear of God',
  'fog':                   'Fear of God',
  'essentials':            'Fear of God Essentials',
  'chrome hearts':         'Chrome Hearts',
  'ch':                    'Chrome Hearts',
};

// ---------------------------------------------------------------------------
// 10. ABBREVIATIONS
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} Listing abbreviation → expanded form. */
export const ABBREVIATIONS = {
  'ghw':   'gold hardware',
  'shw':   'silver hardware',
  'rhw':   'ruthenium hardware',
  'rghw':  'rose gold hardware',
  'phw':   'palladium hardware',
  'lghw':  'light gold hardware',
  'nwt':   'new with tags',
  'nwot':  'new without tags',
  'bnwt':  'brand new with tags',
  'bnib':  'brand new in box',
  'nib':   'new in box',
  'nwb':   'new with box',
  'auth':  'authentic',
  'sz':    'size',
  'os':    'one size',
  'euc':   'excellent used condition',
  'vguc':  'very good used condition',
  'guc':   'good used condition',
  'htf':   'hard to find',
  'le':    'limited edition',
  'slg':   'small leather good',
  'woc':   'wallet on chain',
  'ds':    'deadstock',
  'og':    'original',
  'fs':    'for sale',
  'obo':   'or best offer',
  'pp':    'paypal',
  'iso':   'in search of',
  'wtb':   'want to buy',
  'wts':   'want to sell',
  'wtt':   'want to trade',
  'dj':    'datejust',
  'sub':   'submariner',
  'gmt':   'gmt master',
  'dd':    'day-date',
  'rg':    'rose gold',
  'yg':    'yellow gold',
  'wg':    'white gold',
  'ss':    'stainless steel',
};

// ---------------------------------------------------------------------------
// Master dictionary registry
// ---------------------------------------------------------------------------

/** @type {Record<string, Record<string, string>>} */
const DICTIONARIES = {
  color:     COLORS,
  material:  MATERIALS,
  size:      SIZES,
  hardware:  HARDWARE,
  condition: CONDITIONS,
  category:  CATEGORIES,
  brand:     BRAND_ALIASES,
};

// ---------------------------------------------------------------------------
// Unknown-term capture system
// ---------------------------------------------------------------------------

const UNKNOWNS_STORAGE_KEY = 'maisondeux_unknown_terms';

/**
 * Unknown-term capture system. Logs unrecognized terms to chrome.storage.local
 * so they can be periodically reviewed and added to the dictionaries.
 */
export const unknowns = {
  /**
   * Record an unrecognized term with context.
   * @param {string} dictName  - Which dictionary failed to match (e.g. "color").
   * @param {string} rawValue  - The unrecognized raw string.
   * @param {string} [source]  - Where it came from (e.g. URL, platform name).
   */
  async capture(dictName, rawValue, source = '') {
    if (!rawValue || rawValue.length < 2 || rawValue.length > 80) return;

    const key = rawValue.toLowerCase().trim();

    // Skip if it's already known.
    const dict = DICTIONARIES[dictName];
    if (dict && dict[key]) return;

    try {
      const result = await chrome.storage.local.get(UNKNOWNS_STORAGE_KEY);
      const store = result[UNKNOWNS_STORAGE_KEY] || {};

      // Group by dictionary name.
      if (!store[dictName]) store[dictName] = {};

      const existing = store[dictName][key];
      if (existing) {
        // Increment hit count.
        existing.count += 1;
        existing.lastSeen = Date.now();
      } else {
        store[dictName][key] = {
          raw: rawValue,
          count: 1,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          source,
        };
      }

      // Cap at 500 total unknown entries to avoid storage bloat.
      const totalEntries = Object.values(store).reduce(
        (sum, group) => sum + Object.keys(group).length, 0
      );
      if (totalEntries > 500) {
        _evictOldest(store);
      }

      await chrome.storage.local.set({ [UNKNOWNS_STORAGE_KEY]: store });
    } catch {
      // Storage unavailable (e.g. in tests) — silently skip.
    }
  },

  /**
   * Retrieve all captured unknown terms, optionally filtered by dictionary.
   * @param {string} [dictName] - Filter to a specific dictionary.
   * @returns {Promise<Record<string, Record<string, Object>>>}
   */
  async getAll(dictName) {
    try {
      const result = await chrome.storage.local.get(UNKNOWNS_STORAGE_KEY);
      const store = result[UNKNOWNS_STORAGE_KEY] || {};
      if (dictName) return { [dictName]: store[dictName] || {} };
      return store;
    } catch {
      return {};
    }
  },

  /**
   * Get unknown terms sorted by frequency (most seen first).
   * @param {string} [dictName] - Filter to a specific dictionary.
   * @param {number} [limit=50] - Max entries to return.
   * @returns {Promise<Array<{dict: string, key: string, count: number, raw: string, source: string}>>}
   */
  async getTopUnknowns(dictName, limit = 50) {
    const store = await this.getAll();
    const entries = [];

    for (const [dict, terms] of Object.entries(store)) {
      if (dictName && dict !== dictName) continue;
      for (const [key, info] of Object.entries(terms)) {
        entries.push({ dict, key, count: info.count, raw: info.raw, source: info.source });
      }
    }

    entries.sort((a, b) => b.count - a.count);
    return entries.slice(0, limit);
  },

  /**
   * Remove a term from the unknowns store (e.g. after adding it to a dictionary).
   * @param {string} dictName
   * @param {string} rawValue
   */
  async dismiss(dictName, rawValue) {
    try {
      const result = await chrome.storage.local.get(UNKNOWNS_STORAGE_KEY);
      const store = result[UNKNOWNS_STORAGE_KEY] || {};
      const key = rawValue.toLowerCase().trim();
      if (store[dictName]) {
        delete store[dictName][key];
      }
      await chrome.storage.local.set({ [UNKNOWNS_STORAGE_KEY]: store });
    } catch {
      // Silently skip.
    }
  },

  /**
   * Clear all captured unknowns.
   */
  async clear() {
    try {
      await chrome.storage.local.remove(UNKNOWNS_STORAGE_KEY);
    } catch {
      // Silently skip.
    }
  },
};

/**
 * Evict the least-seen entries to stay under the storage cap.
 * @param {Record<string, Record<string, Object>>} store
 */
function _evictOldest(store) {
  const all = [];
  for (const [dict, terms] of Object.entries(store)) {
    for (const [key, info] of Object.entries(terms)) {
      all.push({ dict, key, count: info.count, lastSeen: info.lastSeen });
    }
  }
  // Sort by count ascending, then oldest lastSeen first.
  all.sort((a, b) => a.count - b.count || a.lastSeen - b.lastSeen);

  // Remove bottom 20%.
  const removeCount = Math.ceil(all.length * 0.2);
  for (let i = 0; i < removeCount; i++) {
    const { dict, key } = all[i];
    delete store[dict][key];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a raw value in a named dictionary and return the canonical form.
 * If not found, captures the term as unknown for later review.
 * @param {string} dictName - One of: color, material, size, hardware,
 *                            condition, category, brand.
 * @param {string} rawValue - The raw string to normalize.
 * @param {string} [source] - Source context for unknown capture.
 * @returns {string|null} Canonical value, or null if not found.
 */
export function normalize(dictName, rawValue, source) {
  const dict = DICTIONARIES[dictName];
  if (!dict) return null;
  const key = (rawValue || '').toLowerCase().trim();
  const result = dict[key] ?? null;

  if (!result && key.length >= 2) {
    // Fire-and-forget capture — don't block the caller.
    unknowns.capture(dictName, rawValue, source).catch(() => {});
  }

  return result;
}

/**
 * Scan a free-text string and extract all identifiable attributes.
 * Longer aliases are checked first so "rose gold hardware" matches before
 * "rose" or "gold".
 *
 * Unmatched significant words are captured as potential unknowns.
 *
 * @param {string} rawText
 * @param {string} [source] - Source context for unknown capture.
 * @returns {{
 *   colors: string[],
 *   colorFamilies: string[],
 *   materials: string[],
 *   sizes: string[],
 *   hardware: string[],
 *   conditions: string[],
 *   categories: string[],
 *   brands: string[],
 *   unmatchedTokens: string[],
 * }}
 */
export function normalizeAll(rawText, source) {
  const text = (rawText || '').toLowerCase();

  const result = {
    colors: [],
    colorFamilies: [],
    materials: [],
    sizes: [],
    hardware: [],
    conditions: [],
    categories: [],
    brands: [],
    unmatchedTokens: [],
  };

  // Track which character positions have been matched.
  const matched = new Array(text.length).fill(false);

  /** Deduplicated scan helper that tracks matched positions. */
  function scan(dict, target, familyMap, familyTarget) {
    const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
    const seen = new Set();
    for (const alias of keys) {
      let idx = text.indexOf(alias);
      while (idx !== -1) {
        // Only match on word boundaries to avoid partial matches.
        const before = idx === 0 || /\W/.test(text[idx - 1]);
        const after = idx + alias.length >= text.length || /\W/.test(text[idx + alias.length]);

        if (before && after) {
          const canonical = dict[alias];
          if (!seen.has(canonical)) {
            seen.add(canonical);
            target.push(canonical);
            if (familyMap && familyTarget) {
              const family = familyMap[canonical];
              if (family && !familyTarget.includes(family)) {
                familyTarget.push(family);
              }
            }
          }
          // Mark positions as matched.
          for (let i = idx; i < idx + alias.length; i++) {
            matched[i] = true;
          }
        }
        idx = text.indexOf(alias, idx + 1);
      }
    }
  }

  scan(COLORS,        result.colors,     COLOR_FAMILIES, result.colorFamilies);
  scan(MATERIALS,     result.materials);
  scan(SIZES,         result.sizes);
  scan(HARDWARE,      result.hardware);
  scan(CONDITIONS,    result.conditions);
  scan(CATEGORIES,    result.categories);
  scan(BRAND_ALIASES, result.brands);

  // Collect unmatched tokens for unknown capture.
  const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'for', 'with', 'by',
    'to', 'at', 'is', 'it', 'no', 'not', 'this', 'that', 'from', 'very',
    'so', 'but', 'be', 'has', 'was', 'are', 'been', 'had', 'have', 'will',
    'size', 'color', 'condition', 'style', 'type', 'item', 'product',
    'authentic', 'guaranteed', 'retail', 'original', 'classic',
  ]);

  const words = text.split(/\W+/).filter((w) => w.length >= 3);
  for (const word of words) {
    const startIdx = text.indexOf(word);
    const isMatched = startIdx !== -1 &&
      Array.from({ length: word.length }, (_, i) => matched[startIdx + i]).some(Boolean);

    if (!isMatched && !STOP_WORDS.has(word) && !result.unmatchedTokens.includes(word)) {
      result.unmatchedTokens.push(word);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Invert a { canonical: [aliases] } object into a flat { alias: canonical } map.
 * @param {Record<string, string[]>} grouped
 * @returns {Record<string, string>}
 */
function buildMap(grouped) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const [canonical, aliases] of Object.entries(grouped)) {
    for (const alias of aliases) {
      map[alias.toLowerCase()] = canonical;
    }
  }
  return map;
}
