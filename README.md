# Passionbits Demo UI

A React + Vite frontend for integrating Passionbits AI features: **B-Roll Studio**, **Slideshow**, and creator tools.

> Backend base URL: `https://your-ec2/api/v1` (or `http://localhost:8001/api/v1` locally)  
> Full API docs: [`docs/`](./docs/)

---

## Quick Start

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build → dist/
```

Deploy `dist/` to `/var/www/passionbits-ui/` (served by Nginx).

---

## B-Roll Studio Integration

### Overview

B-Roll Studio lets users generate captioned social videos from template clips. The flow:

1. User enters their email + optional context → clicks **Find Templates**
2. Three parallel socket-based recommendation jobs fire (B-Roll, Meme, User-uploaded)
3. Templates arrive via Socket.IO → rendered as cards with live caption preview
4. User edits caption, adjusts style, picks music, optionally attaches a product video → clicks **Generate**
5. ffmpeg job runs on the backend → output S3 URL returned

### Socket Setup

```js
import { getSocket, joinRoom } from './socket'

// Join the user's email room once on mount
joinRoom(email)
const sock = getSocket()

sock.on('live_progress', (payload) => {
  if (payload.event === 'broll_recommend_ready') {
    const { job_id, status, templates, suggested_music } = payload.data
    // route by job_id → set templates in state
  }
  if (payload.event === 'broll_output_ready') {
    const { job_id, status, url, error } = payload.data
    // show output video or error
  }
})
```

### Template Recommendation

Fire three calls in parallel — each returns a `job_id` immediately; results arrive via socket:

```js
// POST /broll-templates/recommend-original
const res = await broll.recommendOriginal(email, context)
// { data: { job_id: "uuid" } }

// Same pattern for meme and user-uploaded:
broll.recommendMemeOriginal(email, context)
broll.recommendUserGivenOriginal(email, context)
```

Socket event payload (`broll_recommend_ready`):
```json
{
  "event": "broll_recommend_ready",
  "data": {
    "job_id": "uuid",
    "status": "done",
    "templates": [
      {
        "id": "uuid",
        "video_url": "https://assets.passionbits.io/...",
        "description": "Woman in yellow dress stepping out...",
        "score": 92,
        "caption": "AI-suggested caption here"
      }
    ],
    "suggested_music": {
      "id": "uuid",
      "title": "Oxygen LSV",
      "mood": "Dark",
      "genre": "Cinematic",
      "duration_seconds": 239,
      "file_url": "https://assets.passionbits.io/music-tracks/..."
    }
  }
}
```

### Generating Output

```js
// POST /broll-templates/get-output
const res = await broll.getOutput(
  templateId,        // string UUID
  caption,           // string
  style,             // object (see Caption Styling below) — pass null for defaults
  userEmail,         // string
  musicId,           // string UUID or null
  musicStartSeconds, // number or null (offset into track)
  musicDurationSeconds, // number or null (clip length)
  productVideoUrl,   // string S3 URL or null (appended at end)
)
// Response: { data: { job_id: "uuid", status: "processing" } }
```

Poll for completion:

```js
// GET /broll-templates/output-status/{job_id}
// Response when done:   { data: { status: "done",   url: "https://assets.passionbits.io/..." } }
// Response when failed: { data: { status: "failed", error: "..." } }
// Response when pending:{ data: { status: "processing" } }

