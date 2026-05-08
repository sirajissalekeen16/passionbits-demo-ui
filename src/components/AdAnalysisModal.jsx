import { useState, useEffect } from 'react'
import { adAnalysis } from '../api'

function scorePill(score) {
  const v = Number(score) || 0
  const bg = v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10,
      fontSize: 11, fontWeight: 600, color: '#fff', background: bg,
      minWidth: 36, textAlign: 'center',
    }}>{v.toFixed(0)}</span>
  )
}

function Tag({ label, color }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 12,
      fontSize: 12, fontWeight: 500, color: '#fff',
      background: color, margin: '2px 4px 2px 0',
    }}>{label}</span>
  )
}

function StoryboardRow({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12, borderBottom: '1px solid #1e293b', padding: '5px 0' }}>
      <span style={{ color: '#64748b', minWidth: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#cbd5e1' }}>{value}</span>
    </div>
  )
}

function SceneCard({ scene }) {
  const tsLabel = scene.start_time != null
    ? `${Number(scene.start_time).toFixed(1)}s – ${Number(scene.end_time ?? scene.start_time).toFixed(1)}s`
    : null
  const hasIssues = scene.needs_improvement?.length > 0
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '10px 0',
      borderBottom: '1px solid #1e293b',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 14,
        background: hasIssues ? 'rgba(245,158,11,0.15)' : '#1e293b',
        border: hasIssues ? '1px solid rgba(245,158,11,0.4)' : 'none',
        color: hasIssues ? '#f59e0b' : '#94a3b8',
        display: 'grid', placeItems: 'center',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}>{scene.scene_number}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          {scene.title && (
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{scene.title}</span>
          )}
          {tsLabel && (
            <span style={{ fontSize: 11, color: '#475569', background: '#0f172a', padding: '1px 6px', borderRadius: 4 }}>
              {tsLabel}
            </span>
          )}
          {hasIssues && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: '#f59e0b',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              padding: '1px 7px', borderRadius: 10,
            }}>⚠ needs fix</span>
          )}
        </div>
        {scene.description && (
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, lineHeight: 1.5 }}>
            {scene.description}
          </div>
        )}
        {scene.analysis && (
          <div style={{ fontSize: 12, color: '#cbd5e1', fontStyle: 'italic', lineHeight: 1.5 }}>
            {scene.analysis}
          </div>
        )}
        {hasIssues && (
          <ul style={{ margin: '6px 0 0', paddingLeft: 16, color: '#fbbf24', fontSize: 12, lineHeight: 1.6 }}>
            {scene.needs_improvement.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function AdAnalysisModal({ ad, email, platform, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scriptsLoading, setScriptsLoading] = useState(false)
  const [scripts, setScripts] = useState(null)
  const [scriptsError, setScriptsError] = useState('')
  const [activeTab, setActiveTab] = useState('analysis') // 'analysis' | 'scripts'

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      const r = await adAnalysis.get(platform, ad.id, email)
      if (cancelled) return
      if (r?.data) setData(r.data)
      else setError(r?.message || 'Failed to load analysis')
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [ad.id, email, platform])

  async function generateScripts() {
    setScriptsLoading(true)
    setScriptsError('')
    const r = await adAnalysis.generateScripts(platform, ad.id, email)
    if (r?.data) {
      setScripts(r.data)
      setActiveTab('scripts')
    } else {
      setScriptsError(r?.message || 'Failed to generate scripts')
    }
    setScriptsLoading(false)
  }

  const m = data?.metrics || {}
  const sb = data?.storyboard || {}

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        zIndex: 9999, padding: '20px 16px', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0f172a', borderRadius: 10, width: '100%', maxWidth: 900,
          border: '1px solid #1e293b', display: 'flex', flexDirection: 'column',
          marginBottom: 20,
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid #1e293b', gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ad.ad_name || 'Ad Analysis'}
            </div>
            {ad.campaign_name && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{ad.campaign_name}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
              padding: '3px 8px', borderRadius: 4, background: platform === 'meta' ? '#1877f2' : '#010101',
              color: '#fff',
            }}>{platform}</span>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
            >×</button>
          </div>
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            <span className="spinner" style={{ marginRight: 8 }} />
            Loading analysis…
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: 20 }}>
            <div className="err">{error}</div>
          </div>
        )}

        {!loading && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* ── Video + Metrics row ── */}
            <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
              {/* Video */}
              <div style={{ flexShrink: 0, padding: 16, width: 280, boxSizing: 'border-box' }}>
                {data.video_url ? (
                  <video
                    src={data.video_url}
                    poster={data.thumbnail_url || undefined}
                    controls
                    autoPlay
                    playsInline
                    style={{ width: '100%', borderRadius: 6, background: '#000', display: 'block' }}
                  />
                ) : data.thumbnail_url ? (
                  <img src={data.thumbnail_url} alt="" style={{ width: '100%', borderRadius: 6, display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: 180, background: '#1e293b', borderRadius: 6, display: 'grid', placeItems: 'center', color: '#475569' }}>No video</div>
                )}
                {data.analysis_pending && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="spinner" style={{ width: 10, height: 10 }} />
                    Analysis in progress…
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div style={{ flex: 1, minWidth: 260, padding: '16px 16px 16px 0' }}>
                {/* Scores */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
                  {[
                    ['Hook', m.hook_score], ['Hold', m.hold_score], ['Click', m.click_score],
                    ['Buy', m.buy_score], ['ROAS', m.roas_score], ['Overall', m.overall_score],
                  ].map(([label, val]) => val != null && (
                    <div key={label} style={{ background: '#1e293b', padding: '6px 8px', borderRadius: 5, textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                      {scorePill(val)}
                    </div>
                  ))}
                </div>

                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5, fontSize: 12 }}>
                  {[
                    ['Spend', m.spend != null ? `$${Number(m.spend).toLocaleString()}` : null],
                    ['ROAS', m.roas != null ? `${m.roas}x` : null],
                    ['CPM', m.cpm != null ? `$${m.cpm}` : null],
                    ['CPC', m.cpc != null ? `$${m.cpc}` : null],
                    ['CTR', m.ctr != null ? `${m.ctr}%` : null],
                    ['Purchases', m.purchases != null ? m.purchases : null],
                    ['7d ROAS', m.recent_roas_7d != null ? `${m.recent_roas_7d}x` : null],
                    ['Days running', m.days_running != null ? m.days_running : null],
                  ].filter(([, v]) => v != null).map(([k, v]) => (
                    <div key={k} style={{ background: '#1e293b', padding: '5px 8px', borderRadius: 4 }}>
                      <span style={{ color: '#64748b' }}>{k}: </span>
                      <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Audience fit tags ── */}
            {(data.best_for?.length > 0 || data.weaker_for?.length > 0) && (
              <div style={{ padding: '0 16px 14px', borderBottom: '1px solid #1e293b' }}>
                {data.best_for?.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginRight: 8 }}>Best for</span>
                    {data.best_for.map(t => <Tag key={t} label={t} color="#065f46" />)}
                  </div>
                )}
                {data.weaker_for?.length > 0 && (
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginRight: 8 }}>Weaker for</span>
                    {data.weaker_for.map(t => <Tag key={t} label={t} color="#7f1d1d" />)}
                  </div>
                )}
              </div>
            )}

            {/* ── Score-gated improvement focus ── */}
            {(data.hook_improvement || data.hold_improvement || data.click_improvement || data.buy_improvement) && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>
                  Improvement Focus
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                  {[
                    ['Hook', data.hook_improvement, m.hook_score],
                    ['Hold', data.hold_improvement, m.hold_score],
                    ['Click', data.click_improvement, m.click_score],
                    ['Buy', data.buy_improvement, m.buy_score],
                  ].filter(([, items]) => items?.length > 0).map(([label, items, score]) => (
                    <div key={label} style={{ background: '#160505', border: '1px solid #7f1d1d', borderRadius: 6, padding: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#f87171', textTransform: 'uppercase' }}>{label}</span>
                        {score != null && scorePill(score)}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 14, color: '#fca5a5', fontSize: 12, lineHeight: 1.6 }}>
                        {items.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tabs ── */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1e293b' }}>
              {[['analysis', 'Storyboard & Scenes'], ['scripts', 'Inspired Scripts']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    background: 'transparent', border: 'none',
                    borderBottom: activeTab === key ? '2px solid #6366f1' : '2px solid transparent',
                    color: activeTab === key ? '#6366f1' : '#64748b',
                  }}
                >{label}</button>
              ))}
            </div>

            {/* ── Analysis tab ── */}
            {activeTab === 'analysis' && (
              <div style={{ padding: 16 }}>
                {/* Most Winning Ads include */}
                {data.most_winning_features?.length > 0 && (
                  <div style={{ marginBottom: 14, padding: 10, background: '#1e1b4b', borderRadius: 6, border: '1px solid #3730a3' }}>
                    <div style={{ fontSize: 11, color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
                      Most Winning Ads include
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {data.most_winning_features.map((f, i) => (
                        <span key={i} style={{
                          fontSize: 12, color: '#c4b5fd',
                          background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
                          padding: '3px 10px', borderRadius: 12,
                        }}>✓ {f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Storyboard */}
                {sb && Object.keys(sb).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
                      Storyboard
                    </div>
                    <StoryboardRow label="Format" value={sb.ad_format} />
                    <StoryboardRow label="Setting" value={sb.physical_setting} />
                    <StoryboardRow label="Storyline" value={sb.storyline} />
                    <StoryboardRow label="Shooting style" value={sb.shooting_style} />
                    <StoryboardRow label="Editing pace" value={sb.editing_pace} />
                    <StoryboardRow label="Audio" value={sb.audio_elements} />
                    <StoryboardRow label="Text overlays" value={sb.text_overlays} />
                    <StoryboardRow label="Engagement" value={sb.engagement_strategy} />
                    {sb.artist_notes && (
                      <div style={{ marginTop: 10, padding: 10, background: '#1e293b', borderRadius: 5, borderLeft: '3px solid #f59e0b' }}>
                        <div style={{ fontSize: 11, color: '#f59e0b', textTransform: 'uppercase', marginBottom: 4 }}>Reviewer Notes</div>
                        <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.55 }}>{sb.artist_notes}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Scenes */}
                {data.scenes?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
                      Scene Breakdown
                    </div>
                    {data.scenes.map(s => <SceneCard key={s.scene_number} scene={s} />)}
                  </div>
                )}

                {!sb?.ad_format && !data.scenes?.length && !data.analysis_pending && (
                  <div style={{ fontSize: 13, color: '#475569' }}>No analysis available for this ad yet.</div>
                )}

                {/* Generate scripts CTA */}
                {!data.analysis_pending && data.scenes?.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e293b' }}>
                    <button
                      className="btn btn-primary"
                      onClick={generateScripts}
                      disabled={scriptsLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      {scriptsLoading
                        ? <><span className="spinner" /> Generating 5 scripts (~20s)…</>
                        : '✦ Generate 5 Inspired Scripts'}
                    </button>
                    {scriptsError && <div className="err" style={{ marginTop: 8 }}>{scriptsError}</div>}
                  </div>
                )}
              </div>
            )}

            {/* ── Scripts tab ── */}
            {activeTab === 'scripts' && (
              <div style={{ padding: 16 }}>
                {!scripts && !scriptsLoading && (
                  <div style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>
                    Generate scripts inspired by this ad's strengths and fixed weaknesses.
                  </div>
                )}

                {scripts?.based_on && (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                    {scripts.based_on.kept_strengths?.length > 0 && (
                      <div style={{ flex: 1, minWidth: 200, background: '#0c2a1a', border: '1px solid #064e3b', borderRadius: 6, padding: 10 }}>
                        <div style={{ fontSize: 11, color: '#10b981', textTransform: 'uppercase', marginBottom: 5 }}>Kept strengths</div>
                        {scripts.based_on.kept_strengths.map((s, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#6ee7b7', marginBottom: 2 }}>· {s}</div>
                        ))}
                      </div>
                    )}
                    {scripts.based_on.fixed_weaknesses?.length > 0 && (
                      <div style={{ flex: 1, minWidth: 200, background: '#2a0c0c', border: '1px solid #7f1d1d', borderRadius: 6, padding: 10 }}>
                        <div style={{ fontSize: 11, color: '#f87171', textTransform: 'uppercase', marginBottom: 5 }}>Fixed weaknesses</div>
                        {scripts.based_on.fixed_weaknesses.map((s, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#fca5a5', marginBottom: 2 }}>· {s}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {scripts?.scripts?.map(script => (
                  <div key={script.id} style={{
                    background: '#1e293b', borderRadius: 6, padding: 14,
                    marginBottom: 12, border: '1px solid #334155',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: 11, background: '#6366f1',
                          color: '#fff', display: 'grid', placeItems: 'center',
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>{script.id}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{script.title}</span>
                      </div>
                      {script.score != null && scorePill(Math.round(script.score * 100))}
                    </div>
                    <pre style={{
                      fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap',
                      lineHeight: 1.6, margin: 0, fontFamily: 'inherit',
                    }}>{script.script}</pre>
                  </div>
                ))}

                {!scripts && (
                  <button
                    className="btn btn-primary"
                    onClick={generateScripts}
                    disabled={scriptsLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {scriptsLoading
                      ? <><span className="spinner" /> Generating…</>
                      : '✦ Generate 5 Inspired Scripts'}
                  </button>
                )}
                {scriptsError && <div className="err" style={{ marginTop: 8 }}>{scriptsError}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
