import { useState, useEffect, useRef } from 'react'
import { broll } from '../api'

const STEPS = { FORM: 'form', RESULTS: 'results', OUTPUT: 'output' }

export default function MemeStudio() {
  const [step, setStep] = useState(STEPS.FORM)

  const [brandName, setBrandName] = useState('')
  const [brandDesc, setBrandDesc] = useState('')
  const [context, setContext] = useState('')

  const [templates, setTemplates] = useState([])
  const [selected, setSelected] = useState(null)
  const [caption, setCaption] = useState('')
  const [outputUrl, setOutputUrl] = useState(null)

  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [err, setErr] = useState('')
  const [descLoading, setDescLoading] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!brandName.trim() || brandName.trim().length < 3) return
    debounceRef.current = setTimeout(async () => {
      setDescLoading(true)
      try {
        const res = await broll.brandInfo(brandName.trim())
        if (res?.data?.description) setBrandDesc(res.data.description)
      } catch (_) {}
      finally { setDescLoading(false) }
    }, 800)
    return () => clearTimeout(debounceRef.current)
  }, [brandName])

  async function handleFind() {
    if (!brandName.trim() || !brandDesc.trim()) {
      setErr('Brand name and description are required.')
      return
    }
    setErr('')
    setLoading(true)
    try {
      const res = await broll.recommendMemeManual(brandName.trim(), brandDesc.trim(), context.trim())
      if (!res.success) throw new Error(res.message || 'API error')
      const items = res.data?.templates ?? []
      if (!items.length) throw new Error('No meme templates found — make sure memes are seeded first.')
      setTemplates(items)
      setSelected(items[0].id)
      setCaption(res.data?.caption || '')
      setStep(STEPS.RESULTS)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    if (!selected || !caption.trim()) return
    setErr('')
    setGenerating(true)
    setOutputUrl(null)
    try {
      const res = await broll.getOutput(selected, caption.trim())
      if (!res.success) throw new Error(res.message || 'Generation failed')
      setOutputUrl(res.data?.output_url)
      setStep(STEPS.OUTPUT)
    } catch (e) {
      setErr(e.message)
    } finally {
      setGenerating(false)
    }
  }

  function handleReset() {
    setStep(STEPS.FORM)
    setTemplates([])
    setSelected(null)
    setCaption('')
    setOutputUrl(null)
    setErr('')
  }

  return (
    <div>
      {step === STEPS.FORM && (
        <div className="card">
          <div className="card-title">Meme Studio</div>
          <div className="col" style={{ gap: 14 }}>
            <div>
              <div className="label">Brand Name</div>
              <input
                className="input"
                placeholder="e.g. Zomato, Myntra, boAt"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
              />
            </div>
            <div>
              <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Brand Description
                {descLoading && <span className="spinner" style={{ width: 12, height: 12 }} />}
                {descLoading && <span style={{ fontSize: 11, color: '#64748b' }}>Looking up…</span>}
              </div>
              <textarea
                className="textarea"
                placeholder="What does the brand sell? Who's the audience? What's the vibe?"
                rows={4}
                value={brandDesc}
                onChange={e => setBrandDesc(e.target.value)}
              />
            </div>
            <div>
              <div className="label">Context <span style={{ color: '#64748b' }}>(optional)</span></div>
              <input
                className="input"
                placeholder="e.g. new product launch, festive sale, going viral campaign"
                value={context}
                onChange={e => setContext(e.target.value)}
              />
            </div>
            {err && <div className="err">{err}</div>}
            <div>
              <button className="btn btn-primary" onClick={handleFind} disabled={loading}>
                {loading
                  ? <><span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} />Finding memes…</>
                  : 'Find Memes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(step === STEPS.RESULTS || step === STEPS.OUTPUT) && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>
              Top {templates.length} memes for <span style={{ color: '#7c6af7' }}>{brandName}</span>
            </div>
            <button className="btn btn-outline btn-sm" onClick={handleReset}>← Start over</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            {templates.map(t => (
              <div
                key={t.id}
                onClick={() => { setSelected(t.id); setOutputUrl(null); if (step === STEPS.OUTPUT) setStep(STEPS.RESULTS) }}
                style={{
                  border: `2px solid ${selected === t.id ? '#7c6af7' : '#2a2d3e'}`,
                  borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                  background: '#0f1117', transition: 'border-color 0.15s',
                }}
              >
                <video
                  src={t.video_url}
                  style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block' }}
                  muted autoPlay loop playsInline
                />
                {selected === t.id && (
                  <div style={{ padding: '6px 8px', fontSize: 11, color: '#7c6af7', fontWeight: 600 }}>✓ Selected</div>
                )}
                {t.score != null && (
                  <div style={{ padding: '4px 8px', fontSize: 11, color: '#64748b' }}>
                    Score: {typeof t.score === 'number' ? t.score.toFixed(0) : t.score}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Meme Caption</div>
            <textarea
              className="textarea"
              rows={3}
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Edit your meme caption here…"
            />
            {err && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || !caption.trim()}>
                {generating
                  ? <><span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} />Generating…</>
                  : 'Generate Final Video'}
              </button>
            </div>
          </div>

          {step === STEPS.OUTPUT && outputUrl && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">Final Output</div>
              <video
                src={outputUrl}
                controls
                style={{ width: '100%', maxWidth: 360, borderRadius: 8, display: 'block', margin: '0 auto' }}
              />
              <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center' }}>
                <a href={outputUrl} download target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Download</a>
                <button className="btn btn-outline btn-sm" onClick={() => setStep(STEPS.RESULTS)}>Change selection</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
