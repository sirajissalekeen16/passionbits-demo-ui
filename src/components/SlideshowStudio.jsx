import { useState, useEffect, useRef, useCallback } from 'react'
import { slideshow } from '../api'
import { getSocket, joinRoom } from '../socket'

// ── Constants (mirrored from BrollStudio) ────────────────────────────────────
const DEFAULT_STYLE = {
  font_family: 'Liberation Sans',
  font_color: '#FFFFFF',
  font_size: 60,
  bg_color: '#000000',
  bg_opacity: 1.0,
  bg_width: 0.88,
}
const DEFAULT_POS = { x: 0.5, y: 0.58 }

const FONT_OPTIONS = [
  'Liberation Sans', 'Liberation Sans Narrow', 'Liberation Serif', 'Liberation Mono',
  'DejaVu Sans', 'DejaVu Sans Bold', 'Roboto', 'Roboto Bold',
  'Open Sans', 'Open Sans Bold', 'Noto Sans', 'Noto Sans Bold',
]
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

// ── Canvas helpers for ZIP download ─────────────────────────────────────────

function _wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w
    if (ctx.measureText(test).width <= maxWidth) {
      cur = test
    } else {
      if (cur) lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : [text]
}

async function _tryRender(imageUrl, text, style, position) {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#1a1d2e'
  ctx.fillRect(0, 0, W, H)

  if (imageUrl) {
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image()
        i.crossOrigin = 'anonymous'
        i.onload = () => res(i)
        i.onerror = rej
        i.src = imageUrl
      })
      const sc = Math.max(W / img.width, H / img.height)
      ctx.drawImage(img, (W - img.width * sc) / 2, (H - img.height * sc) / 2, img.width * sc, img.height * sc)
    } catch { /* CORS or load failure — proceed without image */ }
  }

  if (text.trim()) {
    const fs = style.font_size
    const isBold = style.font_family.toLowerCase().includes('bold')
    ctx.font = `${isBold ? 'bold ' : ''}${fs}px "Liberation Sans", Arial, sans-serif`
    const bgW = Math.round(style.bg_width * W)
    const padH = 50, padV = 20
    const lineH = Math.round(fs * 1.35)
    const lines = _wrapText(ctx, text, bgW - 2 * padH)
    const blockH = lines.length * lineH + 2 * padV
    const boxX = Math.round(position.x * W - bgW / 2)
    const boxY = Math.round(position.y * H - blockH / 2)

    const r = parseInt(style.bg_color.slice(1, 3), 16)
    const g = parseInt(style.bg_color.slice(3, 5), 16)
    const b = parseInt(style.bg_color.slice(5, 7), 16)
    ctx.fillStyle = `rgba(${r},${g},${b},${style.bg_opacity})`
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(boxX, boxY, bgW, blockH, 4)
    else ctx.rect(boxX, boxY, bgW, blockH)
    ctx.fill()

    ctx.fillStyle = style.font_color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    lines.forEach((line, i) => ctx.fillText(line, position.x * W, boxY + padV + i * lineH))
  }

  return new Promise((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('null blob')), 'image/png')
  )
}

async function renderSlideToBlob(imageUrl, text, style, position) {
  try {
    return await _tryRender(imageUrl, text, style, position)
  } catch {
    // Canvas tainted (CORS) — retry without image
    return _tryRender(null, text, style, position)
  }
}

