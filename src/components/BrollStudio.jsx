import { useState, useEffect, useRef, useCallback } from 'react'
import { broll, music as musicApi } from '../api'
import { getSocket, joinRoom } from '../socket'

const DEFAULT_STYLE = {
  font_family: 'Liberation Sans',
  font_color: '#FFFFFF',
  font_size: 60,
  bg_color: '#000000',
  bg_opacity: 1.0,
  bg_width: 0.88,
}
const DEFAULT_POS = { x: 0.5, y: 0.58 }

// Map server fonts → browser-safe fallbacks for live preview
const FONT_FALLBACK = {
  'Liberation Sans': 'Liberation Sans, Arial, sans-serif',
  'Liberation Sans Narrow': 'Liberation Sans Narrow, Arial Narrow, sans-serif',
  'Liberation Serif': 'Liberation Serif, Times New Roman, serif',
  'Liberation Mono': 'Liberation Mono, Courier New, monospace',
  'DejaVu Sans': 'DejaVu Sans, Verdana, sans-serif',
  'DejaVu Sans Bold': 'DejaVu Sans, Verdana, sans-serif',
  'Roboto': 'Roboto, Arial, sans-serif',
  'Roboto Bold': 'Roboto, Arial, sans-serif',
  'Open Sans': 'Open Sans, Arial, sans-serif',
  'Open Sans Bold': 'Open Sans, Arial, sans-serif',
  'Noto Sans': 'Noto Sans, Arial, sans-serif',
  'Noto Sans Bold': 'Noto Sans, Arial, sans-serif',
}

function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${opacity})`
}

// ── Video preview with draggable + resizable caption overlay ─────────────────
function VideoPreview({ videoUrl, caption, style, position, onPositionChange, onStyleChange }) {
  const containerRef = useRef(null)
  const captionRef = useRef(null)
  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const resizing = useRef(false)
  const resizeStart = useRef({ mx: 0, startW: 0, isLeft: false })
  const [scale, setScale] = useState(0)

  // Track container width for font-size scaling (1080 = FFmpeg canvas width)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      setScale(entries[0].contentRect.width / 1080)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Corner resize: width-only, symmetric around center
  const onCornerDown = useCallback((e, corner) => {
    resizing.current = true
    resizeStart.current = {
      mx: e.clientX,
      startW: style.bg_width,
      isLeft: corner === 'tl' || corner === 'bl',
    }
    e.stopPropagation()
    e.target.setPointerCapture(e.pointerId)
  }, [style.bg_width])

  // Center drag
  const onPointerDown = useCallback((e) => {
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, px: position.x, py: position.y }
    e.target.setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [position.x, position.y])

  const onPointerMove = useCallback((e) => {
    if (resizing.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const dx = (e.clientX - resizeStart.current.mx) / rect.width
      const delta = resizeStart.current.isLeft ? -dx : dx
      const newW = Math.max(0.15, Math.min(1.0, resizeStart.current.startW + delta * 2))
      onStyleChange({ ...style, bg_width: newW })
      return
    }
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dx = (e.clientX - dragStart.current.mx) / rect.width
    const dy = (e.clientY - dragStart.current.my) / rect.height

    let nx = dragStart.current.px + dx
    let ny = dragStart.current.py + dy

    // Clamp so caption stays within video boundaries
    if (captionRef.current) {
      const halfW = captionRef.current.offsetWidth / (2 * rect.width)
      const halfH = captionRef.current.offsetHeight / (2 * rect.height)
      nx = Math.max(halfW, Math.min(1 - halfW, nx))
      ny = Math.max(halfH, Math.min(1 - halfH, ny))
    }
    onPositionChange({ x: nx, y: ny })
  }, [style, onStyleChange, onPositionChange])

  const onPointerUp = useCallback(() => {
    dragging.current = false
    resizing.current = false
  }, [])

  const previewFontSize = Math.max(8, Math.round(style.font_size * scale))
  const padV = Math.max(2, Math.round(20 * scale))
  const padH = Math.max(4, Math.round(50 * scale))
  const fontCss = FONT_FALLBACK[style.font_family] || (style.font_family + ', sans-serif')
  const isBold = style.font_family.toLowerCase().includes('bold')
  const bgWidth = style.bg_width ?? 0.88

  const CORNERS = ['tl', 'tr', 'bl', 'br']
  const cornerStyle = (corner) => ({
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 3,
    background: 'white',
    border: '2px solid #6366f1',
    top: corner.startsWith('t') ? -6 : 'auto',
    bottom: corner.startsWith('b') ? -6 : 'auto',
    left: corner.endsWith('l') ? -6 : 'auto',
    right: corner.endsWith('r') ? -6 : 'auto',
    cursor: (corner === 'tl' || corner === 'br') ? 'nwse-resize' : 'nesw-resize',
    zIndex: 10,
    touchAction: 'none',
  })

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', aspectRatio: '9/16', overflow: 'hidden' }}
    >
      <video
        src={videoUrl}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        muted autoPlay loop playsInline
      />
      {caption.trim() && scale > 0 && (
        <div
          ref={captionRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onLostPointerCapture={onPointerUp}
          style={{
            position: 'absolute',
            left: `${position.x * 100}%`,
            top: `${position.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: `${bgWidth * 100}%`,
            padding: `${padV}px ${padH}px`,
            fontFamily: fontCss,
            fontWeight: isBold ? 700 : 400,
            fontSize: previewFontSize,
            color: style.font_color,
            backgroundColor: hexToRgba(style.bg_color, style.bg_opacity),
            textAlign: 'center',
            lineHeight: 1.35,
            borderRadius: Math.max(2, Math.round(4 * scale)),
            cursor: 'grab',
            userSelect: 'none',
            touchAction: 'none',
            wordBreak: 'break-word',
            boxSizing: 'border-box',
            transition: (dragging.current || resizing.current) ? 'none' : 'left 0.1s, top 0.1s',
          }}
        >
          {caption}
          {/* Corner resize handles */}
          {CORNERS.map(corner => (
            <span
              key={corner}
              onPointerDown={e => onCornerDown(e, corner)}
              style={cornerStyle(corner)}
            />
          ))}
        </div>
      )}
      {/* Hint */}
      {caption.trim() && (
        <div style={{
          position: 'absolute', bottom: 4, left: 0, right: 0,
          textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.5)',
          pointerEvents: 'none',
        }}>
          drag to reposition · drag corners to resize
        </div>
      )}
    </div>
  )
}

