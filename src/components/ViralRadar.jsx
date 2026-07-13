import { useState, useEffect, useMemo, useCallback } from 'react'
import { viralRadar } from '../api'
import { useToast } from './useToast.jsx'

const VERSIONS = ['v1', 'v2', 'v3']

function perspectiveColor(name) {
  if (!name) return '#334155'
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const hue = hash % 360
  return `hsl(${hue}, 55%, 32%)`
}

function PerspectiveBadge({ name }) {
  if (!name) return <span style={{ color: '#64748b', fontSize: 11 }}>—</span>
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11,
      fontWeight: 500, color: '#e2e8f0', background: perspectiveColor(name), whiteSpace: 'nowrap',
    }}>{name}</span>
  )
}

export default function ViralRadar({ email }) {
  const { show, Toast } = useToast()

  const [version, setVersion] = useState('v1')
  const [includeCompetitorMentions, setIncludeCompetitorMentions] = useState(false)
  const [starting, setStarting] = useState(false)

  const [run, setRun] = useState(null)
  const [runLoading, setRunLoading] = useState(false)

  const [videos, setVideos] = useState([])
  const [videosLoading, setVideosLoading] = useState(false)
  const [videoSort, setVideoSort] = useState('relevance')

  const [micro, setMicro] = useState({ data: [], meta: {} })
  const [microLoading, setMicroLoading] = useState(false)
  const [microHighPerforming, setMicroHighPerforming] = useState(false)

  const [view, setView] = useState('creators') // creators | videos | micro
  const [platformFilter, setPlatformFilter] = useState('')
  const [perspectiveFilter, setPerspectiveFilter] = useState('')
  const [creatorSort, setCreatorSort] = useState('follower_count')

  const loadRun = useCallback(async () => {
    if (!email) return
    setRunLoading(true)
    const r = await viralRadar.latestRun(email, version)
    if (r.success) setRun(r.data)
    else { setRun(null); show(r.message || 'Failed to load run', 'error') }
    setRunLoading(false)
  }, [email, version])

  const loadVideos = useCallback(async () => {
    if (!email) return
    setVideosLoading(true)
    const r = await viralRadar.newlyFetchedVideos(email, videoSort, 150)
    if (r.success) setVideos(r.data.videos || [])
    else show(r.message || 'Failed to load videos', 'error')
    setVideosLoading(false)
  }, [email, videoSort])

  const loadMicro = useCallback(async () => {
    if (!email) return
    setMicroLoading(true)
    const r = await viralRadar.microCreators(email, { limit: 50, highPerforming: microHighPerforming || undefined })
    if (r.success) setMicro({ data: r.data?.creators || r.data || [], meta: r.meta || {} })
    else show(r.message || 'Failed to load micro-creators', 'error')
    setMicroLoading(false)
  }, [email, microHighPerforming])

  useEffect(() => { loadRun() }, [loadRun])
  useEffect(() => { loadVideos() }, [loadVideos])
  useEffect(() => { if (view === 'micro') loadMicro() }, [view, loadMicro])

  async function startRun() {
    setStarting(true)
    const r = await viralRadar.startRun(email, version, includeCompetitorMentions)
    if (r.success) {
      show(r.data?.message || 'Discovery run started.')
      setTimeout(loadRun, 2000)
    } else {
      show(r.message || 'Failed to start run', 'error')
    }
    setStarting(false)
  }

  // Perspective options: union of the run's declared perspectives (v2/v3) and
  // whatever perspective tags actually appear on fetched videos (covers v1's
  // reserved perspectives + "Creators Talking About Competitors").
  const perspectiveOptions = useMemo(() => {
    const names = new Set()
    for (const p of run?.perspectives || []) if (p?.name) names.add(p.name)
    for (const v of videos) if (v.perspective) names.add(v.perspective)
    return Array.from(names).sort()
  }, [run, videos])

  const platformOptions = useMemo(() => {
    const names = new Set()
    for (const v of videos) if (v.platform) names.add(v.platform)
    return Array.from(names).sort()
  }, [videos])

  const filteredVideos = useMemo(() => {
    let rows = videos
    if (platformFilter) rows = rows.filter(v => v.platform === platformFilter)
    if (perspectiveFilter) rows = rows.filter(v => v.perspective === perspectiveFilter)
    return rows
  }, [videos, platformFilter, perspectiveFilter])

  // Cross-reference: which perspectives has each creator handle's videos appeared under.
  const perspectivesByCreator = useMemo(() => {
    const map = {}
    for (const v of videos) {
      const handle = (v.creator_handle || '').toLowerCase()
      if (!handle) continue
      if (!map[handle]) map[handle] = new Set()
      if (v.perspective) map[handle].add(v.perspective)
    }
    return map
  }, [videos])

  const creators = run?.creator_candidates || []
  const filteredCreators = useMemo(() => {
    let rows = creators
    if (platformFilter) rows = rows.filter(c => c.platform === platformFilter)
    if (perspectiveFilter) {
      rows = rows.filter(c => {
        const handle = (c.creator_handle || '').toLowerCase()
        return perspectivesByCreator[handle]?.has(perspectiveFilter)
      })
    }
    const sorted = [...rows]
    sorted.sort((a, b) => (Number(b[creatorSort]) || 0) - (Number(a[creatorSort]) || 0))
    return sorted
  }, [creators, platformFilter, perspectiveFilter, perspectivesByCreator, creatorSort])

  return (
    <div>
      {Toast}

      {/* ── Controls ── */}
      <div className="card">
        <div className="card-title">Viral Radar</div>
        <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {VERSIONS.map(v => (
              <button
                key={v}
                className={`btn btn-sm ${version === v ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setVersion(v)}
              >{v.toUpperCase()}</button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1' }}>
            <input
              type="checkbox"
              checked={includeCompetitorMentions}
              onChange={e => setIncludeCompetitorMentions(e.target.checked)}
            />
            Include "Creators Talking About Competitors"
          </label>
          <button className="btn btn-primary btn-sm" onClick={startRun} disabled={starting}>
            {starting ? <span className="spinner" /> : `Run ${version.toUpperCase()} Discovery`}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => { loadRun(); loadVideos() }} disabled={runLoading || videosLoading}>
            Refresh
          </button>
        </div>
        {run && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Status: <b style={{ color: '#e2e8f0' }}>{run.status}</b></span>
            <span>Run ID: {run.runId || run.run_id}</span>
            <span>Perspectives: {(run.perspectives || []).length}</span>
            <span>Final results: {run.finalResultCount ?? '—'}</span>
          </div>
        )}
      </div>

      {/* ── Filters (shared: creators + videos) ── */}
      <div className="card">
        <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <select className="select" value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}>
            <option value="">All platforms</option>
            {platformOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="select" value={perspectiveFilter} onChange={e => setPerspectiveFilter(e.target.value)}>
            <option value="">All perspectives</option>
            {perspectiveOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {(platformFilter || perspectiveFilter) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setPlatformFilter(''); setPerspectiveFilter('') }}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── View tabs ── */}
      <div className="row" style={{ marginBottom: 12, gap: 4 }}>
        <button className={`nav-tab ${view === 'creators' ? 'active' : ''}`} onClick={() => setView('creators')}>
          Creators ({filteredCreators.length})
        </button>
        <button className={`nav-tab ${view === 'videos' ? 'active' : ''}`} onClick={() => setView('videos')}>
          Creator Videos ({filteredVideos.length})
        </button>
        <button className={`nav-tab ${view === 'micro' ? 'active' : ''}`} onClick={() => setView('micro')}>
          Micro-Creators
        </button>
      </div>

      {/* ── Creators view ── */}
      {view === 'creators' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Creators</div>
            <select className="select" value={creatorSort} onChange={e => setCreatorSort(e.target.value)}>
              <option value="follower_count">Sort: Followers</option>
              <option value="avg_views">Sort: Avg Views</option>
              <option value="creator_relevance_score">Sort: Relevance Score</option>
              <option value="best_breakout_score">Sort: Breakout Score</option>
            </select>
          </div>
          {runLoading && <div style={{ color: '#64748b', fontSize: 13 }}>Loading…</div>}
          {!runLoading && filteredCreators.length === 0 && (
            <div style={{ color: '#64748b', fontSize: 13 }}>No creators found for this run/filter.</div>
          )}
          <div style={{ display: 'grid', gap: 8 }}>
            {filteredCreators.map(c => {
              const handle = (c.creator_handle || '').toLowerCase()
              const seenPerspectives = Array.from(perspectivesByCreator[handle] || [])
              const isMicro = c.follower_count != null && c.follower_count < 1000
              return (
                <div key={c.id} style={{
                  display: 'flex', gap: 12, alignItems: 'center', background: '#0f172a',
                  padding: 10, borderRadius: 6, border: '1px solid #1e293b',
                }}>
                  {c.avatar_url
                    ? <img src={c.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e293b', flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{c.display_name || c.creator_handle}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{c.platform}</span>
                      {isMicro && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#7c3aed', color: '#fff' }}>micro</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      {(c.follower_count ?? 0).toLocaleString()} followers · {(c.avg_views ?? 0).toLocaleString()} avg views
                      {c.creator_relevance_score != null && <> · relevance {c.creator_relevance_score}</>}
                    </div>
                    {seenPerspectives.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {seenPerspectives.map(p => <PerspectiveBadge key={p} name={p} />)}
                      </div>
                    )}
                  </div>
                  {c.best_video_url && (
                    <a className="report-link" href={c.best_video_url} target="_blank" rel="noreferrer">↗ Best video</a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Creator videos view ── */}
      {view === 'videos' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Creator Videos</div>
            <select className="select" value={videoSort} onChange={e => setVideoSort(e.target.value)}>
              <option value="relevance">Sort: Relevance</option>
              <option value="score">Sort: Final Score</option>
              <option value="views">Sort: Views</option>
            </select>
          </div>
          {videosLoading && <div style={{ color: '#64748b', fontSize: 13 }}>Loading…</div>}
          {!videosLoading && filteredVideos.length === 0 && (
            <div style={{ color: '#64748b', fontSize: 13 }}>No videos found for this run/filter.</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {filteredVideos.map(v => (
              <a
                key={v.id}
                href={v.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'block', background: '#0f172a', borderRadius: 6, border: '1px solid #1e293b',
                  overflow: 'hidden', textDecoration: 'none', color: 'inherit',
                }}
              >
                <div style={{ position: 'relative', width: '100%', paddingTop: '125%', background: '#000' }}>
                  {v.thumbnail_url && (
                    <img src={v.thumbnail_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <div style={{ padding: 8 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    <PerspectiveBadge name={v.perspective} />
                    {v.competitor_mentioned && (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#0369a1', color: '#fff' }}>
                        vs {v.competitor_mentioned}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.creator_name || v.creator_handle || 'Unknown creator'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {v.platform} · {(v.views ?? 0).toLocaleString()} views
                  </div>
                  {v.caption && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {v.caption}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Micro-creators view ── */}
      {view === 'micro' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Micro-Creators (&lt;1k followers, high potential)</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
              <input type="checkbox" checked={microHighPerforming} onChange={e => setMicroHighPerforming(e.target.checked)} />
              High-performing only (≥100x follower views)
            </label>
          </div>
          {microLoading && <div style={{ color: '#64748b', fontSize: 13 }}>Loading…</div>}
          {!microLoading && micro.data.length === 0 && (
            <div style={{ color: '#64748b', fontSize: 13 }}>No micro-creators found.</div>
          )}
          <div style={{ display: 'grid', gap: 8 }}>
            {micro.data.map((c, idx) => (
              <div key={c.id || idx} style={{
                display: 'flex', gap: 12, alignItems: 'center', background: '#0f172a',
                padding: 10, borderRadius: 6, border: '1px solid #1e293b',
              }}>
                {c.profile_photo
                  ? <img src={c.profile_photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e293b', flexShrink: 0 }} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{c.name || c.username}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{c.platform}</span>
                    {c.high_performing_count > 0 && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#10b981', color: '#fff' }}>
                        {c.high_performing_count} high-performing
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    {(c.follower_count ?? 0).toLocaleString()} followers · {c.videos_count} videos tracked
                    {c.creator_score != null && <> · score {c.creator_score}</>}
                  </div>
                </div>
                {c.profile_url && (
                  <a className="report-link" href={c.profile_url} target="_blank" rel="noreferrer">↗ Profile</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
