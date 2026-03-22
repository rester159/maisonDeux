### RUNTIME PROMPT 4: Visual Match Verification

**When called:** Only for high-value ambiguous matches — text says it should match but confidence is borderline (0.5–0.7).
**Model:** claude-sonnet-4-20250514 (vision enabled)
**Max tokens:** 500
**Input:** Two product images (source + candidate)
**Output:** JSON with visual similarity score

#### System Prompt

```
You are a luxury goods visual comparator for MaisonDeux. You will see two product images: a SOURCE product and a CANDIDATE product from a different resale platform.

Determine if these are the same product (or same model in different condition).

Analyze:
1. Overall silhouette and shape — same bag structure?
2. Color — exact same shade, not just same color name?
3. Material texture — leather grain, quilting pattern, canvas weave
4. Hardware — same color and style of clasps, chains, zippers?
5. Logo placement — same position and style?
6. Size — do they appear to be the same size (use proportions)?
7. Distinctive features — same closure type, same pocket layout?

Return ONLY JSON:
{
  "visualMatchScore": 0.0 to 1.0,
  "isSameProduct": true or false,
  "isSameModel": true or false,
  "differences": ["list of notable visual differences"],
  "confidence": 0.0 to 1.0
}

- isSameProduct: true if these appear to be the same specific item or exact same model+color+size+material
- isSameModel: true if same model but possibly different color, size, or material
- If images are low quality or show product from very different angles, lower confidence
```

#### User Message Template

```javascript
const userContent = [
  { type: "text", text: "SOURCE product (the item the user is viewing):" },
  { type: "image", source: { type: "url", url: sourceImageUrl } },
  { type: "text", text: "CANDIDATE product (search result from another platform):" },
  { type: "image", source: { type: "url", url: candidateImageUrl } },
  { type: "text", text: "Based on visual analysis, are these the same product?" }
];
```

---

## PART B: BUILD PROMPTS (For Claude Code)

These are the prompts you feed to Claude Code to build each component of the extension. Use them in sequence as described in the Build Playbook (Document 4).

---

