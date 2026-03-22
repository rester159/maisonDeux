### BUILD PROMPT 2: Taxonomy & Normalization Dictionaries

```
Create the MaisonDeux taxonomy module (taxonomy.js).

This module exports normalization dictionaries that map raw values from any resale platform to canonical values. Every raw string should be lowercased before lookup.

Implement these dictionaries:

1. COLORS — map every known color alias to a canonical English color name:
   black, noir, nero, schwarz, onyx, jet → "Black"
   white, blanc, bianco, cream, ivory, ecru, off-white → "White"
   beige, tan, sand, nude, buff, camel, oatmeal → "Beige"
   brown, marron, chocolate, cognac, mocha, espresso, tobacco → "Brown"
   red, rouge, rosso, burgundy, crimson, wine, oxblood, cherry → "Red"
   pink, rose, blush, coral, salmon, fuchsia, magenta → "Pink"
   blue, bleu, navy, cobalt, royal, denim, sky, teal → "Blue"
   green, vert, olive, khaki, emerald, sage, forest, mint → "Green"
   grey, gray, gris, charcoal, slate, graphite, etain → "Grey"
   gold, dore, champagne → "Gold"
   silver, argent, pewter → "Silver"
   orange, tangerine, rust, terracotta, amber → "Orange"
   yellow, lemon, mustard, canary, saffron → "Yellow"
   purple, violet, plum, lavender, amethyst, mauve, aubergine → "Purple"
   multicolor, multi → "Multicolor"

2. COLOR_FAMILIES — map canonical colors to families:
   Black/White/Grey/Beige → "Neutral"
   Brown/Red/Pink/Orange/Yellow → "Warm"
   Blue/Green/Purple → "Cool"
   Gold/Silver/Metallic → "Metallic"

3. MATERIALS — including all luxury-specific terms:
   lambskin, lamb, agneau → "Lambskin"
   caviar, caviar leather, grained calfskin → "Caviar Leather"
   calfskin, calf, veau, smooth leather, box leather → "Calfskin"
   patent, patent leather, vernis, lacquered → "Patent Leather"
   suede, nubuck, daim → "Suede"
   python, crocodile, alligator, ostrich, lizard, stingray → "Exotic"
   canvas, toile, cotton canvas → "Canvas"
   coated canvas, monogram canvas, damier, gg supreme → "Coated Canvas"
   tweed, boucle → "Tweed"
   denim, jean → "Denim"
   silk, soie, satin → "Silk"
   18k gold, 18k yellow gold, 18kt yg, 750 gold → "18K Yellow Gold"
   18k white gold, 18kt wg → "18K White Gold"
   18k rose gold, 18kt rg, pink gold → "18K Rose Gold"
   platinum, pt950 → "Platinum"
   sterling silver, 925 silver, ag925 → "Sterling Silver"
   stainless steel, ss → "Stainless Steel"

4. SIZES — general size labels:
   nano → "Nano", micro → "Micro", mini → "Mini"
   small, s, pm, petit → "Small"
   medium, m, mm → "Medium"
   large, l, gm, grand → "Large"
   jumbo → "Jumbo", maxi → "Maxi", xl → "Extra Large"

5. SIZE_CHARTS — brand-specific size mappings:
   Chanel bags: 17cm→Micro, 20cm→Mini, 23cm→Small, 25cm→Medium, 30cm→Jumbo, 33cm→Maxi
   Louis Vuitton: 25→Small, 30→Medium, 35→Large, 40→XL
   Hermes: 25→Small, 28→Small/Medium, 30→Medium, 32→Medium, 35→Large, 40→Jumbo

6. CONDITIONS:
   new, nwt, new with tags, brand new → "New"
   nwot, new without tags, like new, mint, pristine, excellent → "Excellent"
   very good, great → "Very Good"
   good, gently used, pre-owned → "Good"
   fair, well worn, used, heavily used → "Fair"

7. HARDWARE:
   gold, ghw, gold hardware, light gold, lghw → "Gold"
   silver, shw, silver hardware → "Silver"
   ruthenium, rhw, ruthenium hardware → "Ruthenium"
   palladium, phw, palladium hardware → "Palladium"
   rose gold, rghw, rose gold hardware → "Rose Gold"

8. CATEGORIES — keyword → category mapping:
   bag, handbag, tote, clutch, purse, satchel, crossbody, flap, hobo, bucket → "Handbags"
   ring, necklace, bracelet, earring, pendant, brooch, cuff, anklet, choker → "Jewelry"
   watch, timepiece, chronograph → "Watches"
   shoe, heel, boot, sneaker, loafer, sandal, pump, flat, espadrille, mule → "Shoes"
   dress, jacket, coat, blazer, skirt, pants, top, shirt, sweater, blouse, jumpsuit → "Clothing"
   scarf, belt, sunglasses, wallet, keychain, hat, gloves, tie, card holder → "Accessories"

9. BRAND_ALIASES — common misspellings and alternate names:
   "lv" → "Louis Vuitton"
   "ysl" → "Saint Laurent"
   "cdg" → "Comme des Garcons"
   ... etc

10. ABBREVIATIONS — common listing abbreviations:
    ghw, shw, rhw, rghw, phw, nwt, nwot, auth, sz, os → expanded forms

Export a normalize(category, rawValue) function that takes a dictionary name and raw value, returns the canonical value or null.

Export a normalizeAll(rawText) function that scans a text string and extracts all identifiable attributes (color, material, size, hardware, condition, category) using the dictionaries.
```

---

