# B-Roll Studio & Slideshow — Frontend UI Documentation

> Frontend lives at `development_temp/passionbits-ui/src/`  
> Main files: `components/BrollStudio.jsx`, `api.js`  
> Backend base: `/api/v1/`

---

## Table of Contents

1. [B-Roll Studio Overview](#1-b-roll-studio-overview)
2. [Template Recommendation Flow](#2-template-recommendation-flow)
3. [Main Template Cards & Caption Preview](#3-main-template-cards--caption-preview)
4. [Caption Styling](#4-caption-styling)
5. [Custom Template Upload](#5-custom-template-upload)
6. [Music / Audio](#6-music--audio)
7. [Output Generation & Polling](#7-output-generation--polling)
8. [Slideshow](#8-slideshow)
9. [API Client Reference](#9-api-client-reference)

---

## 1. B-Roll Studio Overview

`BrollStudio` is the top-level component. It receives a single `email` prop (the logged-in user's email) and manages all state for the entire feature.

```
BrollStudio (email)
 ├── Form card — context input + Find Templates button
 ├── Upload Your Template (collapsible)
 ├── Music / Audio (collapsible)
 └── Results
      ├── Your Uploaded Templates → TemplateSection
      ├── B-Roll Templates        → TemplateSection
      └── Meme Templates          → TemplateSection
                                       └── TemplateCard (per template)
                                            ├── VideoPreview (live caption overlay)
                                            ├── Caption textarea
                                            ├── Style toggle → CaptionStylePanel
                                            └── Generate button → output video
```

**State in BrollStudio:**

| State | Type | Description |
|---|---|---|
| `context` | string | Optional creative context ("summer campaign") |
| `brollTemplates` | array | System B-Roll template results |
| `memeTemplates` | array | System meme template results |
| `userTemplates` | array | User-uploaded template results |
| `brollLoading / memeLoading / userLoading` | bool | Per-section loading flags |
| `selectedMusic` | object\|null | Currently selected music track `{id, title, mood, duration_seconds}` |
| `musicStart` | number | Start offset in seconds (default 0) |
| `musicDuration` | number\|null | Clip duration in seconds (null = full track) |
| `pendingJobs` | ref | Map of `job_id → 'broll'\|'meme'\|'user'` for socket routing |

---

## 2. Template Recommendation Flow

Clicking **Find Templates** fires three parallel async calls — one per template type. Each call returns a `job_id` immediately; results arrive via Socket.IO.

```
handleFind()
  │
  ├── broll.recommendOriginal(email, context)   → { job_id }
  ├── broll.recommendMemeOriginal(email, context) → { job_id }
  └── broll.recommendUserGivenOriginal(email, context) → { job_id }
        │
        │ (all job_ids stored in pendingJobs ref)
        │
        ▼ Socket.IO event: live_progress → { event: 'broll_recommend_ready', data: { job_id, status, templates, suggested_music } }
        │
        ├── routes to correct section via pendingJobs lookup
        ├── sets templates into state (setBrollTemplates / setMemeTemplates / setUserTemplates)
        └── if suggested_music present AND no music selected → auto-selects it
```

**Socket setup:**

```js
joinRoom(email)   // joins email room on the socket server
sock.on('live_progress', handleProgress)
```

The socket listener is set up once in a `useEffect` keyed on `email`. It cleans up (`sock.off`) on unmount.

**Endpoints used:**

| Type | Endpoint | Notes |
|---|---|---|
| B-Roll | `POST /broll-templates/recommend-original` | DB-backed, email only |
| Meme | `POST /broll-templates/recommend-meme-original` | DB-backed, email only |
| User-uploaded | `POST /broll-templates/recommend-user-given-original` | DB-backed, email only |

Request body for all three:
```json
{ "user_email": "user@example.com", "context": "summer campaign", "start": 1, "end": 10 }
```

---

## 3. Main Template Cards & Caption Preview

### TemplateSection

Groups templates of one type (B-Roll / Meme / User) under a section header. Lifts caption state so **Generate All** always sees current values.

- Captions are stored as `{ [template_id]: captionString }` in local state
- Each caption change clears that template's existing output
- **Generate All** posts all jobs simultaneously then waits for all socket/poll results

```js
// Generate All
const jobPosts = await Promise.all(
  templates.map(t => broll.getOutput(
    t.id, captions[t.id].trim(), null, userEmail,
    music?.id, music?.startSeconds, music?.durationSeconds
  ))
)
```

### TemplateCard

Renders a single template. State is local per card.

| State | Description |
|---|---|
| `generating` | ffmpeg job in progress |
| `outputUrl` | S3 URL of finished video |
| `style` | Caption style object (font, colors, sizes) |
| `position` | `{x, y}` normalized caption position |
| `showStyle` | Whether CaptionStylePanel is expanded |

**VideoPreview** renders the template video with a live caption overlay on top — what you see is what ffmpeg will burn in.

### VideoPreview — Live Caption Overlay

The caption `<div>` mirrors the ffmpeg output visually:

- **Width:** `bg_width * 100%` of the video container
- **Font size:** `style.font_size * scale` (scale = container_px / 1080 — so font is proportional to the 1080px ffmpeg canvas)
- **Font family:** mapped to browser-safe fallback via `FONT_FALLBACK` dict
- **Background:** `rgba(r, g, b, opacity)` from `hexToRgba(bg_color, bg_opacity)`
- **Position:** `left: x*100%, top: y*100%, transform: translate(-50%,-50%)`

**Dragging:** Pointer events move the caption. Clamped so the caption stays fully inside the video boundaries using the caption's own `offsetWidth/Height`.

**Corner resize handles:** Four `<span>` elements at each corner change `bg_width` symmetrically. Left-side corners invert the delta direction.

```js
const delta = resizeStart.current.isLeft ? -dx : dx
const newW = Math.max(0.15, Math.min(1.0, resizeStart.current.startW + delta * 2))
```

---

## 4. Caption Styling

### CaptionStylePanel

Collapsible panel toggled by the **▸ Style** button on each card. Changes are per-card and reset when the page refreshes (not persisted).

| Control | State key | Range / Options |
|---|---|---|
| Font | `font_family` | 12 fonts from `/caption-options` |
| Text Color | `font_color` | Color picker (`<input type="color">`) |
| BG Color | `bg_color` | Color picker |
| BG Opacity | `bg_opacity` | Slider 0–1, step 0.05 |
| Font Size | `font_size` | Slider 24–120px, step 2 |
| BG Width | `bg_width` | Slider 15%–100%, step 1% |
| Reset Position | — | Resets `position` to `{x: 0.5, y: 0.58}` |

**Default style:**
```js
const DEFAULT_STYLE = {
  font_family: 'Liberation Sans',
  font_color:  '#FFFFFF',
  font_size:   60,
  bg_color:    '#000000',
  bg_opacity:  1.0,
  bg_width:    0.88,
}
const DEFAULT_POS = { x: 0.5, y: 0.58 }
```

**Available fonts** (fetched from `GET /broll-templates/caption-options` on mount):

```
Liberation Sans, Liberation Sans Narrow, Liberation Serif, Liberation Mono
DejaVu Sans, DejaVu Sans Bold
Roboto, Roboto Bold
Open Sans, Open Sans Bold
Noto Sans, Noto Sans Bold
```

### How the style maps to ffmpeg

When the user clicks Generate, the style object is sent as `style` in the `POST /get-output` body:

```json
{
  "template_id": "...",
  "caption": "Brand for when the run gets real",
  "style": {
    "font_family": "Roboto Bold",
    "font_color": "#FFFFFF",
    "font_size": 60,
    "bg_color": "#000000",
    "bg_opacity": 0.7,
    "text_x": 0.5,
    "text_y": 0.58,
    "bg_width": 0.88
  }
}
```

The backend `_overlay_caption()` converts this to a single `drawbox` (unified background rectangle) followed by one `drawtext` per wrapped line:

```
drawbox=x={box_x}:y={box_y}:w={box_w_px}:h={box_h_px}:color=0x{hex}@{opacity}:t=fill
drawtext=text='Line 1':font='Roboto Bold':fontsize=60:fontcolor=#FFFFFF:text_align=C:boxw={usable_w}:x={text_x}:y={line_y}
drawtext=text='Line 2':...
```

Text wraps automatically based on `bg_width` — narrower box = more lines = taller box.

---

## 5. Custom Template Upload

### Upload Your Template (collapsible `<details>`)

Located in a card above the results. Lets users upload their own video to the B-Roll library.

**Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| Video File | file input | Yes | Accepts `video/*` (MP4, MOV, WEBM) |
| Title | text input | No | Human-readable label |
| Template Type | toggle buttons | Yes | `broll` or `meme` (default: broll) |

**On submit → `broll.uploadTemplate(file, title, email, templateType)`:**

```js
// api.js
uploadTemplate: (file, title = '', email = '', templateType = 'broll') => {
  const fd = new FormData()
  fd.append('video', file)
  if (title) fd.append('title', title)
  if (email) fd.append('uploaded_by', email)
  fd.append('template_type', templateType)
  // 3-minute AbortController timeout (Gemini analysis can take ~60–90s)
  return fetch(BASE + '/broll-templates/upload', { method: 'POST', body: fd, signal })
    .then(r => r.json())
}
```

**Backend processing on upload:**
1. Saves to S3 (`broll-templates-raw/` folder)
2. Compresses if >20MB (scale ≤720px, fps=24, CRF=28)
3. Uploads to Gemini Files API → analyzes with `gemini-3.1-flash-lite-preview`
4. Saves `BrollTemplate` row with `uploaded_by = email`

**On success**, shows:
```
Uploaded! Gemini description: "A woman in athletic wear jogs..."
```

**Fetching user templates:** The "Your Uploaded Templates" section is populated via the socket flow (same `recommendUserGivenOriginal` call). To fetch without recommendation scoring, use `broll.myTemplates(email)` → `GET /broll-templates/my-templates?email=...`.

---

## 6. Music / Audio

### Music / Audio (collapsible `<details>`)

Located below "Upload Your Template", above results. The section header shows the selected track name inline when one is chosen.

**State (in BrollStudio):**

| State | Description |
|---|---|
| `selectedMusic` | `{id, title, mood, duration_seconds}` or null |
| `musicStart` | Start offset in seconds (default 0) |
| `musicDuration` | Clip length in seconds, null = full track |

When music is selected, it is passed down to every `TemplateSection` → `TemplateCard` → `broll.getOutput()` call.

### Tabs

**Catalog tab** — Freepik-seeded library tracks

- Fetches: `GET /music?source=freepik-seeder&mood={filter}&limit=100`
- Reloads when mood filter changes

**My Uploads tab** — User's own uploaded tracks

- Fetches: `GET /music?email={email}&limit=100`
- Reloads when mood filter changes

**Upload Track tab** — Upload a new audio file

Fields: Audio file (mp3/wav/aac/m4a/ogg/flac), Title (optional), Mood (optional dropdown)

```js
// api.js
music.upload(file, email, title, '', mood, '')
// → POST /music/upload  (multipart/form-data)
// Fields: audio, email, title, mood
```

### Track List UI

Each track row shows:
- ▶/⏸ play button — previews the track in a hidden `<audio>` element
- Title (truncated) + mood · genre · duration
- **Use** / **Selected** toggle button

Selecting a track sets `selectedMusic` in BrollStudio and resets start/duration to defaults. Clicking a selected track again deselects it.

### Clip Controls

Appear below the track list when a track is selected (and not on the Upload tab):

| Control | Default | Description |
|---|---|---|
| Start (sec) | 0 | Seconds into the track to begin playback (`-ss` input seek in ffmpeg) |
| Duration (sec) | empty | How many seconds of audio to play; empty = full remaining track |

### Auto-Suggest

When the `broll_recommend_ready` socket event includes a `suggested_music` object, it is auto-selected if no music is currently chosen:

```js
if (suggested_music?.id && !selectedMusic) {
  setSelectedMusic(suggested_music)
  setMusicStart(0)
  setMusicDuration(null)
}
```

The backend picks the suggestion by mood-keyword matching `brand_description` against available tracks.

### How Music Applies to Output

`broll.getOutput()` includes music params if a track is selected:

```js
broll.getOutput(
  templateId, caption, style, userEmail,
  music?.id,            // music_id UUID
  music?.startSeconds,  // music_start_seconds
  music?.durationSeconds // music_duration_seconds
)
```

**Backend ffmpeg command (with music):**

```bash
ffmpeg -y \
  [-ss {start}] -i music.mp3 \    # -ss before -i: fast input seek
  -i video.mp4 \
  -vf "scale+pad+drawbox+drawtext..." \
  -filter_complex "[1:a]aloop=loop=-1:size=2000000000[aout]" \
  -map 0:v:0 -map "[aout]" \
  -c:v libx264 -preset fast \
  -c:a aac -b:a 128k \
  [-t {duration}] \               # output cap if duration set
  output.mp4
```

- `aloop=-1` loops the audio indefinitely — short tracks fill the full video, not the other way round
- `-shortest` is NOT used — video length always wins
- `-t duration` caps output if `music_duration_seconds` is set
- Without music: `-c:a copy` (preserves original template audio)

### Music DB (`music_tracks` table)

| Field | Description |
|---|---|
| `id` | UUID — used as `music_id` in `getOutput` |
| `title` | Track name |
| `description` | Auto-generated ("A happy pop track titled X by Y") |
| `artist` | Artist name |
| `mood` | e.g. Happy, Energetic, Dark |
| `genre` | e.g. Pop, Corporate |
| `duration_seconds` | Track length |
| `file_url` | S3 CDN URL (`.mp3`) |
| `cover_url` | Freepik cover image URL |
| `source` | `freepik-seeder` or `user-upload` |
| `user_email` | Set only for user-uploaded tracks |

---

## 7. Output Generation & Polling

### Per-Card Generation

```
User clicks Generate (or Regenerate)
  │
  ▼
broll.getOutput(templateId, caption, style, email, musicId, musicStart, musicDuration)
  → POST /broll-templates/get-output
  → Response: { job_id: "uuid", status: "processing" }
  │
  ▼
waitForOutput(job_id)  — polls every 3s, up to 60 attempts (3 min)
  → GET /broll-templates/output-status/{job_id}
  → { status: "processing" } → keep polling
  → { status: "done", url: "https://assets.passionbits.io/..." } → show video ✓
  → { status: "failed", error: "..." } → show error ✗
```

```js
async function waitForOutput(job_id) {
  const maxAttempts = 60   // 60 × 3s = 3 minutes
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const res = await broll.outputStatus(job_id)
    if (res?.data?.status === 'done')   return res.data      // { url, status }
    if (res?.data?.status === 'failed') throw new Error(res.data.error)
  }
  throw new Error('Generation timed out')
}
```

The output video is shown inline below the card with a Download link.

### Generate All

Posts all jobs simultaneously, then waits for all results in parallel via `Promise.allSettled`. Outputs are shown in a separate grid below the template grid. Partially successful runs (some done, some failed) still show the successful ones.

---

## 8. Slideshow

### Frontend API (`slideshow.*`)

```js
// DB-backed — email only (recommended)
slideshow.generateOriginal(email, context = '', n = 6)
  // POST /slideshow/generate-original
  // Returns { job_id } — result via socket event 'slideshow_ready'

// Manual — full brand context supplied
slideshow.generate(brandName, brandDescription, context, n, adStyleContext, brandIntelligence)
  // POST /slideshow/generate
  // Returns slides directly (synchronous, no job)

// Save edited slideshow back to DB
slideshow.patch(id, email, slides, style, position)
  // PATCH /slideshow/{id}

// List saved slideshows for a user
slideshow.my(email, limit = 20)
  // GET /slideshow/my?user_email=...

// Fetch a single saved slideshow
slideshow.get(id, email)
  // GET /slideshow/{id}?user_email=...
```

### Slide Data Shape

```json
{
  "slides": [
    {
      "text_content": "Brand Name — Tagline Here",
      "image_url": "https://cdn.freepik.com/...",
      "search_term": "woman running sunrise coastal trail"
    }
  ]
}
```

- Slide 1: always includes brand name, max 8 words
- Slides 2–N: value props, stats, highlights — max 15 words each
- `image_url` is a Freepik portrait (9:16) photo found via `search_term`; can be `null` if Freepik has no results

### Rendering Pattern

```jsx
<div style={{ position: 'relative', aspectRatio: '9/16' }}>
  {slide.image_url && (
    <img src={slide.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  )}
  <div style={{
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.35)',
  }}>
    <p style={{ color: '#fff', fontWeight: 700, fontSize: 24, textAlign: 'center', padding: '0 16px' }}>
      {slide.text_content}
    </p>
  </div>
</div>
```

### Slideshow Styling (PATCH)

After generation the user can edit slides and save back:

```js
slideshow.patch(id, email, slides, style, position)
// PATCH /slideshow/{id}
// Body: { user_email, slides: [...], style: { font, colors, ... }, position: { x, y } }
```

`style` and `position` are free-form objects — the backend stores them as JSON. The frontend controls what fields are included; there is no fixed schema enforced by the API.

---

## 9. API Client Reference

All frontend API calls go through `src/api.js`. Base URL: `/api/v1`.

### `broll.*`

| Method | Call | Description |
|---|---|---|
| `brandInfo(name)` | `GET /broll-templates/brand-info?name=` | Brand intelligence lookup |
| `uploadTemplate(file, title, email, type)` | `POST /broll-templates/upload` | Upload custom video template (3-min timeout) |
| `recommendOriginal(email, context, start, end)` | `POST /broll-templates/recommend-original` | DB-backed B-Roll recommend (async → socket) |
| `recommendMemeOriginal(email, context, start, end)` | `POST /broll-templates/recommend-meme-original` | DB-backed meme recommend (async → socket) |
| `recommendUserGivenOriginal(email, context, start, end)` | `POST /broll-templates/recommend-user-given-original` | DB-backed user-template recommend (async → socket) |
| `recommendManual(...)` | `POST /broll-templates/recommend-manual` | Manual B-Roll recommend (sync, 2-min timeout) |
| `recommendMemeManual(...)` | `POST /broll-templates/recommend-meme-manual` | Manual meme recommend |
| `recommendUserGivenManual(...)` | `POST /broll-templates/recommend-user-given-manual` | Manual user-template recommend |
| `getOutput(templateId, caption, style, email, musicId, musicStart, musicDuration)` | `POST /broll-templates/get-output` | Start caption+music overlay job |
| `outputStatus(jobId)` | `GET /broll-templates/output-status/{jobId}` | Poll job status |
| `captionOptions()` | `GET /broll-templates/caption-options` | Fetch available fonts + defaults |
| `myTemplates(email)` | `GET /broll-templates/my-templates?email=` | List user-uploaded templates |

### `music.*`

| Method | Call | Description |
|---|---|---|
| `list({ mood, genre, email, source, limit })` | `GET /music?...` | List tracks with filters |
| `upload(file, email, title, description, mood, genre)` | `POST /music/upload` | Upload custom audio track |

### `slideshow.*`

| Method | Call | Description |
|---|---|---|
| `generateOriginal(email, context, n)` | `POST /slideshow/generate-original` | DB-backed slideshow (async → socket) |
| `generate(brandName, brandDesc, context, n, adStyle, intelligence)` | `POST /slideshow/generate` | Manual slideshow (sync, 2-min timeout) |
| `patch(id, email, slides, style, position)` | `PATCH /slideshow/{id}` | Save edited slideshow |
| `my(email, limit)` | `GET /slideshow/my?user_email=` | List user's saved slideshows |
| `get(id, email)` | `GET /slideshow/{id}?user_email=` | Fetch single slideshow |