async function waitForOutput(job_id) {
  for (let i = 0; i < 60; i++) {        // 60 × 3s = 3 min max
    await new Promise(r => setTimeout(r, 3000))
    const res = await broll.outputStatus(job_id)
    if (res?.data?.status === 'done')   return res.data
    if (res?.data?.status === 'failed') throw new Error(res.data.error)
  }
  throw new Error('Generation timed out')
}
```

---

## Caption Styling

Each template card has an independent style object. Pass it as the `style` param in `getOutput`:

```js
const style = {
  font_family: 'Liberation Sans',  // see font list below
  font_color:  '#FFFFFF',
  font_size:   60,                 // 24–120
  bg_color:    '#000000',
  bg_opacity:  1.0,                // 0.0–1.0
  bg_width:    0.88,               // fraction of frame width (0.15–1.0)
  text_x:      0.5,                // normalized 0–1 (0.5 = center)
  text_y:      0.58,               // normalized 0–1
}
```

Fetch available fonts on app load:

```js
// GET /broll-templates/caption-options
// Response: { data: { fonts: [{ name: "Liberation Sans", label: "Sans Serif (default)" }, ...] } }
const res = await broll.captionOptions()
const fonts = res.data.fonts
```

**Available fonts:**
```
Liberation Sans, Liberation Sans Narrow, Liberation Serif, Liberation Mono
DejaVu Sans, DejaVu Sans Bold
Roboto, Roboto Bold
Open Sans, Open Sans Bold
Noto Sans, Noto Sans Bold
```

The live preview in `VideoPreview` scales `font_size` by `container_width / 1080` so what you see matches the ffmpeg output exactly.

---

## Custom Template Upload

Users can upload their own video clips to use as templates:

```js
// POST /broll-templates/upload  (multipart/form-data)
// Fields: video (file), title (string), uploaded_by (email), template_type ('broll' | 'meme')
// Timeout: 3 minutes (Gemini analysis runs on upload)
const res = await broll.uploadTemplate(file, title, email, 'broll')
// Response: { data: { id, title, description, video_url } }
```

After upload the template appears in future `recommendUserGivenOriginal` results for that email.

---

## Music / Audio

### List tracks

```js
// GET /music?source=freepik-seeder&mood=Energetic&limit=100
const res = await music.list({ source: 'freepik-seeder', mood: 'Energetic', limit: 100 })
// Response: { data: { music: [{ id, title, mood, genre, duration_seconds, file_url, cover_url }] } }

