import OpenAI from "openai";
import type { ImageAnalysis, ListingCategory } from "@luxefinder/shared";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const PROMPT = `Analyze this luxury item image and return ONLY a JSON object:
{
  "brand": "brand name if visible/identifiable, else null",
  "category": "watch | jewelry | bag | shoes | apparel | accessory",
  "subcategory": "specific type e.g. chronograph_watch | chain_necklace | tote_bag | pump_heels",
  "color_primary": "primary color",
  "color_secondary": "secondary color if applicable, else null",
  "material": "leather | gold | silver | diamond | canvas | suede | etc",
  "style_keywords": ["array", "of", "descriptive", "keywords"],
  "model_name": "specific model name if identifiable e.g. Submariner | Birkin | Double Flap, else null",
  "estimated_era": "contemporary | vintage_90s | vintage_80s | antique | etc",
  "confidence": 0.0
}
Return only valid JSON. No explanation text.`;

export function parseVisionOutput(text: string): ImageAnalysis {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as ImageAnalysis;
  } catch {
    // Handle fenced markdown output like ```json ... ```
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim()) as ImageAnalysis;
    }
    // Last-resort extraction of first JSON object block
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as ImageAnalysis;
    }
    throw new Error("vision_output_parse_failed");
  }
}

export async function analyzeImage(imageUrl: string): Promise<ImageAnalysis> {
  if (!openai) {
    return {
      brand: null,
      category: "accessory",
      subcategory: "fashion_accessory",
      color_primary: null,
      color_secondary: null,
      material: null,
      style_keywords: ["luxury", "designer", "resale"],
      model_name: null,
      estimated_era: "contemporary",
      confidence: 0.45
    };
  }

  const completion = await openai.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: PROMPT },
          { type: "input_image", image_url: imageUrl, detail: "auto" }
        ]
      }
    ]
  });

  const text = completion.output_text.trim();
  return parseVisionOutput(text);
}

export function defaultTextAnalysis(queryText: string, categoryHint?: ListingCategory): ImageAnalysis {
  return {
    brand: queryText.split(" ")[0] ?? null,
    category: categoryHint ?? "accessory",
    subcategory: `${categoryHint ?? "accessory"}_item`,
    color_primary: null,
    color_secondary: null,
    material: null,
    style_keywords: queryText.split(" ").slice(0, 3),
    model_name: null,
    estimated_era: null,
    confidence: 0.7
  };
}
