# B-Roll Pipeline v2 — API & Frontend Implementation Guide

## Overview

The v2 pipeline replaces the single LLM call with two Gemini/Bedrock inferences:

1. **Inference 1** — generates ≤3-word Pexels search queries based on brand, selected products, and ad-type
2. **Inference 2** — writes per-template captions (~40 words) and picks a `music_id` per template from the catalog

Flow: `POST /recommend-v2` → returns `job_id` → background job runs both inferences + Pexels ingest → socket emits `broll_recommend_ready`.

---

## Migration (run once after deploy)

```bash
python manage.py migrate
```

Adds three columns to `broll_recommendation_runs` using `ADD COLUMN IF NOT EXISTS` — safe, no downtime, no table locks.

| Column | Type | Default |
|---|---|---|
| `search_queries` | `JSONB` | `[]` |
| `broll_type` | `VARCHAR(64)` | `NULL` |
| `product_ids` | `JSONB` | `[]` |

---

## Endpoints

### `GET /api/v1/broll-templates/broll-types`

Returns the 20 ad-type labels for the dropdown. No auth required.

**Response:**
```json
[
  {
    "id": "cinematic_aesthetic",
    "label": "Cinematic Aesthetic",
    "hint": "Sunset drives, city lights, slow motion",
    "prompt_hint": "Visually rich, slow-motion or time-lapse scenes with dramatic lighting"
  },
  {
    "id": "satisfying",
    "label": "Satisfying / Oddly Satisfying",
    "hint": "Cutting soap, slime, perfect alignment",
    "prompt_hint": "..."
  }
]
```

Call once on mount, cache in component state.

---

### `GET /api/v1/broll-templates/my-brand-products?email=`

Returns the user's primary brand and its product list.

**Query params:**

| Param | Required | Description |
|---|---|---|
| `email` | yes | User email |

**Response:**
```json
{
  "brand_id": "uuid",
  "brand_name": "Dabur Honey",
  "products": [
    { "id": "uuid", "name": "Honey 250g", "description": "Raw forest honey..." },
    { "id": "uuid", "name": "Honey 500g", "description": "..." }
  ]
}
```

Returns `{ "brand_id": null, "brand_name": null, "products": [] }` if no brand found. Use the products list to render product checkboxes.

---

### `POST /api/v1/broll-templates/recommend-v2`

Starts a background job that runs both inferences and Pexels ingest.

**Request body:**
```json
{
  "user_email": "user@example.com",
  "broll_type": "cinematic_aesthetic",
  "product_ids": ["uuid1", "uuid2"],
  "context": "summer sale campaign",
  "count": 6,
  "ignore_queries": ["morning run", "coffee shop"]
}
```

| Field | Required | Default | Description |
|---|---|---|---|
| `user_email` | yes | — | User's email |
| `broll_type` | no | `cinematic_aesthetic` | One of the 20 type IDs from `/broll-types` |
| `product_ids` | no | `[]` | UUIDs from `/my-brand-products`; empty = use all products |
| `context` | no | `""` | Free-text campaign context |
| `count` | no | `6` | Number of templates to return (1–20) |
| `ignore_queries` | no | `null` | Pexels queries to never re-use. If `null`, backend auto-pulls all prior queries for this user from DB |

**Response:**
```json
{ "job_id": "uuid" }
```

Join the socket room with `job_id` and listen for `broll_recommend_ready`.

---

### Socket event: `broll_recommend_ready`

Fired when the background job completes. Check `recommend_type === "broll_v2"` to distinguish from v1 results.

**Payload:**
```json
{
  "recommend_type": "broll_v2",
  "templates": [
    {
      "id": "uuid",
      "video_url": "https://assets.passionbits.io/...",
      "description": "coastal morning run with golden light",
      "caption": "Start your morning the right way — Dabur Honey gives you clean, natural energy without the crash.",
      "music_id": "uuid",
      "score": 87
    }
  ],
  "post_text": "2–3 sentence social caption for the overall post",
  "search_queries_used": ["coastal morning run", "gym water bottle", "sunset yoga mat"]
}
```

Save `search_queries_used` and pass it as `ignore_queries` on the next "Generate More" call to ensure fresh scenes every time.

---

### `GET /api/v1/music/{id}`

Fetch a single music track by UUID. Use after receiving `music_id` from the socket payload to get the `file_url` for `<audio>` playback.

**Response:**
```json
{
  "music": {
    "id": "uuid",
    "title": "Upbeat Summer",
    "mood": "Energetic",
    "genre": "Pop",
    "file_url": "https://assets.passionbits.io/music-tracks/...",
    "duration_seconds": 90,
    "artist": null,
    "source": "freepik-seeder"
  }
}
```

---

## Frontend Integration Pattern

### api.js calls

```js
import { broll, music } from './api'

// On mount
const types = await broll.brollTypes()              // GET /broll-types
const brand = await broll.myBrandProducts(email)    // GET /my-brand-products

// Generate
const { job_id } = await broll.recommendV2(email, {
  brollType: 'cinematic_aesthetic',
  productIds: ['uuid1'],
  context: 'summer campaign',
  count: 6,
  ignoreQueries: [],     // pass [] on first call, accumulated list on Generate More
})

// After socket fires, fetch music for playback
const { music: track } = await music.byId(template.music_id)
// <audio controls src={track.file_url} />
```

### Full flow

```
mount
  → broll.brollTypes()           → ad-type dropdown (20 options)
  → broll.myBrandProducts(email) → product checkboxes

user picks ad type + products + context → clicks "Find Templates (v2)"
  → broll.recommendV2(email, { brollType, productIds, context, count: 6, ignoreQueries: [] })
  → returns { job_id }
  → join socket room on job_id

socket fires broll_recommend_ready (recommend_type === 'broll_v2')
  → render templates grid (video_url, caption, score)
  → accumulate: ignoredQueries = [...prev, ...search_queries_used]
  → show "Generate More" button

user clicks "Generate More"
  → broll.recommendV2(email, { ..., ignoreQueries: ignoredQueries })
  → new templates with fresh Pexels scenes replace the grid
```

The `ignoredQueries` ref should be a `useRef` (not state) to avoid re-renders on accumulation.

---

## Caption Generation Rules

Inference 2 produces captions following these rules (useful for QA and prompt tuning):

- ~40 words, max 2 sentences
- Hook in the first 6 words
- Must include the brand name
- Must reference at least one selected product (by name or clear benefit)
- Sentence case — not ALL CAPS
- No hashtags (`#`)
- No emojis
- No cliché filler: "hits different", "main character energy", "just vibes", "no thoughts", "bestie"
- CTA is optional; when used, soft and specific ("tap to try", not "BUY NOW!!!")
- Brand tone respected: premium brands don't sound chaotic, playful brands don't sound corporate
- Must feel distinct from competitor captions (uses brand intelligence for differentiation)

---

## Audit Check

After deploying, verify biased examples were removed from existing prompts:

```bash
grep -n "GOOD (" app/services/broll_template_service.py app/services/slideshow_service.py
# → should return nothing
```
