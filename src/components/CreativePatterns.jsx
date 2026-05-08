import { useState } from 'react'
import { creativePatterns } from '../api'

const LIFT_COLOR = '#10b981'

function scorePill(score) {
  if (score == null) return null
  const v = Number(score) || 0
  const bg = v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10,
      fontSize: 11, fontWeight: 600, color: '#fff', background: bg, minWidth: 36, textAlign: 'center',
    }}>{v.toFixed(0)}</span>
  )
}

function LiftBadge({ label }) {
  if (!label) return null
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 12,
      background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
      fontSize: 12, color: '#6ee7b7', fontWeight: 600,
    }}>{label}</span>
  )
}

function thumbUrl(t) {
  if (!t) return null
  if (typeof t === 'string') return t
  return t.thumbnail_url || t.video_url || null
}

function PatternCard({ pattern, platform, email }) {
  const [expanded, setExpanded] = useState(false)
  const [section, setSection] = useState('ads') // 'ads' | 'recs' | 'scripts'
  const [ads, setAds] = useState(null)
  const [recs, setRecs] = useState(null)
  const [scripts, setScripts] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const m = pattern.metrics || {}
  const lifts = Array.isArray(pattern.lifts) ? pattern.lifts : []
  const ctrLift = lifts.find(l => l.metric === 'CTR')

  async function open(nextSection) {
    setSection(nextSection)
    if (!expanded) setExpanded(true)
    setError('')

    if (nextSection === 'ads' && !ads) {
      setLoading(true)
      const r = await creativePatterns.ads(platform, pattern.ad_format_tag, email)
      if (r?.data) setAds(r.data.ads || r.data.items || [])
      else setError(r?.message || 'Failed to load ads')
      setLoading(false)
    }
    if (nextSection === 'recs' && !recs) {
      setLoading(true)
      const r = await creativePatterns.recommendations(platform, pattern.ad_format_tag, email)
      if (r?.data) setRecs(r.data.videos || [])
      else setError(r?.message || 'Failed to load recommendations')
      setLoading(false)
    }
    if (nextSection === 'scripts' && !scripts) {
      setLoading(true)
      const r = await creativePatterns.scripts(platform, pattern.ad_format_tag, email)
      if (r?.data) setScripts(r.data.scripts || [])
      else setError(r?.message || 'Failed to generate scripts')
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
      overflow: 'hidden', marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Thumbnails */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {(pattern.top_thumbnails || []).slice(0, 3).map((t, i) => {
            const url = thumbUrl(t)
            return url
              ? <img key={i} src={url} alt="" style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover' }} />
              : <div key={i} style={{ width: 44, height: 44, borderRadius: 4, background: '#1e293b' }} />
          })}
          {(!pattern.top_thumbnails?.length) && (
            <div style={{ width: 44, height: 44, borderRadius: 4, background: '#1e293b', display: 'grid', placeItems: 'center', fontSize: 14, color: '#475569' }}>▤</div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{pattern.title || pattern.ad_format_tag}</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{pattern.ad_count} ad{pattern.ad_count === 1 ? '' : 's'}</span>
          </div>
          {pattern.description && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, lineHeight: 1.5 }}>{pattern.description}</div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {ctrLift && <LiftBadge label={ctrLift.ratio >= 1 ? `${ctrLift.ratio.toFixed(2)}× CTR` : `${(ctrLift.ratio * 100).toFixed(0)}% CTR vs avg`} />}
            {m.avg_hook_score != null && (
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Hook {scorePill(m.avg_hook_score)}</span>
            )}
            {m.avg_hold_score != null && (
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Hold {scorePill(m.avg_hold_score)}</span>
            )}
            {m.avg_ctr != null && (
              <span style={{ fontSize: 11, color: '#94a3b8' }}>CTR <b style={{ color: '#e2e8f0' }}>{Number(m.avg_ctr).toFixed(2)}%</b></span>
            )}
          </div>
          {pattern.why_this_works?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 3 }}>Why this works</div>
              <ul style={{ margin: 0, paddingLeft: 14, color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>
                {pattern.why_this_works.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={() => expanded ? setExpanded(false) : open('ads')}
          style={{
            background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
            padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, flexShrink: 0,
          }}
        >{expanded ? '▲ Close' : '▼ Explore'}</button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div style={{ borderTop: '1px solid #1e293b' }}>
          {/* Section tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1e293b' }}>
            {[['ads', 'Ads in Pattern'], ['recs', 'Competitor Refs'], ['scripts', 'Generate Scripts']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => open(key)}
                style={{
                  padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: 'transparent', border: 'none',
                  borderBottom: section === key ? '2px solid #6366f1' : '2px solid transparent',
                  color: section === key ? '#6366f1' : '#64748b',
                }}
              >{label}</button>
            ))}
          </div>

          <div style={{ padding: 14 }}>
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13 }}>
                <span className="spinner" /> Loading…
              </div>
            )}
            {error && <div className="err">{error}</div>}

            {/* Ads in pattern */}
            {section === 'ads' && !loading && ads && (
              ads.length === 0
                ? <div style={{ color: '#64748b', fontSize: 13 }}>No ads found in this pattern.</div>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                    {ads.map((ad, i) => (
                      <div key={ad.id || i} style={{ background: '#1e293b', borderRadius: 6, overflow: 'hidden' }}>
                        {ad.thumbnail_url
                          ? <img src={ad.thumbnail_url} alt="" style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block' }} />
                          : <div style={{ width: '100%', aspectRatio: '9/16', background: '#0f172a', display: 'grid', placeItems: 'center', color: '#475569' }}>No thumb</div>
                        }
                        <div style={{ padding: '6px 8px' }}>
                          <div style={{ fontSize: 11, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ad.ad_name}>{ad.ad_name || '—'}</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                            {ad.hook_score != null && <span style={{ fontSize: 10, color: '#94a3b8' }}>H {scorePill(ad.hook_score)}</span>}
                            {ad.ctr != null && <span style={{ fontSize: 10, color: '#94a3b8' }}>CTR {ad.ctr}%</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
            )}

            {/* Competitor recommendations */}
            {section === 'recs' && !loading && recs && (
              recs.length === 0
                ? <div style={{ color: '#64748b', fontSize: 13 }}>No competitor videos found for this pattern.</div>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                    {recs.map((v, i) => (
                      <a
                        key={v.id || i}
                        href={v.video_url || v.url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <div style={{ background: '#1e293b', borderRadius: 6, overflow: 'hidden', cursor: 'pointer' }}>
                          {v.thumbnail_url
                            ? <img src={v.thumbnail_url} alt="" style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block' }} />
                            : <div style={{ width: '100%', aspectRatio: '9/16', background: '#0f172a', display: 'grid', placeItems: 'center', color: '#475569' }}>No thumb</div>
                          }
                          <div style={{ padding: '6px 8px' }}>
                            <div style={{ fontSize: 11, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.brand_name || v.title || '—'}</div>
                            {v.views != null && <div style={{ fontSize: 10, color: '#64748b' }}>{Number(v.views).toLocaleString()} views</div>}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
            )}

            {/* Scripts */}
            {section === 'scripts' && !loading && scripts && (
              scripts.length === 0
                ? <div style={{ color: '#64748b', fontSize: 13 }}>No scripts generated yet. Click "Generate Scripts" tab to start.</div>
                : scripts.map((script, i) => (
                    <div key={script.id || i} style={{
                      background: '#1e293b', borderRadius: 6, padding: 12,
                      marginBottom: 10, border: '1px solid #334155',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: 10, background: '#6366f1',
                          color: '#fff', display: 'grid', placeItems: 'center',
                          fontSize: 10, fontWeight: 700, flexShrink: 0,
                        }}>{i + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{script.title || `Script ${i + 1}`}</span>
                        {script.style && (
                          <span style={{ fontSize: 11, color: '#64748b', background: '#0f172a', padding: '1px 6px', borderRadius: 4 }}>{script.style}</span>
                        )}
                      </div>
                      <pre style={{
                        fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap',
                        lineHeight: 1.6, margin: 0, fontFamily: 'inherit',
                      }}>{script.script}</pre>
                    </div>
                  ))
            )}

            {section === 'scripts' && !loading && !scripts && (
              <button
                className="btn btn-primary"
                onClick={() => open('scripts')}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                ✦ Generate 5 Scripts for this Pattern
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CreativePatterns({ platform, email }) {
  const [patterns, setPatterns] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load(force = false) {
    setLoading(true)
    setError('')
    const r = await creativePatterns.list(platform, email, force)
    if (r?.data) setPatterns(r.data.patterns || [])
    else setError(r?.message || 'Failed to load patterns')
    setLoading(false)
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Winning Creative Patterns</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {patterns && (
            <button className="btn btn-outline btn-sm" onClick={() => load(true)} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Refresh'}
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => load(false)} disabled={loading}>
            {loading ? <span className="spinner" /> : patterns ? 'Reload' : 'Load Patterns'}
          </button>
        </div>
      </div>

      {!patterns && !loading && !error && (
        <div style={{ fontSize: 13, color: '#64748b' }}>
          Cluster your top-performing ads by creative format and see which patterns drive lift.
          Click <b>Load Patterns</b> to analyse.
        </div>
      )}

      {error && <div className="err" style={{ marginTop: 8 }}>{error}</div>}

      {patterns && patterns.length === 0 && (
        <div style={{ fontSize: 13, color: '#64748b' }}>
          Not enough analyzed ads yet to identify patterns (need at least 5 with completed analysis).
        </div>
      )}

      {patterns?.map((p, i) => (
        <PatternCard key={p.ad_format_tag || i} pattern={p} platform={platform} email={email} />
      ))}
    </div>
  )
}