// User's own uploads:
const mine = await music.list({ email: userEmail })
```

Available moods: `Dark, Dramatic, Elegant, Energetic, Epic, Exciting, Groovy, Happy, Hopeful, Laid Back, Melancholic, Peaceful, Playful, Sad, Sentimental, Soulful, Tension, Upbeat`

### Upload a track

```js
// POST /music/upload  (multipart/form-data)
// Fields: audio (file), email, title, description, mood, genre
const res = await music.upload(file, email, title, '', mood, '')
// Response: { data: { music: { id, title, file_url, ... } } }
```

### Use music in generation

Pass the track `id` as `musicId` in `getOutput`. Optionally clip the track:

| Param | Effect |
|---|---|
| `musicId` only | Full track plays, loops if shorter than video |
| `musicId` + `musicStartSeconds: 30` | Plays from 0:30 onward |
| `musicId` + `musicDurationSeconds: 15` | Plays first 15 seconds |
| `musicId` + both | Plays seconds 30–45 of the track |

### Auto-suggest

The `broll_recommend_ready` socket event includes `suggested_music` — auto-select it if the user hasn't chosen one yet:

```js
if (payload.data.suggested_music?.id && !selectedMusic) {
  setSelectedMusic(payload.data.suggested_music)
}
```

---

## Product Video

Append a product demo clip at the end of any generated B-Roll output.

### Step 1 — Upload

```js
// POST /broll-templates/upload-product-video  (multipart/form-data)
// Field: video (file — MP4/MOV/WEBM)
const res = await broll.uploadProductVideo(file)
// Response: { data: { url: "https://assets.passionbits.io/product-videos/..." } }
```

No database row is created — just an S3 URL is returned.

### Step 2 — Pass URL to getOutput

```js
await broll.getOutput(
  templateId, caption, style, email,
  musicId, musicStart, musicDuration,
  productVideoUrl,   // ← 8th param
)
```

The backend ffmpeg command concatenates:
```
[captioned_broll_clip] + [product_video_clip]  →  final_output.mp4
```

The product clip is automatically scaled/padded to 1080×1920 to match the B-Roll frame. If the product clip has no audio track the concat falls back to video-only (no silent audio stream errors).

**UI pattern (per-card):** Each template card has an independent "▸ Product Video" toggle. Selecting a file uploads immediately on `onChange` and stores the URL locally in card state. The URL is used only for that card's generation — different cards can have different (or no) product videos.

---

## Slideshow

### Generate (DB-backed, recommended)

```js
// POST /slideshow/generate-original
const res = await slideshow.generateOriginal(email, context, 6)
// Response: { data: { job_id: "uuid" } }
// Result arrives via socket: 'slideshow_ready' event
```

### Generate (manual — sync)

```js
// POST /slideshow/generate  (2-min timeout)
const res = await slideshow.generate(brandName, brandDesc, context, 6, adStyleContext, brandIntelligence)
// Response: { data: { slides: [...] } }
```

### Slide shape

```json
{
  "text_content": "Brand Name — Tagline Here",
  "image_url": "https://cdn.freepik.com/...",
  "search_term": "woman running sunrise coastal trail"
}
```

- `image_url` is a Freepik 9:16 portrait photo; may be `null` if no results found
- Slide 1: brand name + tagline, max 8 words
- Slides 2–N: value props / stats / highlights, max 15 words

### Render pattern

```jsx
<div style={{ position: 'relative', aspectRatio: '9/16' }}>
  {slide.image_url && (
    <img src={slide.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  )}
  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
    <p style={{ color: '#fff', fontWeight: 700, fontSize: 24, textAlign: 'center', padding: '0 16px' }}>
      {slide.text_content}
    </p>
  </div>
</div>
```

### Save / patch

```js
// PATCH /slideshow/{id}
await slideshow.patch(id, email, slides, style, position)
// style and position are free-form JSON — no fixed schema enforced by API
```

### List & fetch

```js
await slideshow.my(email, 20)      // GET /slideshow/my?user_email=...
await slideshow.get(id, email)     // GET /slideshow/{id}?user_email=...
```

---

## Full API Reference

See [`docs/api-reference.md`](./docs/api-reference.md) for the complete endpoint list.

### Quick reference — `api.js` methods

#### `broll.*`

| Method | HTTP | Description |
|---|---|---|
| `brandInfo(name)` | `GET /broll-templates/brand-info` | Brand intelligence lookup |
| `uploadTemplate(file, title, email, type)` | `POST /broll-templates/upload` | Upload custom template (3-min timeout) |
| `uploadProductVideo(file)` | `POST /broll-templates/upload-product-video` | Upload product demo clip → S3 URL |
| `recommendOriginal(email, context, start, end)` | `POST /broll-templates/recommend-original` | B-Roll recommend (async → socket) |
| `recommendMemeOriginal(email, context, start, end)` | `POST /broll-templates/recommend-meme-original` | Meme recommend (async → socket) |
| `recommendUserGivenOriginal(email, context, start, end)` | `POST /broll-templates/recommend-user-given-original` | User-template recommend (async → socket) |
| `getOutput(templateId, caption, style, email, musicId, musicStart, musicDuration, productVideoUrl)` | `POST /broll-templates/get-output` | Start caption+music+product overlay job |
| `outputStatus(jobId)` | `GET /broll-templates/output-status/{jobId}` | Poll job status |
| `captionOptions()` | `GET /broll-templates/caption-options` | Available fonts |
| `myTemplates(email)` | `GET /broll-templates/my-templates` | User's uploaded templates |

#### `music.*`

| Method | HTTP | Description |
|---|---|---|
| `list({ mood, genre, email, source, limit })` | `GET /music` | List tracks with filters |
| `upload(file, email, title, description, mood, genre)` | `POST /music/upload` | Upload audio track |

#### `slideshow.*`

| Method | HTTP | Description |
|---|---|---|
| `generateOriginal(email, context, n)` | `POST /slideshow/generate-original` | DB-backed (async → socket) |
| `generate(brandName, brandDesc, context, n, adStyle, intelligence)` | `POST /slideshow/generate` | Manual sync (2-min timeout) |
| `patch(id, email, slides, style, position)` | `PATCH /slideshow/{id}` | Save edits |
| `my(email, limit)` | `GET /slideshow/my` | List user's slideshows |
| `get(id, email)` | `GET /slideshow/{id}` | Fetch single slideshow |

---

## Project Structure

```
src/
  api.js                  ← all API calls (single source of truth)
  socket.js               ← Socket.IO client setup
  App.jsx                 ← root, routing between pages
  components/
    BrollStudio.jsx        ← B-Roll Studio (main feature)
    Slideshow.jsx          ← Slideshow generator
    ...
```

## Environment

The frontend proxies `/api/v1` through Vite dev server (`vite.config.js`) to the backend. In production Nginx handles the proxy.