// ── Caption style controls ────────────────────────────────────────────────────
function CaptionStylePanel({ style, onChange, fonts, onResetPosition }) {
  const set = (key, val) => onChange({ ...style, [key]: val })

  return (
    <div style={{
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      borderTop: '1px solid #2a2d3e',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Caption Style
        </div>
        <button
          onClick={onResetPosition}
          style={{
            background: 'none', border: '1px solid #2a2d3e', color: '#64748b',
            fontSize: 9, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
          }}
        >
          Reset Position
        </button>
      </div>

      {/* Font family */}
      <div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Font</div>
        <select
          value={style.font_family}
          onChange={e => set('font_family', e.target.value)}
          style={{
            width: '100%', padding: '4px 6px', fontSize: 11,
            background: '#1a1d2e', color: '#e2e8f0', border: '1px solid #2a2d3e',
            borderRadius: 4, outline: 'none',
          }}
        >
          {fonts.map(f => (
            <option key={f.name} value={f.name}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Font color + BG color row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Text Color</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="color"
              value={style.font_color}
              onChange={e => set('font_color', e.target.value)}
              style={{ width: 24, height: 24, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{style.font_color}</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>BG Color</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="color"
              value={style.bg_color}
              onChange={e => set('bg_color', e.target.value)}
              style={{ width: 24, height: 24, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{style.bg_color}</span>
          </div>
        </div>
      </div>

      {/* BG opacity */}
      <div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>
          BG Opacity: {Math.round(style.bg_opacity * 100)}%
        </div>
        <input
          type="range"
          min={0} max={1} step={0.05}
          value={style.bg_opacity}
          onChange={e => set('bg_opacity', parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#6366f1' }}
        />
      </div>

      {/* Font size */}
      <div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>
          Font Size: {style.font_size}
        </div>
        <input
          type="range"
          min={24} max={120} step={2}
          value={style.font_size}
          onChange={e => set('font_size', parseInt(e.target.value))}
          style={{ width: '100%', accentColor: '#6366f1' }}
        />
      </div>

      {/* BG width */}
      <div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>
          BG Width: {Math.round((style.bg_width ?? 0.88) * 100)}%
        </div>
        <input
          type="range"
          min={0.15} max={1} step={0.01}
          value={style.bg_width ?? 0.88}
          onChange={e => set('bg_width', parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#6366f1' }}
        />
      </div>
    </div>
  )
}

// ── Per-card music strip: mood + title + inline <audio> ──────────────────────
function TemplateMusicRow({ music, musicId }) {
  const [track, setTrack] = useState(music || null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (music?.file_url) { setTrack(music); return }
    if (!musicId) return
    setLoading(true)
    musicApi.byId(musicId)
      .then(res => { if (res?.success && res?.data?.music) setTrack(res.data.music) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [musicId, music?.file_url])

  if (!track && !loading) return null
  return (
    <div style={{ padding: '4px 10px 0' }}>
      <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 600, marginBottom: 2 }}>
        {loading ? 'Loading music…' : `${track?.mood || 'Music'} · ${(track?.title || '').slice(0, 28)}`}
      </div>
      {track?.file_url && (
        <audio controls preload="none" src={track.file_url} style={{ width: '100%', height: 24 }} />
      )}
    </div>
  )
}

// ── Per-template card (controlled caption from parent) ─────────────────────────
function TemplateCard({ template, caption, onCaptionChange, fonts, userEmail, waitForOutput, music }) {
  const [generating, setGenerating] = useState(false)
  const [outputUrl, setOutputUrl] = useState(null)
  const [err, setErr] = useState('')
  const [style, setStyle] = useState({ ...DEFAULT_STYLE })
  const [position, setPosition] = useState({ ...DEFAULT_POS })
  const [showStyle, setShowStyle] = useState(false)

  // Per-card product video
  const [productVideoUrl, setProductVideoUrl] = useState(null)
  const [productUploading, setProductUploading] = useState(false)
  const [productUploadErr, setProductUploadErr] = useState('')
  const [showProduct, setShowProduct] = useState(false)
  const productInputRef = useRef(null)

  // Reset output when caption changes
  useEffect(() => { setOutputUrl(null) }, [caption])

  async function handleProductUpload(file) {
    if (!file) return
    setProductUploading(true)
    setProductUploadErr('')
    try {
      const res = await broll.uploadProductVideo(file)
      if (res?.success && res.data?.url) {
        setProductVideoUrl(res.data.url)
      } else {
        setProductUploadErr(res?.message || 'Upload failed')
      }
    } catch (e) {
      setProductUploadErr(e.message)
    } finally {
      setProductUploading(false)
    }
  }

  async function handleGenerate() {
    if (!caption.trim()) return
    setGenerating(true)
    setErr('')
    setOutputUrl(null)
    try {
      const res = await broll.getOutput(
        template.id, caption.trim(),
        { ...style, text_x: position.x, text_y: position.y },
        userEmail,
        music?.id || null,
        music?.startSeconds || null,
        music?.durationSeconds || null,
        productVideoUrl || null,
      )
      if (!res.success) throw new Error(res.message || 'Failed to start generation')
      const { job_id } = res.data
      const result = await waitForOutput(job_id)
      setOutputUrl(result.url)
    } catch (e) {
      setErr(e.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{
      background: '#0f1117',
      border: '1.5px solid #2a2d3e',
      borderRadius: 12,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Video with live caption preview */}
      <VideoPreview
        videoUrl={template.video_url}
        caption={caption}
        style={style}
        position={position}
        onPositionChange={setPosition}
        onStyleChange={setStyle}
      />

      {/* Score badge */}
      {template.score != null && (
        <div style={{ padding: '4px 10px', fontSize: 11, color: '#64748b' }}>
          {typeof template.score === 'number' ? template.score.toFixed(0) : template.score}/100
        </div>
      )}

      {/* Per-card music (LLM-picked) */}
      {(template.music?.file_url || template.music_id) && (
        <TemplateMusicRow music={template.music} musicId={template.music_id} />
      )}

      {/* Caption textarea — controlled */}
      <div style={{ padding: '8px 10px 0' }}>
        {!caption && (
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="spinner" style={{ width: 10, height: 10 }} /> Generating caption…
          </div>
        )}
        <textarea
          className="textarea"
          rows={2}
          value={caption}
          onChange={e => onCaptionChange(e.target.value)}
          placeholder="Caption…"
          style={{ width: '100%', fontSize: 12, minHeight: 52, boxSizing: 'border-box' }}
        />
      </div>

      {/* Style toggle */}
      <div style={{ padding: '4px 10px 0' }}>
        <button
          onClick={() => setShowStyle(v => !v)}
          style={{
            background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer',
            fontSize: 11, padding: 0, display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {showStyle ? '▾' : '▸'} Style
          <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: 2,
            background: style.font_color, border: '1px solid #2a2d3e',
          }} />
          <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: 2,
            background: style.bg_color, opacity: style.bg_opacity, border: '1px solid #2a2d3e',
          }} />
        </button>
      </div>

      {/* Style panel */}
      {showStyle && (
        <CaptionStylePanel
          style={style}
          onChange={setStyle}
          fonts={fonts}
          onResetPosition={() => setPosition({ ...DEFAULT_POS })}
        />
      )}

      {/* Product video toggle + section */}
      <div style={{ padding: '4px 10px 0' }}>
        <button
          onClick={() => setShowProduct(v => !v)}
          style={{
            background: 'none', border: 'none', color: productVideoUrl ? '#6366f1' : '#64748b',
            cursor: 'pointer', fontSize: 11, padding: 0,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {showProduct ? '▾' : '▸'} Product Video
          {productVideoUrl && <span style={{ color: '#6366f1' }}>✓</span>}
        </button>
      </div>

      {showProduct && (
        <div style={{ padding: '6px 10px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {productVideoUrl ? (
            <>
              <video
                src={productVideoUrl}
                controls
                style={{ width: '100%', borderRadius: 6, display: 'block', maxHeight: 120, background: '#000' }}
              />
              <button
                onClick={() => { setProductVideoUrl(null); setProductUploadErr('') }}
                style={{
                  alignSelf: 'flex-start', padding: '3px 10px', borderRadius: 5,
                  border: '1px solid #ef4444', background: 'transparent',
                  color: '#ef4444', fontSize: 10, cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </>
          ) : (
            <>
              <input
                ref={productInputRef}
                type="file"
                accept="video/*"
                style={{ fontSize: 11, color: '#cbd5e1' }}
                onChange={e => {
                  const f = e.target.files[0]
                  if (f) handleProductUpload(f)
                }}
              />
              {productUploading && (
                <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="spinner" style={{ width: 10, height: 10 }} /> Uploading…
                </div>
              )}
              {productUploadErr && <div style={{ fontSize: 11, color: '#f87171' }}>{productUploadErr}</div>}
            </>
          )}
        </div>
      )}

      {/* Generate button */}
      <div style={{ padding: '6px 10px 10px' }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%', fontSize: 12 }}
          onClick={handleGenerate}
          disabled={generating || !caption.trim()}
        >
          {generating
            ? <><span className="spinner" style={{ width: 11, height: 11, marginRight: 6 }} />Processing…</>
            : outputUrl ? 'Regenerate' : 'Generate'}
        </button>
        {err && <div className="err" style={{ marginTop: 4, fontSize: 11 }}>{err}</div>}
      </div>

      {/* Output video */}
      {outputUrl && (
        <div style={{ borderTop: '1px solid #2a2d3e', padding: '10px' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Output</div>
          <video
            src={outputUrl}
            controls
            style={{ width: '100%', borderRadius: 6, display: 'block' }}
          />
          <a
            href={outputUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-sm"
            style={{ marginTop: 8, width: '100%', textAlign: 'center', display: 'block', boxSizing: 'border-box' }}
          >
            Download
          </a>
        </div>
      )}
    </div>
  )
}

// ── Section: title + card grid + Generate All ──────────────────────────────────
function TemplateSection({ title, templates, fonts, userEmail, waitForOutput, music }) {
  // Lift captions here so Generate All always sees current values
  const [captions, setCaptions] = useState({})
  const [genAllLoading, setGenAllLoading] = useState(false)
  const [genAllOutputs, setGenAllOutputs] = useState({})
  const [genAllErr, setGenAllErr] = useState('')

  // Sync captions from templates when they arrive / update.
  // This MERGES so a user's in-progress edit isn't wiped by a late partial,
  // and an empty-string caption (placeholder during streaming) never overwrites
  // the real caption that comes from a later partial update.
  useEffect(() => {
    setCaptions(prev => {
      const next = { ...prev }
      for (const t of templates) {
        const existing = next[t.id]
        const incoming = t.caption || ''
        // Keep existing value unless:
        //   - we've never seen this template (seed with incoming)
        //   - incoming is non-empty AND existing is empty (caption just arrived)
        if (existing === undefined) next[t.id] = incoming
        else if (!existing && incoming) next[t.id] = incoming
      }
      return next
    })
  }, [templates])

  function setCaption(id, value) {
    setCaptions(prev => ({ ...prev, [id]: value }))
    setGenAllOutputs(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  async function handleGenerateAll() {
    setGenAllLoading(true)
    setGenAllErr('')
    setGenAllOutputs({})
    try {
      // POST all jobs first, collect job_ids
      const jobPosts = await Promise.all(
        templates.map(t => broll.getOutput(
          t.id, (captions[t.id] || '').trim(), null, userEmail,
          music?.id || null, music?.startSeconds || null, music?.durationSeconds || null,
        ))
      )
      // Then wait for all WebSocket notifications
      const results = await Promise.allSettled(
        jobPosts.map((res, i) => {
          if (!res.success) return Promise.reject(new Error(res.message || 'Failed to start'))
          return waitForOutput(res.data.job_id).then(r => ({ id: templates[i].id, url: r.url }))
        })
      )
      const outputs = {}
      results.forEach(r => {
        if (r.status === 'fulfilled') outputs[r.value.id] = r.value.url
      })
      setGenAllOutputs(outputs)
    } catch (e) {
      setGenAllErr(e.message)
    } finally {
      setGenAllLoading(false)
    }
  }

  if (!templates.length) return null

  const allHaveCaptions = templates.every(t => (captions[t.id] || '').trim())

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          {title}
        </div>
        <button
          className="btn btn-primary"
          style={{ fontSize: 12, padding: '6px 14px' }}
          onClick={handleGenerateAll}
          disabled={genAllLoading || !allHaveCaptions}
        >
          {genAllLoading
            ? <><span className="spinner" style={{ width: 11, height: 11, marginRight: 6 }} />Processing all…</>
            : `Generate All (${templates.length})`}
        </button>
      </div>
      {genAllErr && <div className="err" style={{ marginBottom: 10 }}>{genAllErr}</div>}

      {/* Card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {templates.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            caption={captions[t.id] ?? ''}
            onCaptionChange={val => setCaption(t.id, val)}
            fonts={fonts}
            userEmail={userEmail}
            waitForOutput={waitForOutput}
            music={music}
          />
        ))}
      </div>

      {/* Generate All outputs (shown below grid, only if any) */}
      {Object.keys(genAllOutputs).length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>
            All Outputs
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {templates.filter(t => genAllOutputs[t.id]).map(t => (
              <div key={t.id} style={{ background: '#0f1117', border: '1.5px solid #2a2d3e', borderRadius: 12, overflow: 'hidden' }}>
                <video
                  src={genAllOutputs[t.id]}
                  controls
                  style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block' }}
                />
                <div style={{ padding: '6px 10px 10px' }}>
                  <a
                    href={genAllOutputs[t.id]}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', textAlign: 'center', display: 'block', boxSizing: 'border-box' }}
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const FREEPIK_MOODS = [
  'Dark','Dramatic','Elegant','Energetic','Epic','Exciting','Groovy',
  'Happy','Hopeful','Laid Back','Melancholic','Peaceful','Playful',
  'Sad','Sentimental','Soulful','Tension','Upbeat',
]

// ── Music section ──────────────────────────────────────────────────────────────
function MusicSection({ email, selectedMusic, onSelect, musicStart, musicDuration, onStartChange, onDurationChange }) {
  const [tab, setTab] = useState('catalog')
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(false)
  const [moodFilter, setMoodFilter] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadMood, setUploadMood] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null)
  const uploadInputRef = useRef(null)
  const [playingId, setPlayingId] = useState(null)
  const audioRef = useRef(null)

  useEffect(() => {
    if (tab === 'upload') return
    setLoading(true)
    setTracks([])
    const params = { limit: 100 }
    if (moodFilter) params.mood = moodFilter
    if (tab === 'mine') params.email = email
    else params.source = 'freepik-seeder'
    musicApi.list(params)
      .then(res => { if (res?.data?.music) setTracks(res.data.music) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tab, moodFilter, email])

  function togglePlay(track) {
    if (!audioRef.current) return
    if (playingId === track.id) {
      audioRef.current.pause()
      setPlayingId(null)
    } else {
      audioRef.current.pause()
      audioRef.current.src = track.file_url
      audioRef.current.play().catch(() => {})
      setPlayingId(track.id)
    }
  }

  async function handleUpload() {
    if (!uploadFile || !email) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const res = await musicApi.upload(uploadFile, email, uploadTitle, '', uploadMood, '')
      if (res?.success) {
        setUploadMsg({ ok: true, text: `Uploaded: ${res.data?.music?.title || uploadTitle || 'track'}` })
        setUploadFile(null); setUploadTitle(''); setUploadMood('')
        if (uploadInputRef.current) uploadInputRef.current.value = ''
      } else {
        setUploadMsg({ ok: false, text: res?.message || 'Upload failed' })
      }
    } catch (e) {
      setUploadMsg({ ok: false, text: e.message })
    } finally {
      setUploading(false)
    }
  }

  const tabBtn = (key, label) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      style={{
        padding: '4px 12px', borderRadius: 6, border: '1px solid',
        borderColor: tab === key ? '#6366f1' : '#2a2d3e',
        background: tab === key ? '#6366f1' : 'transparent',
        color: tab === key ? '#fff' : '#94a3b8',
        fontSize: 11, cursor: 'pointer',
      }}
    >{label}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} style={{ display: 'none' }} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tabBtn('catalog', 'Catalog')}
        {tabBtn('mine', 'My Uploads')}
        {tabBtn('upload', 'Upload Track')}
      </div>

      {/* Mood filter */}
      {tab !== 'upload' && (
        <select
          value={moodFilter}
          onChange={e => setMoodFilter(e.target.value)}
          style={{ padding: '4px 6px', fontSize: 11, background: '#1a1d2e', color: '#e2e8f0', border: '1px solid #2a2d3e', borderRadius: 4, outline: 'none' }}
        >
          <option value="">All moods</option>
          {FREEPIK_MOODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      )}

      {/* Track list */}
      {tab !== 'upload' && (
        loading
          ? <div style={{ color: '#64748b', fontSize: 12 }}><span className="spinner" style={{ width: 11, height: 11, marginRight: 6 }} />Loading…</div>
          : tracks.length === 0
            ? <div style={{ fontSize: 12, color: '#475569' }}>{tab === 'mine' ? 'No uploads yet.' : 'No tracks found.'}</div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
                {tracks.map(t => {
                  const isSel = selectedMusic?.id === t.id
                  const isPlay = playingId === t.id
                  const dur = t.duration_seconds
                    ? `${Math.floor(t.duration_seconds / 60)}:${String(t.duration_seconds % 60).padStart(2, '0')}`
                    : ''
                  return (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 8px', borderRadius: 6, border: '1px solid',
                      borderColor: isSel ? '#6366f1' : '#2a2d3e',
                      background: isSel ? '#1a1c3a' : '#0f1117',
                    }}>
                      <button
                        onClick={() => togglePlay(t)}
                        style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
                      >{isPlay ? '⏸' : '▶'}</button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title || 'Untitled'}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          {[t.mood, t.genre, dur].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <button
                        onClick={() => onSelect(isSel ? null : t)}
                        style={{
                          padding: '3px 9px', borderRadius: 5, border: '1px solid', flexShrink: 0,
                          borderColor: isSel ? '#6366f1' : '#2a2d3e',
                          background: isSel ? '#6366f1' : 'transparent',
                          color: isSel ? '#fff' : '#94a3b8',
                          fontSize: 10, cursor: 'pointer',
                        }}
                      >{isSel ? 'Selected' : 'Use'}</button>
                    </div>
                  )
                })}
              </div>
            )
      )}

      {/* Upload tab */}
      {tab === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div className="label">Audio File <span style={{ color: '#64748b' }}>(mp3, wav, aac, m4a)</span></div>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".mp3,.wav,.aac,.m4a,.ogg,.flac,audio/*"
              style={{ width: '100%', fontSize: 12, color: '#cbd5e1' }}
              onChange={e => { setUploadFile(e.target.files[0] || null); setUploadMsg(null) }}
            />
          </div>
          <div>
            <div className="label">Title <span style={{ color: '#64748b' }}>(optional)</span></div>
            <input className="input" placeholder="e.g. Upbeat Morning" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} />
          </div>
          <div>
            <div className="label">Mood <span style={{ color: '#64748b' }}>(optional)</span></div>
            <select
              value={uploadMood}
              onChange={e => setUploadMood(e.target.value)}
              style={{ width: '100%', padding: '4px 6px', fontSize: 11, background: '#1a1d2e', color: '#e2e8f0', border: '1px solid #2a2d3e', borderRadius: 4, outline: 'none' }}
            >
              <option value="">Select mood</option>
              {FREEPIK_MOODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {uploadMsg && (
            <div style={{ fontSize: 12, color: uploadMsg.ok ? '#4ade80' : '#f87171', background: uploadMsg.ok ? '#0f2b1a' : '#2b0f0f', borderRadius: 6, padding: '6px 10px' }}>
              {uploadMsg.text}
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!uploadFile || !email || uploading}
            style={{ fontSize: 12 }}
          >
            {uploading ? <><span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} />Uploading…</> : 'Upload Track'}
          </button>
        </div>
      )}

      {/* Clip controls when track is selected */}
      {selectedMusic && tab !== 'upload' && (
        <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #2a2d3e', background: '#0a0d1a' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Clip — {selectedMusic.title}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Start (sec)</div>
              <input
                type="number" min={0} value={musicStart}
                onChange={e => onStartChange(parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '4px 6px', fontSize: 11, background: '#1a1d2e', color: '#e2e8f0', border: '1px solid #2a2d3e', borderRadius: 4, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Duration (sec)</div>
              <input
                type="number" min={1} placeholder="full track"
                value={musicDuration || ''}
                onChange={e => onDurationChange(e.target.value ? parseInt(e.target.value) : null)}
                style={{ width: '100%', padding: '4px 6px', fontSize: 11, background: '#1a1d2e', color: '#e2e8f0', border: '1px solid #2a2d3e', borderRadius: 4, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BrollStudio({ email = '' }) {
  const [hasResults, setHasResults] = useState(false)
  const [fonts, setFonts] = useState([
    { name: 'Liberation Sans', label: 'Sans Serif (default)' },
  ])

  useEffect(() => {
    broll.captionOptions()
      .then(res => { if (res?.data?.fonts) setFonts(res.data.fonts) })
      .catch(() => {})
  }, [])

  // ── Poll /output-status/{job_id} until done or failed ──────────────────────
  async function waitForOutput(job_id) {
    // ffmpeg + S3 upload can exceed 3 min on long clips with music loops,
    // especially when rendering on a shared worker. 5 min with 3 s polling.
    const maxAttempts = 100  // 100 × 3 s = 5 minutes
    const interval    = 3000
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, interval))
      let res
      try { res = await broll.outputStatus(job_id) } catch (_) { continue }
      if (res?.success && res.data?.status === 'done')   return res.data
      if (res?.success && res.data?.status === 'failed') throw new Error(res.data.error || 'Generation failed')
    }
    throw new Error('Generation timed out')
  }

  const [context, setContext]             = useState('')
  const [brollTemplates, setBrollTemplates] = useState([])
  const [memeTemplates, setMemeTemplates]   = useState([])
  const [userTemplates, setUserTemplates]   = useState([])
  const [brollLoading, setBrollLoading]     = useState(false)
  const [memeLoading, setMemeLoading]       = useState(false)
  const [userLoading, setUserLoading]       = useState(false)
  const [err, setErr]                       = useState('')

  // Upload state
  const [uploadFile, setUploadFile]   = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadType, setUploadType]   = useState('broll')
  const [uploading, setUploading]     = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const fileInputRef = useRef(null)

  // Music state
  const [selectedMusic, setSelectedMusic] = useState(null)  // {id, title, mood, duration_seconds}
  const [musicStart, setMusicStart]       = useState(0)
  const [musicDuration, setMusicDuration] = useState(null)

  // v2 pipeline state
  const [brollTypesList, setBrollTypesList] = useState([])
  const [selectedBrollType, setSelectedBrollType] = useState('cinematic_aesthetic')
  const [brandProducts, setBrandProducts] = useState([])
  const [selectedProductIds, setSelectedProductIds] = useState([])  // [] means all
  const [v2Templates, setV2Templates] = useState([])
  const [v2Loading, setV2Loading] = useState(false)
  const ignoredQueriesRef = useRef([])  // accumulates across Generate More calls

  // Persistent history — past v2 runs + past final rendered videos
  const [pastV2Runs, setPastV2Runs] = useState([])
  const [pastGenerated, setPastGenerated] = useState([])

  useEffect(() => {
    broll.brollTypes()
      .then(res => { if (res?.success && Array.isArray(res.data)) setBrollTypesList(res.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!email) return
    broll.myBrandProducts(email)
      .then(res => { if (res?.success && Array.isArray(res.data?.products)) setBrandProducts(res.data.products) })
      .catch(() => {})
  }, [email])

  // Load past v2 runs + past generated videos on mount / email change.
  // This guarantees the user always sees prior work even after a hard refresh.
  useEffect(() => {
    if (!email) return
    broll.recommendationRuns(email, { recommendType: 'broll_v2', limit: 10 })
      .then(res => {
        const runs = res?.data?.runs || []
        setPastV2Runs(runs.filter(r => r.status === 'done' && Array.isArray(r.templates)))
      })
      .catch(() => {})
    broll.myGenerated(email, { limit: 50 })
      .then(res => {
        const vids = res?.data?.videos || []
        setPastGenerated(vids)
      })
      .catch(() => {})
  }, [email])

  // Track pending job_ids so the socket handler can route results.
  // Value shape: { type: 'broll' | 'meme' | 'user' | 'v2', gotPartial?: boolean }
  const pendingJobs = useRef({})

  // Socket listener — join email room once, handle broll_recommend_ready events
  useEffect(() => {
    if (!email) return
    joinRoom(email)
    const sock = getSocket()

    function handleRecommendReady(payload) {
      const { job_id, status, templates, template, suggested_music, search_queries_used } = payload.data || {}
      const entry = pendingJobs.current[job_id]
      // Route even if we missed the outbound POST (e.g. page reload): treat any v2
      // event as a v2 stream so videos still render.
      const recommendType = payload.data?.recommend_type
      const type = entry?.type || (recommendType === 'broll_v2' ? 'v2' : null)
      if (!type) return

      // --- Partial (v2 only) ------------------------------------------------
      //
      // Two kinds of partials can arrive per template:
      //   1. Video ingested  → caption: "" (placeholder), default music
      //   2. Caption resolved → full caption + LLM-picked music
      // Both use the same template.id, so we UPDATE in place rather than
      // append — otherwise the caption-only update would overwrite the video
      // row or create a duplicate.
      if (status === 'partial' && template && type === 'v2') {
        setV2Loading(false)  // first partial → flip off the spinner, show cards
        setHasResults(true)  // a job we didn't initiate (e.g. after reload) still renders
        setV2Templates(prev => {
          const idx = prev.findIndex(t => t.id === template.id)
          if (idx === -1) return [...prev, template]
          const next = prev.slice()
          // Merge so fields from either partial don't overwrite each other with
          // empty strings (e.g. caption='' from video-ingest must not clobber
          // an existing caption from a prior caption-ready partial).
          const existing = prev[idx]
          next[idx] = {
            ...existing,
            ...template,
            caption: template.caption || existing.caption || '',
            music_id: template.music_id || existing.music_id || null,
            music: template.music || existing.music || null,
          }
          return next
        })
        if (entry) entry.gotPartial = true
        return  // don't delete — more events still coming
      }

      // --- Queries-ready is informational; don't clear state ---------------
      if (status === 'queries_ready') {
        return
      }

      // --- Terminal events (done / failed) ---------------------------------
      if (status === 'done' || status === 'failed') {
        delete pendingJobs.current[job_id]
        if (type === 'broll') { setBrollLoading(false); if (status === 'done') setBrollTemplates(templates || []) }
        if (type === 'meme')  { setMemeLoading(false);  if (status === 'done') setMemeTemplates(templates || []) }
        if (type === 'user')  { setUserLoading(false);  if (status === 'done') setUserTemplates(templates || []) }
        if (type === 'v2') {
          setV2Loading(false)
          if (status === 'done') {
            setHasResults(true)
            // Replace with the fully-captioned payload from Inference 2.
            // If we never got a partial (e.g. direct done), this is also a clean
            // render of the full batch.
            setV2Templates(templates || [])
            if (Array.isArray(search_queries_used)) {
              ignoredQueriesRef.current = Array.from(new Set([
                ...(ignoredQueriesRef.current || []),
                ...search_queries_used,
              ]))
            }
          }
        }

        // Auto-suggest music if none selected yet
        if (suggested_music?.id && !selectedMusic) {
          setSelectedMusic(suggested_music)
          setMusicStart(0)
          setMusicDuration(null)
        }
      }
    }

    function handleOutputReady(payload) {
      const { job_id, status, url, caption } = payload.data || {}
      if (status === 'done' && url) {
        setPastGenerated(prev => {
          if (prev.some(v => v.id === job_id)) return prev
          return [{ id: job_id, url, caption, status: 'done', completed_at: new Date().toISOString() }, ...prev]
        })
      }
    }

    function handleProgress(payload) {
      if (payload?.event === 'broll_recommend_ready') return handleRecommendReady(payload)
      if (payload?.event === 'broll_output_ready')    return handleOutputReady(payload)
    }

    sock.on('live_progress', handleProgress)
    return () => sock.off('live_progress', handleProgress)
  }, [email])

  async function handleFind() {
    if (!email.trim()) {
      setErr('No email — go back and log in.')
      return
    }
    setErr('')
    setHasResults(true)
    setBrollTemplates([])
    setMemeTemplates([])
    setUserTemplates([])
    setBrollLoading(true)
    setMemeLoading(true)
    setUserLoading(true)
    pendingJobs.current = {}

    broll.recommendOriginal(email, context.trim())
      .then(res => {
        if (res?.data?.job_id) pendingJobs.current[res.data.job_id] = { type: 'broll' }
        else setBrollLoading(false)
      })
      .catch(() => setBrollLoading(false))

    broll.recommendMemeOriginal(email, context.trim())
      .then(res => {
        if (res?.data?.job_id) pendingJobs.current[res.data.job_id] = { type: 'meme' }
        else setMemeLoading(false)
      })
      .catch(() => setMemeLoading(false))

    broll.recommendUserGivenOriginal(email, context.trim())
      .then(res => {
        if (res?.data?.job_id) pendingJobs.current[res.data.job_id] = { type: 'user' }
        else setUserLoading(false)
      })
      .catch(() => setUserLoading(false))
  }

  async function handleFindV2({ reset = true } = {}) {
    if (!email.trim()) {
      setErr('No email — go back and log in.')
      return
    }
    setErr('')
    setHasResults(true)
    if (reset) {
      setV2Templates([])
      ignoredQueriesRef.current = []
    }
    setV2Loading(true)

    try {
      const res = await broll.recommendV2(email, {
        brollType: selectedBrollType,
        productIds: selectedProductIds,
        context: context.trim(),
        count: 6,
        ignoreQueries: reset ? [] : ignoredQueriesRef.current,
      })
      if (res?.data?.job_id) pendingJobs.current[res.data.job_id] = { type: 'v2' }
      else { setV2Loading(false); setErr(res?.message || 'Failed to start v2 job') }
    } catch (e) {
      setV2Loading(false)
      setErr(e?.message || 'Failed to start v2 job')
    }
  }

  function toggleProduct(id) {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleUpload() {
    if (!uploadFile) return
    setUploading(true)
    setUploadResult(null)
    try {
      const res = await broll.uploadTemplate(uploadFile, uploadTitle.trim(), email.trim(), uploadType)
      if (res?.success) {
        setUploadResult({ success: true, description: res.data?.description, title: res.data?.title })
        setUploadFile(null)
        setUploadTitle('')
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        setUploadResult({ success: false, error: res?.message || 'Upload failed' })
      }
    } catch (e) {
      setUploadResult({ success: false, error: e.message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {/* ── Form ── */}
      <div className="card">
        <div className="card-title">B-Roll Studio</div>
        <div className="col" style={{ gap: 14 }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Brand: <strong style={{ color: '#e2e8f0' }}>{email || '(no email)'}</strong>
          </div>
          <div>
            <div className="label">Context <span style={{ color: '#64748b' }}>(optional)</span></div>
            <input
              className="input"
              placeholder="e.g. summer campaign, product launch, festive sale"
              value={context}
              onChange={e => setContext(e.target.value)}
            />
          </div>
          {err && <div className="err">{err}</div>}
          <div>
            <button className="btn btn-primary" onClick={handleFind} disabled={brollLoading || memeLoading || !email}>
              {(brollLoading || memeLoading)
                ? <><span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} />Finding…</>
                : hasResults ? 'Refresh' : 'Find Templates'}
            </button>
          </div>
        </div>
      </div>

      {/* ── My Generated Videos (persistent history) ── */}
      {pastGenerated.length > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="card-title">My Generated Videos ({pastGenerated.length})</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
            Past renders from <code>get-output</code>. Updates live when a new render finishes.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {pastGenerated.map(v => (
              <div key={v.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                {v.url
                  ? <video src={v.url} controls playsInline style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', background: '#000' }} />
                  : (
                    <div style={{ width: '100%', aspectRatio: '9/16', display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 12, background: '#f8fafc' }}>
                      {v.status === 'failed' ? `Failed${v.error ? `: ${v.error}` : ''}` : 'Processing…'}
                    </div>
                  )
                }
                {v.caption && (
                  <div style={{ padding: '8px 10px', fontSize: 11, color: '#334155', lineHeight: 1.4, maxHeight: 64, overflow: 'hidden' }}>{v.caption}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Past v2 Runs (history) ── */}
      {pastV2Runs.length > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="card-title">Past v2 Generations ({pastV2Runs.length})</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
            Saved recommend-v2 runs. Click a run to load it back into the editor below.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pastV2Runs.map(run => {
              const ts = run.created_at ? new Date(run.created_at).toLocaleString() : ''
              const tplCount = (run.templates || []).length
              const isActive = run.job_id && v2Templates.length > 0 &&
                run.templates?.[0]?.id === v2Templates[0]?.id
              return (
                <div key={run.job_id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, background: isActive ? '#eef2ff' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#475569' }}>
                      <span style={{ fontWeight: 600 }}>{tplCount} clips</span> · {ts}
                      {run.context && <span style={{ marginLeft: 6, color: '#94a3b8' }}>· "{run.context.slice(0, 40)}"</span>}
                    </div>
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => { setV2Templates(run.templates || []); setHasResults(true) }}
                    >
                      {isActive ? 'Active' : 'Load'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 4 }}>
                    {(run.templates || []).slice(0, 8).map(t => (
                      <video key={t.id} src={t.video_url} muted playsInline preload="metadata"
                        style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', background: '#000', borderRadius: 4 }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Live Pexels Pipeline (v2) ── */}
      <div className="card" style={{ marginTop: 8 }}>
        <div className="card-title">Live Pexels Pipeline (v2)</div>
        <div className="col" style={{ gap: 14 }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Generates fresh Pexels clips tailored to an ad style + selected products. Captions
            and music are picked per-video by a second LLM pass.
          </div>

          <div>
            <div className="label">Ad Type</div>
            <select
              className="input"
              value={selectedBrollType}
              onChange={e => setSelectedBrollType(e.target.value)}
              style={{ width: '100%', padding: '8px 10px' }}
            >
              {brollTypesList.length === 0
                ? <option value="cinematic_aesthetic">Cinematic Aesthetic</option>
                : brollTypesList.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))
              }
            </select>
            {brollTypesList.find(t => t.id === selectedBrollType)?.hint && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {brollTypesList.find(t => t.id === selectedBrollType).hint}
              </div>
            )}
          </div>

          {brandProducts.length > 0 && (
            <div>
              <div className="label">Products <span style={{ color: '#64748b' }}>(leave blank = all)</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {brandProducts.map(p => (
                  <label
                    key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 14,
                      border: '1px solid',
                      borderColor: selectedProductIds.includes(p.id) ? '#6366f1' : '#2a2d3e',
                      background: selectedProductIds.includes(p.id) ? 'rgba(99,102,241,0.15)' : 'transparent',
                      fontSize: 12, cursor: 'pointer', color: '#cbd5e1',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    {p.name || p.id}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => handleFindV2({ reset: true })} disabled={v2Loading || !email}>
              {v2Loading
                ? <><span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} />Generating…</>
                : v2Templates.length > 0 ? 'Refresh v2' : 'Find Templates (v2)'}
            </button>
            {v2Templates.length > 0 && (
              <button className="btn btn-outline" onClick={() => handleFindV2({ reset: false })} disabled={v2Loading}>
                Generate More
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Upload your template ── */}
      <div className="card" style={{ marginTop: 8 }}>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#94a3b8', userSelect: 'none' }}>
            Upload Your Template
          </summary>
          <div className="col" style={{ gap: 12, marginTop: 12 }}>
            <div>
              <div className="label">Video File <span style={{ color: '#64748b' }}>(MP4, MOV, WEBM)</span></div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                style={{ width: '100%', fontSize: 12, color: '#cbd5e1' }}
                onChange={e => { setUploadFile(e.target.files[0] || null); setUploadResult(null) }}
              />
            </div>
            <div>
              <div className="label">Title <span style={{ color: '#64748b' }}>(optional)</span></div>
              <input
                className="input"
                placeholder="e.g. Sunset walk, Coffee morning"
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
              />
            </div>
            <div>
              <div className="label">Template Type</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['broll', 'meme'].map(t => (
                  <button
                    key={t}
                    onClick={() => setUploadType(t)}
                    style={{
                      padding: '5px 16px', borderRadius: 6, border: '1px solid',
                      borderColor: uploadType === t ? '#6366f1' : '#2a2d3e',
                      background: uploadType === t ? '#6366f1' : 'transparent',
                      color: uploadType === t ? '#fff' : '#94a3b8',
                      fontSize: 12, cursor: 'pointer', textTransform: 'capitalize',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {!email.trim() && (
              <div style={{ fontSize: 11, color: '#475569' }}>Log in with an email to tag this template to your account.</div>
            )}
            {uploadResult && (
              uploadResult.success
                ? <div style={{ fontSize: 12, color: '#4ade80', background: '#0f2b1a', borderRadius: 6, padding: '8px 12px' }}>
                    Uploaded! Gemini description: <em>{uploadResult.description}</em>
                  </div>
                : <div className="err">{uploadResult.error}</div>
            )}
            <div>
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                style={{ fontSize: 12 }}
              >
                {uploading
                  ? <><span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} />Uploading & Analysing…</>
                  : 'Upload Template'}
              </button>
            </div>
          </div>
        </details>
      </div>

      {/* ── Music ── */}
      <div className="card" style={{ marginTop: 8 }}>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#94a3b8', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            Music / Audio
            {selectedMusic && (
              <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 400, marginLeft: 4 }}>
                ♪ {selectedMusic.title}
              </span>
            )}
          </summary>
          <div style={{ marginTop: 12 }}>
            <MusicSection
              email={email}
              selectedMusic={selectedMusic}
              onSelect={t => { setSelectedMusic(t); setMusicStart(0); setMusicDuration(null) }}
              musicStart={musicStart}
              musicDuration={musicDuration}
              onStartChange={setMusicStart}
              onDurationChange={setMusicDuration}
            />
          </div>
        </details>
      </div>

      {/* ── Results ── */}
      {hasResults && (
        <div style={{ marginTop: 4 }}>

          {/* V2 Pipeline Results */}
          {(v2Loading || v2Templates.length > 0) && (
            <div style={{ marginBottom: 20 }}>
              {v2Loading && v2Templates.length === 0
                ? <div style={{ color: '#64748b', fontSize: 13 }}><span className="spinner" style={{ width: 12, height: 12, marginRight: 8 }} />Generating fresh Pexels clips…</div>
                : (
                  <>
                    <TemplateSection
                      title="Live Pexels (v2)"
                      templates={v2Templates}
                      fonts={fonts}
                      userEmail={email}
                      waitForOutput={waitForOutput}
                      music={selectedMusic ? { id: selectedMusic.id, startSeconds: musicStart, durationSeconds: musicDuration } : null}
                    />
                    <hr className="divider" />
                  </>
                )
              }
            </div>
          )}

          {/* User Uploaded Templates */}
          <div style={{ marginBottom: 20 }}>
            {userLoading
              ? <div style={{ color: '#64748b', fontSize: 13 }}><span className="spinner" style={{ width: 12, height: 12, marginRight: 8 }} />Loading your templates…</div>
              : userTemplates.length > 0
                ? <><TemplateSection title="Your Uploaded Templates" templates={userTemplates} fonts={fonts} userEmail={email} waitForOutput={waitForOutput} music={selectedMusic ? { id: selectedMusic.id, startSeconds: musicStart, durationSeconds: musicDuration } : null} /><hr className="divider" /></>
                : null
            }
          </div>

          {/* B-Roll Templates */}
          <div style={{ marginBottom: 20 }}>
            {brollLoading
              ? <div style={{ color: '#64748b', fontSize: 13 }}><span className="spinner" style={{ width: 12, height: 12, marginRight: 8 }} />Finding B-Roll templates…</div>
              : <TemplateSection title="B-Roll Templates" templates={brollTemplates} fonts={fonts} userEmail={email} waitForOutput={waitForOutput} music={selectedMusic ? { id: selectedMusic.id, startSeconds: musicStart, durationSeconds: musicDuration } : null} />
            }
          </div>

          {/* Meme Templates */}
          <div>
            {memeLoading
              ? <><hr className="divider" /><div style={{ color: '#64748b', fontSize: 13 }}><span className="spinner" style={{ width: 12, height: 12, marginRight: 8 }} />Finding Meme templates…</div></>
              : memeTemplates.length > 0
                ? <><hr className="divider" /><TemplateSection title="Meme Templates" templates={memeTemplates} fonts={fonts} userEmail={email} waitForOutput={waitForOutput} music={selectedMusic ? { id: selectedMusic.id, startSeconds: musicStart, durationSeconds: musicDuration } : null} /></>
                : null
            }
          </div>

        </div>
      )}
    </div>
  )
}