// ── CaptionStylePanel ────────────────────────────────────────────────────────
function CaptionStylePanel({ style, onChange, onClose }) {
  const set = (k, v) => onChange({ ...style, [k]: v })
  return (
    <div style={{
      background: '#12151f', border: '1px solid #2a2d3e', borderRadius: 8,
      padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Caption Style
        </div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid #2a2d3e', color: '#64748b', fontSize: 9, padding: '2px 6px', borderRadius: 3, cursor: 'pointer' }}>
          Close
        </button>
      </div>

      {/* Font */}
      <div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Font</div>
        <select value={style.font_family} onChange={e => set('font_family', e.target.value)}
          style={{ width: '100%', padding: '4px 6px', fontSize: 11, background: '#1a1d2e', color: '#e2e8f0', border: '1px solid #2a2d3e', borderRadius: 4, outline: 'none' }}>
          {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Colors */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Text Color</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="color" value={style.font_color} onChange={e => set('font_color', e.target.value)}
              style={{ width: 24, height: 24, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
            <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{style.font_color}</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>BG Color</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="color" value={style.bg_color} onChange={e => set('bg_color', e.target.value)}
              style={{ width: 24, height: 24, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
            <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{style.bg_color}</span>
          </div>
        </div>
      </div>

      {/* BG Opacity */}
      <div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>BG Opacity: {Math.round(style.bg_opacity * 100)}%</div>
        <input type="range" min={0} max={1} step={0.05} value={style.bg_opacity}
          onChange={e => set('bg_opacity', parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#6366f1' }} />
      </div>

      {/* Font Size */}
      <div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Font Size: {style.font_size}</div>
        <input type="range" min={20} max={120} step={2} value={style.font_size}
          onChange={e => set('font_size', parseInt(e.target.value))}
          style={{ width: '100%', accentColor: '#6366f1' }} />
      </div>

      {/* BG Width */}
      <div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>BG Width: {Math.round((style.bg_width ?? 0.88) * 100)}%</div>
        <input type="range" min={0.15} max={1} step={0.01} value={style.bg_width ?? 0.88}
          onChange={e => set('bg_width', parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#6366f1' }} />
      </div>
    </div>
  )
}

// ── SlideCard ────────────────────────────────────────────────────────────────
const CORNERS = ['tl', 'tr', 'bl', 'br']

function SlideCard({ slide, index, text, onTextChange, style, position, onPositionChange, onStyleChange }) {
  const containerRef = useRef(null)
  const captionRef = useRef(null)
  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const resizing = useRef(false)
  const resizeStart = useRef({ mx: 0, startW: 0, isLeft: false })
  const [scale, setScale] = useState(0)
  const [showStyle, setShowStyle] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setScale(entries[0].contentRect.width / 1080))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onCornerDown = useCallback((e, corner) => {
    resizing.current = true
    resizeStart.current = { mx: e.clientX, startW: style.bg_width ?? 0.88, isLeft: corner === 'tl' || corner === 'bl' }
    e.stopPropagation()
    e.target.setPointerCapture(e.pointerId)
  }, [style.bg_width])

  const onPointerDown = useCallback((e) => {
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, px: position.x, py: position.y }
    e.currentTarget.setPointerCapture(e.pointerId)
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
  const bgWidth = style.bg_width ?? 0.88
  const fontCss = FONT_FALLBACK[style.font_family] || (style.font_family + ', sans-serif')
  const isBold = style.font_family.toLowerCase().includes('bold')

  const cornerStyle = (corner) => ({
    position: 'absolute',
    width: 12, height: 12, borderRadius: 3,
    background: 'white', border: '2px solid #6366f1',
    top: corner.startsWith('t') ? -6 : 'auto',
    bottom: corner.startsWith('b') ? -6 : 'auto',
    left: corner.endsWith('l') ? -6 : 'auto',
    right: corner.endsWith('r') ? -6 : 'auto',
    cursor: (corner === 'tl' || corner === 'br') ? 'nwse-resize' : 'nesw-resize',
    zIndex: 10, touchAction: 'none',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Slide {index + 1}
      </div>

      <div ref={containerRef} style={{
        position: 'relative', width: '100%', aspectRatio: '9/16',
        borderRadius: 12, overflow: 'hidden', background: '#1a1d2e',
        border: '1.5px solid #2a2d3e', flexShrink: 0,
      }}>
        {slide.image_url ? (
          <img src={slide.image_url} alt="" crossOrigin="anonymous"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a2d3e', fontSize: 11 }}>
            No image
          </div>
        )}

        {text.trim() && scale > 0 && (
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
            }}
          >
            {text}
            {CORNERS.map(corner => (
              <span key={corner} onPointerDown={e => onCornerDown(e, corner)} style={cornerStyle(corner)} />
            ))}
          </div>
        )}

        {text.trim() && (
          <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}>
            drag to reposition · drag corners to resize
          </div>
        )}
      </div>

      {/* Text + style toggle */}
      <textarea className="textarea" rows={2} value={text} onChange={e => onTextChange(e.target.value)}
        placeholder="Slide text…"
        style={{ fontSize: 12, width: '100%', boxSizing: 'border-box' }} />

      <button onClick={() => setShowStyle(s => !s)}
        style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 11, padding: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: style.bg_color, opacity: style.bg_opacity, border: '1px solid #2a2d3e' }} />
        {showStyle ? 'Hide style' : 'Caption style ▾'}
      </button>

      {showStyle && (
        <CaptionStylePanel style={style} onChange={onStyleChange} onClose={() => setShowStyle(false)} />
      )}

      {slide.search_term && (
        <div style={{ fontSize: 10, color: '#475569' }}>🔍 {slide.search_term}</div>
      )}
    </div>
  )
}

// ── My Slideshows ─────────────────────────────────────────────────────────────
function MySlideshows({ email, onLoad, refreshKey }) {
  const [list, setList] = useState([])

  useEffect(() => {
    if (!email) return
    slideshow.my(email).then(r => setList(r.data?.slideshows || [])).catch(() => {})
  }, [email, refreshKey])

  if (!list.length) return null

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="card-title">My Slideshows</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12 }}>
        {list.map(item => (
          <div key={item.id} onClick={() => onLoad(item.id)}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '9/16', borderRadius: 8, overflow: 'hidden', background: '#1a1d2e', border: '1.5px solid #2a2d3e' }}>
              {item.thumbnail
                ? <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a2d3e', fontSize: 10 }}>{item.slide_count} slides</div>
              }
              {item.status === 'processing' && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                </div>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.3 }}>
              {item.context || '(no context)'} · {item.slide_count} slides
            </div>
            <div style={{ fontSize: 9, color: '#475569' }}>
              {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SlideshowStudio({ email = '' }) {
  const [context, setContext]   = useState('')
  const [slides, setSlides]     = useState([])
  const [texts, setTexts]       = useState([])
  const [style, setStyle]       = useState(DEFAULT_STYLE)
  const [position, setPosition] = useState(DEFAULT_POS)
  const [loading, setLoading]   = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [err, setErr]           = useState('')
  const [currentJobId, setCurrentJobId] = useState(null)
  const [listRefreshKey, setListRefreshKey] = useState(0)

  const pendingJobId = useRef(null)
  const saveTimer = useRef(null)

  // ── Socket ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!email) return
    joinRoom(email)
    const sock = getSocket()

    function handleProgress(payload) {
      if (payload?.event !== 'slideshow_ready') return
      const { job_id, status, slides: newSlides, error } = payload.data || {}
      if (job_id !== pendingJobId.current) return
      pendingJobId.current = null
      setLoading(false)
      if (status === 'done') {
        const sl = newSlides || []
        setSlides(sl)
        setTexts(sl.map(s => s.text_content || ''))
        setStyle(DEFAULT_STYLE)
        setPosition(DEFAULT_POS)
        setCurrentJobId(job_id)
        setListRefreshKey(k => k + 1)
        // Persist initial style+position to DB
        slideshow.patch(job_id, email, sl, DEFAULT_STYLE, DEFAULT_POS).catch(() => {})
      } else {
        setErr(error || 'Slideshow generation failed')
      }
    }

    sock.on('live_progress', handleProgress)
    return () => sock.off('live_progress', handleProgress)
  }, [email])

  // ── Debounced auto-save ──────────────────────────────────────────────────────
  function scheduleSave(jobId, nextSlides, nextStyle, nextPosition, nextTexts) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const updatedSlides = nextSlides.map((s, i) => ({ ...s, text_content: nextTexts[i] ?? s.text_content }))
      slideshow.patch(jobId, email, updatedSlides, nextStyle, nextPosition).catch(() => {})
    }, 1500)
  }

  function handleStyleChange(newStyle) {
    setStyle(newStyle)
    if (currentJobId) scheduleSave(currentJobId, slides, newStyle, position, texts)
  }

  function handlePositionChange(newPos) {
    setPosition(newPos)
    if (currentJobId) scheduleSave(currentJobId, slides, style, newPos, texts)
  }

  function handleTextChange(i, val) {
    const next = [...texts]
    next[i] = val
    setTexts(next)
    if (currentJobId) scheduleSave(currentJobId, slides, style, position, next)
  }

  // ── Generate ─────────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!email.trim()) { setErr('No email — go back and log in.'); return }
    setErr('')
    setLoading(true)
    setSlides([])
    setTexts([])
    setCurrentJobId(null)
    try {
      const res = await slideshow.generateOriginal(email, context.trim())
      if (!res.success) throw new Error(res.message || 'Failed to start generation')
      pendingJobId.current = res.data.job_id
    } catch (e) {
      setErr(e.message)
      setLoading(false)
    }
  }

  // ── Load saved slideshow ──────────────────────────────────────────────────────
  async function handleLoad(id) {
    try {
      const res = await slideshow.get(id, email)
      if (!res.success) return
      const data = res.data
      const sl = data.slides || []
      setSlides(sl)
      setTexts(sl.map(s => s.text_content || ''))
      setStyle({ ...DEFAULT_STYLE, ...(data.style || {}) })
      setPosition({ ...DEFAULT_POS, ...(data.position || {}) })
      setCurrentJobId(id)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setErr('Failed to load slideshow: ' + e.message)
    }
  }

  // ── Download ZIP ─────────────────────────────────────────────────────────────
  async function handleDownload() {
    setDownloading(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      for (let i = 0; i < slides.length; i++) {
        const blob = await renderSlideToBlob(
          slides[i].image_url,
          texts[i] ?? slides[i].text_content ?? '',
          style,
          position,
        )
        if (blob) zip.file(`slide_${i + 1}.png`, blob)
      }
      const content = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(content)
      a.download = 'slideshow.zip'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setErr('Download failed: ' + e.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      {/* Generator form */}
      <div className="card">
        <div className="card-title">Slideshow Creator</div>
        <div className="col" style={{ gap: 14 }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Brand: <strong style={{ color: '#e2e8f0' }}>{email || '(no email)'}</strong>
          </div>
          <div>
            <div className="label">Context <span style={{ color: '#64748b' }}>(optional)</span></div>
            <input className="input"
              placeholder="e.g. product launch, festive campaign, brand awareness"
              value={context} onChange={e => setContext(e.target.value)} />
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn btn-primary" onClick={handleGenerate} disabled={loading || !email}>
            {loading
              ? <><span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} />Generating slides…</>
              : slides.length ? 'Regenerate' : 'Generate Slideshow'}
          </button>
        </div>
      </div>

      {/* My Slideshows */}
      <MySlideshows email={email} onLoad={handleLoad} refreshKey={listRefreshKey} />

      {/* Slides grid */}
      {slides.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
              {slides.length} slides
              {currentJobId && <span style={{ fontSize: 10, color: '#475569', marginLeft: 8 }}>auto-saving</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 14px' }}
                onClick={handleDownload} disabled={downloading || loading}>
                {downloading ? <><span className="spinner" style={{ width: 11, height: 11, marginRight: 6 }} />Zipping…</> : 'Download ZIP'}
              </button>
              <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
                onClick={handleGenerate} disabled={loading}>
                {loading ? <><span className="spinner" style={{ width: 11, height: 11, marginRight: 6 }} />Generating…</> : 'Regenerate'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 24 }}>
            {slides.map((slide, i) => (
              <SlideCard
                key={i}
                slide={slide}
                index={i}
                text={texts[i] ?? ''}
                onTextChange={val => handleTextChange(i, val)}
                style={style}
                position={position}
                onPositionChange={handlePositionChange}
                onStyleChange={handleStyleChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
