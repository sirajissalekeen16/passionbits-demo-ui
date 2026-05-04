import { useState, useEffect, useRef } from 'react'
import { metaAds, tiktokAds } from '../api'

const POLL_MS = 30_000
const PHASE2_TERMINAL = ['phase2']

const METRIC_LABELS = {
  hook: 'Hook',
  hold: 'Hold',
  click: 'Click',
  buy: 'Buy',
  roas: 'ROAS',
}

function scorePill(score, size = 'sm') {
  const v = Number(score) || 0
  const bg = v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444'
  const px = size === 'lg' ? '4px 10px' : '2px 8px'
  const fs = size === 'lg' ? 13 : 11
  return (
    <span style={{
      display: 'inline-block', padding: px, borderRadius: 10, fontSize: fs,
      fontWeight: 600, color: '#fff', background: bg, minWidth: 36, textAlign: 'center',
    }}>{v.toFixed(0)}</span>
  )
}

function fmtNum(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return Number(n).toLocaleString()
}

function fmtMoney(n) {
  if (n == null) return '—'
  return `$${fmtNum(n)}`
}

function BulletList({ items }) {
  if (!items || !items.length) return null
  return (
    <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#cbd5e1', fontSize: 13, lineHeight: 1.55 }}>
      {items.map((b, i) => <li key={i} style={{ marginBottom: 4 }}>{b}</li>)}
    </ul>
  )
}

function PerformerCard({ ad, accent = '#6366f1' }) {
  const m = ad.metrics || {}
  return (
    <div style={{
      background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6,
      padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{
          width: 26, height: 26, borderRadius: 13, background: accent, color: '#fff',
          display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>{ad.rank}</div>
        {ad.thumbnail_url
          ? <img src={ad.thumbnail_url} alt="" style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 44, height: 44, borderRadius: 4, background: '#1e293b', flexShrink: 0 }} />
        }
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ad.ad_name}>
            {ad.ad_name || '—'}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {m.creative_style || '—'}{m.persona_label ? ` · ${m.persona_label}` : ''}
          </div>
        </div>
        {scorePill(m.overall_score, 'lg')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11, color: '#94a3b8' }}>
        <span>Hook {scorePill(m.hook_score)}</span>
        <span>Hold {scorePill(m.hold_score)}</span>
        <span>Click {scorePill(m.click_score)}</span>
        <span>Buy {scorePill(m.buy_score)}</span>
        <span>ROAS {scorePill(m.roas_score)}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: '#94a3b8', borderTop: '1px solid #1e293b', paddingTop: 6 }}>
        <span><b style={{ color: '#cbd5e1' }}>Spend:</b> {fmtMoney(m.spend)}</span>
        <span><b style={{ color: '#cbd5e1' }}>Imp:</b> {fmtNum(m.impressions)}</span>
        <span><b style={{ color: '#cbd5e1' }}>Buys:</b> {fmtNum(m.purchases)}</span>
        <span><b style={{ color: '#cbd5e1' }}>ROAS:</b> {m.roas != null ? `${m.roas}x` : '—'}</span>
      </div>
      {ad.insights?.bullets?.length > 0 && (
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: 6 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>
            {ad.insights.title || 'Insights'}
          </div>
          <BulletList items={ad.insights.bullets} />
        </div>
      )}
    </div>
  )
}

function MetricWinnerCard({ metricKey, entry }) {
  const label = METRIC_LABELS[metricKey] || metricKey
  if (!entry?.enabled) {
    return (
      <div style={{
        background: '#0f172a', border: '1px dashed #1e293b', borderRadius: 6, padding: 10,
        color: '#475569', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ textTransform: 'uppercase', fontWeight: 600, color: '#64748b' }}>{label} Winner</span>
        <span>not enough data</span>
      </div>
    )
  }
  const scoreKey = `${metricKey}_score`
  const rateKey = metricKey === 'roas' ? 'roas' : `${metricKey}_rate`
  const rate = entry[rateKey]
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: '#64748b' }}>
          {label} Winner
        </span>
        {scorePill(entry[scoreKey])}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
        {entry.thumbnail_url
          ? <img src={entry.thumbnail_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 32, height: 32, borderRadius: 4, background: '#1e293b', flexShrink: 0 }} />
        }
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.ad_name}>
            {entry.ad_name || '—'}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {label === 'ROAS' ? (rate != null ? `${rate}x` : '—') : (rate != null ? `${(rate * 100).toFixed(2)}%` : '—')}
          </div>
        </div>
      </div>
      {entry.bullets?.length > 0 && <BulletList items={entry.bullets} />}
    </div>
  )
}

function PhaseChip({ phase, video }) {
  if (!video) return null
  const isPhase2 = phase === 'phase2'
  const bg = isPhase2 ? '#10b981' : '#f59e0b'
  const text = isPhase2
    ? `AI insights ready · ${video.completed_count}/${video.required_count} videos analysed`
    : `Preparing AI insights · ${video.completed_count}/${video.required_count} analysed${video.pending_count ? ` · ${video.pending_count} pending` : ''}`
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
      borderRadius: 12, fontSize: 11, fontWeight: 600, color: '#fff', background: bg,
    }}>
      {!isPhase2 && <span className="spinner" style={{ width: 10, height: 10 }} />}
      {text}
    </span>
  )
}

export default function AdInsights({ platform, email, datePreset }) {
  const api = platform === 'meta' ? metaAds : tiktokAds
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const pollRef = useRef(null)
  const cancelRef = useRef(false)

  function clearPoll() {
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
  }

  async function fetchInsights({ force = false } = {}) {
    if (!email) return
    cancelRef.current = false
    if (!data) setLoading(true)
    if (force) setRefreshing(true)
    setError('')
    try {
      const r = await api.accountInsights(email, { datePreset, force })
      if (cancelRef.current) return
      if (r.success === false) {
        setError(r.message || 'Failed to load insights')
        setData(null)
      } else if (r.data?.error) {
        setError(r.data.error)
        setData(null)
      } else {
        setData(r.data)
        if (!PHASE2_TERMINAL.includes(r.data?.phase)) {
          clearPoll()
          pollRef.current = setTimeout(() => fetchInsights({ force: false }), POLL_MS)
        } else {
          clearPoll()
        }
      }
    } catch (e) {
      if (!cancelRef.current) setError(e.message || 'Network error')
    } finally {
      if (!cancelRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  useEffect(() => {
    return () => {
      cancelRef.current = true
      clearPoll()
    }
  }, [])

  useEffect(() => {
    setData(null)
    setError('')
    clearPoll()
  }, [datePreset, platform, email])

  const phase = data?.phase
  const overview = data?.overview
  const tops = data?.top_performers || []
  const bottoms = data?.bottom_performers || []
  const best = data?.best_by_metric || {}

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>AI Account Insights</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <PhaseChip phase={phase} video={data?.video_analysis} />
          {data && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => fetchInsights({ force: true })}
              disabled={loading || refreshing}
              title="Bypass 24-hour cache and regenerate"
            >
              {refreshing ? <span className="spinner" /> : 'Refresh'}
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => fetchInsights({ force: false })}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : data ? 'Reload' : 'Load Insights'}
          </button>
        </div>
      </div>

      {!data && !loading && !error && (
        <div style={{ fontSize: 13, color: '#64748b' }}>
          Click <b>Load Insights</b> to get an AI breakdown of your top/bottom ads, what's working,
          and where to spend next. First load kicks off video analysis (auto-polls every 30 s).
        </div>
      )}

      {error && (
        <div className="err" style={{ marginTop: 8 }}>{error}</div>
      )}

      {data && overview && (
        <>
          {/* ── Overview ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 10 }}>
              {[
                ['Total Ads', overview.total_ads],
                ['Spend', fmtMoney(overview.spend)],
                ['Impressions', fmtNum(overview.impressions)],
                ['Clicks', fmtNum(overview.clicks)],
                ['CTR', overview.ctr != null ? `${overview.ctr}%` : '—'],
                ['CPM', fmtMoney(overview.cpm)],
                ['CPC', fmtMoney(overview.cpc)],
                ['ROAS', overview.roas != null ? `${overview.roas}x` : '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#0f172a', padding: '8px 10px', borderRadius: 6, border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>{v ?? '—'}</div>
                </div>
              ))}
            </div>

            {overview.avg_scores && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 10 }}>
                {Object.entries(METRIC_LABELS).map(([k, label]) => (
                  <div key={k} style={{ background: '#0f172a', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{label} Score</div>
                    {scorePill(overview.avg_scores[k])}
                  </div>
                ))}
                <div style={{ background: '#0f172a', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Overall</div>
                  {scorePill(overview.avg_scores.overall)}
                </div>
              </div>
            )}

            <BulletList items={overview.bullets} />
          </div>

          {/* ── Top performers ── */}
          {tops.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#10b981', textTransform: 'uppercase', marginBottom: 8 }}>
                Top Performers
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                {tops.map(ad => <PerformerCard key={ad.ad_id} ad={ad} accent="#10b981" />)}
              </div>
            </div>
          )}

          {/* ── Bottom performers ── */}
          {bottoms.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', marginBottom: 8 }}>
                Bottom Performers
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                {bottoms.map(ad => <PerformerCard key={ad.ad_id} ad={ad} accent="#ef4444" />)}
              </div>
            </div>
          )}

          {/* ── Best by metric ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
              Best Ad per Metric
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {Object.keys(METRIC_LABELS).map(k => (
                <MetricWinnerCard key={k} metricKey={k} entry={best[k]} />
              ))}
            </div>
          </div>

          {/* ── Phase 2 LLM sections ── */}
          {[
            ['What Works', data.what_works, '#10b981'],
            ["What Doesn't Work", data.what_doesnt_work, '#ef4444'],
            ['Improvement Advice', data.improvement_advice, '#6366f1'],
            ['Suggested Video Types', data.suggested_video_types, '#06b6d4'],
          ].map(([title, section, color]) => (
            <div key={title} style={{
              background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6,
              padding: 12, marginBottom: 10,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color, textTransform: 'uppercase', marginBottom: 4 }}>
                {title}
              </div>
              {section?.bullets?.length > 0 ? (
                <BulletList items={section.bullets} />
              ) : (
                <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="spinner" style={{ width: 10, height: 10 }} />
                  Preparing deeper insights — running video analysis on your top &amp; bottom ads…
                </div>
              )}
            </div>
          ))}

          <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>
            {data.cached ? 'Served from 24-hour cache · ' : ''}Generated {data.generated_at ? new Date(data.generated_at).toLocaleString() : '—'}
          </div>
        </>
      )}
    </div>
  )
}
