import { useState, useEffect, useRef } from 'react'
import { brandMentions } from '../api'
import { useToast } from './useToast.jsx'

const CREATOR_SORTS = [
  { id: 'score',     label: 'Score' },
  { id: 'followers', label: 'Followers' },
  { id: 'likes',     label: 'Total Likes' },
  { id: 'videos',    label: 'Video Count' },
  { id: 'date',      label: 'Recent' },
]

const VIDEO_SORTS = [
  { id: 'views',    label: 'Views' },
  { id: 'likes',    label: 'Likes' },
  { id: 'comments', label: 'Comments' },
  { id: 'date',     label: 'Most Recent' },
]

const UPLOAD_WINDOWS = [
  { id: '',    label: 'All time' },
  { id: '24h', label: 'Last 24h' },
  { id: '48h', label: 'Last 48h' },
  { id: '1w',  label: 'Last week' },
  { id: '2w',  label: 'Last 2 weeks' },
]

export default function BrandMentions({ email }) {
  const { show, Toast } = useToast()

  const [tab, setTab] = useState('creators')  // 'creators' | 'videos'
  const [creators, setCreators] = useState([])
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)

  const [creatorSort, setCreatorSort] = useState('score')
  const [videoSort, setVideoSort] = useState('views')
  const [videoWindow, setVideoWindow] = useState('')
  const [platform, setPlatform] = useState('')

  const [keywords, setKeywords] = useState([])
  const [keywordInput, setKeywordInput] = useState('')

  const [running, setRunning] = useState(false)
  const [job, setJob] = useState(null)  // { job_id, status, stats }
  const pollRef = useRef(null)

  const [previewVideo, setPreviewVideo] = useState(null)

  useEffect(() => {
    loadCreators()
    loadKeywords()
    return () => clearInterval(pollRef.current)
  }, [email])

  useEffect(() => { tab === 'creators' ? loadCreators() : loadVideos() }, [tab, creatorSort, videoSort, videoWindow, platform])

  async function loadCreators() {
    setLoading(true)
    const r = await brandMentions.list(email, {
      sortBy: creatorSort, sortOrder: 'desc', limit: 50,
      ...(platform ? { platform } : {}),
    })
    if (r.success) setCreators(r.data || [])
    else show(r.message || 'Failed to load creators', 'error')
    setLoading(false)
  }

  async function loadVideos() {
    setLoading(true)
    const r = await brandMentions.videos(email, {
      sortBy: videoSort, sortOrder: 'desc', limit: 50,
      ...(videoWindow ? { uploadedWithin: videoWindow } : {}),
      ...(platform ? { platform } : {}),
    })
    if (r.success) setVideos(r.data || [])
    else show(r.message || 'Failed to load videos', 'error')
    setLoading(false)
  }

  async function loadKeywords() {
    const r = await brandMentions.keywords(email)
    if (r.success) setKeywords(r.data?.queries || [])
  }

  async function startRun(useRefresh = false) {
    setRunning(true)
    const r = useRefresh ? await brandMentions.refresh(email) : await brandMentions.run(email)
    if (!r.success) {
      show(r.message || 'Could not start discovery', 'error')
      setRunning(false)
      return
    }
    const jobId = r.data.job_id
    setJob({ job_id: jobId, status: 'queued' })
    show(useRefresh ? 'Refresh started — fetching new mention videos' : 'Discovery started')
    pollRef.current = setInterval(async () => {
      const s = await brandMentions.state(jobId)
      const data = s.data || {}
      setJob({ job_id: jobId, ...data })
      if (data.status === 'completed' || data.status === 'error') {
        clearInterval(pollRef.current)
        setRunning(false)
        if (data.status === 'completed') {
          show(`Done — ${data.creators_new || 0} new creators, ${data.videos_new || 0} new videos`)
          loadCreators(); loadVideos(); loadKeywords()
        } else {
          show(`Discovery failed: ${data.error || 'unknown'}`, 'error')
        }
      }
    }, 3000)
  }

  async function addKeyword() {
    const kw = keywordInput.trim()
    if (!kw) return
    const r = await brandMentions.addKeywords(email, [kw])
    if (r.success) { setKeywords(r.data.queries || []); setKeywordInput('') }
    else show(r.message || 'Failed to add', 'error')
  }

  async function removeKeyword(kw) {
    const r = await brandMentions.delKeywords(email, [kw])
    if (r.success) setKeywords(r.data.queries || [])
  }

  async function searchWithStored() {
    if (!keywords.length) { show('No saved queries — add some or use Run Discovery', 'error'); return }
    setRunning(true)
    const r = await brandMentions.searchWith(email, keywords)
    if (!r.success) { show(r.message || 'Failed to start', 'error'); setRunning(false); return }
    setJob({ job_id: r.data.job_id, status: 'queued' })
    pollRef.current = setInterval(async () => {
      const s = await brandMentions.state(r.data.job_id)
      const data = s.data || {}
      setJob({ job_id: r.data.job_id, ...data })
      if (data.status === 'completed' || data.status === 'error') {
        clearInterval(pollRef.current)
        setRunning(false)
        if (data.status === 'completed') { show('Done'); loadCreators(); loadVideos() }
        else show(`Failed: ${data.error}`, 'error')
      }
    }, 3000)
  }

  function scorePill(score) {
    const v = Number(score) || 0
    const bg = v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444'
    return (
      <span style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11,
        fontWeight: 600, color: '#fff', background: bg, minWidth: 36, textAlign: 'center'
      }}>{v.toFixed(0)}</span>
    )
  }

  function fmt(n) {
    if (n == null) return '—'
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return String(n)
  }

  return (
    <div>
      {Toast}

      {/* ── Controls ── */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          Brand Mention Tracking
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
            Find creators making videos that mention your brand
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={() => startRun(false)} disabled={running}>
            {running ? 'Running…' : 'Run Discovery'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => startRun(true)} disabled={running}>
            Refresh (load new videos)
          </button>
          <button className="btn btn-outline btn-sm" onClick={searchWithStored} disabled={running || !keywords.length}>
            Re-run with saved queries ({keywords.length})
          </button>
        </div>

        {job && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#0f172a', borderRadius: 6, fontSize: 12, color: '#94a3b8' }}>
            Job <code style={{ color: '#e2e8f0' }}>{job.job_id?.slice(0, 8)}</code> — status: <strong style={{ color: '#e2e8f0' }}>{job.status}</strong>
            {job.creators_new != null && <> · {job.creators_new} new creators · {job.videos_new} new videos · {job.videos_filtered_out} filtered out</>}
            {job.search_queries?.length > 0 && (
              <div style={{ marginTop: 4 }}>
                Queries: {job.search_queries.slice(0, 5).join(' · ')}{job.search_queries.length > 5 && ` (+${job.search_queries.length - 5} more)`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Saved Queries ── */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">Saved Search Queries</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {keywords.length === 0 && <div style={{ color: '#64748b', fontSize: 13 }}>No saved queries yet — Run Discovery to auto-generate them.</div>}
          {keywords.map(kw => (
            <span key={kw} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              background: '#1e293b', color: '#e2e8f0', borderRadius: 14, fontSize: 12,
            }}>
              {kw}
              <button onClick={() => removeKeyword(kw)} style={{
                background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, lineHeight: 1,
              }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKeyword()}
            placeholder="Add a custom query (e.g. 'brand X review')"
            style={{ flex: 1, padding: '6px 10px', background: '#0f172a', border: '1px solid #1e293b', color: '#e2e8f0', borderRadius: 4 }}
          />
          <button className="btn btn-outline btn-sm" onClick={addKeyword}>Add</button>
        </div>
      </div>

      {/* ── Tabs + Filters ── */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: 8, marginBottom: 12 }}>
          <button
            className={`btn btn-sm ${tab === 'creators' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab('creators')}
          >Creators ({creators.length})</button>
          <button
            className={`btn btn-sm ${tab === 'videos' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab('videos')}
          >Videos ({videos.length})</button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ padding: 4, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b' }}>
              <option value="">All platforms</option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
            </select>
            {tab === 'creators' && (
              <select value={creatorSort} onChange={e => setCreatorSort(e.target.value)} style={{ padding: 4, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b' }}>
                {CREATOR_SORTS.map(s => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
              </select>
            )}
            {tab === 'videos' && (
              <>
                <select value={videoSort} onChange={e => setVideoSort(e.target.value)} style={{ padding: 4, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b' }}>
                  {VIDEO_SORTS.map(s => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
                </select>
                <select value={videoWindow} onChange={e => setVideoWindow(e.target.value)} style={{ padding: 4, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b' }}>
                  {UPLOAD_WINDOWS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </>
            )}
          </div>
        </div>

        {loading && <div style={{ padding: 16, color: '#94a3b8' }}>Loading…</div>}

        {/* ── Creators List ── */}
        {!loading && tab === 'creators' && (
          <>
            {creators.length === 0 && (
              <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>
                No creators found yet. Click <strong>Run Discovery</strong> to find creators talking about your brand.
              </div>
            )}
            {creators.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e293b' }}>
                    <th style={{ textAlign: 'left', padding: 8, color: '#94a3b8', fontWeight: 500 }}>Creator</th>
                    <th style={{ padding: 8, color: '#94a3b8', fontWeight: 500 }}>Platform</th>
                    <th style={{ padding: 8, color: '#94a3b8', fontWeight: 500 }}>Followers</th>
                    <th style={{ padding: 8, color: '#94a3b8', fontWeight: 500 }}>Likes</th>
                    <th style={{ padding: 8, color: '#94a3b8', fontWeight: 500 }}>Videos</th>
                    <th style={{ padding: 8, color: '#94a3b8', fontWeight: 500 }}>Mention Videos</th>
                    <th style={{ padding: 8, color: '#94a3b8', fontWeight: 500 }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #0f172a' }}>
                      <td style={{ padding: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {c.profile_photo
                            ? <img src={c.profile_photo} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                            : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e293b' }} />
                          }
                          <div>
                            <div style={{ color: '#e2e8f0' }}>{c.name}</div>
                            <a href={c.profile_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#64748b', textDecoration: 'none' }}>@{c.username}</a>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 8, textAlign: 'center', color: '#94a3b8' }}>{c.platform}</td>
                      <td style={{ padding: 8, textAlign: 'right', color: '#e2e8f0' }}>{fmt(c.follower_count)}</td>
                      <td style={{ padding: 8, textAlign: 'right', color: '#94a3b8' }}>{fmt(c.total_likes)}</td>
                      <td style={{ padding: 8, textAlign: 'right', color: '#94a3b8' }}>{fmt(c.video_count)}</td>
                      <td style={{ padding: 8, textAlign: 'right', color: '#e2e8f0' }}>{c.videos_count}</td>
                      <td style={{ padding: 8, textAlign: 'center' }}>{scorePill(c.creator_score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* ── Videos List ── */}
        {!loading && tab === 'videos' && (
          <>
            {videos.length === 0 && (
              <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>
                No mention videos yet. Run Discovery first.
              </div>
            )}
            {videos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {videos.map(v => (
                  <div key={v.id} style={{ background: '#0f172a', borderRadius: 6, overflow: 'hidden' }}>
                    <div
                      onClick={() => v.live_url && setPreviewVideo(v)}
                      style={{
                        position: 'relative', aspectRatio: '9/16', background: '#1e293b',
                        cursor: v.live_url ? 'pointer' : 'default',
                      }}
                    >
                      {v.thumbnail && <img src={v.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      {v.live_url && (
                        <div style={{
                          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 28,
                        }}>▶</div>
                      )}
                    </div>
                    <div style={{ padding: 8 }}>
                      <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {v.title || '—'}
                      </div>
                      {v.creator && (
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                          @{v.creator.username} · {fmt(v.creator.follower_count)} followers
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#94a3b8' }}>
                        <span>👁 {fmt(v.view_count)}</span>
                        <span>♥ {fmt(v.like_count)}</span>
                        <span>💬 {fmt(v.comment_count)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Video preview modal ── */}
      {previewVideo && (
        <div
          onClick={() => setPreviewVideo(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: '100%' }}>
            <video src={previewVideo.live_url} controls autoPlay style={{ width: '100%', borderRadius: 8 }} />
            <div style={{ marginTop: 8, color: '#e2e8f0', fontSize: 13 }}>
              {previewVideo.title}
              {previewVideo.creator && (
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  @{previewVideo.creator.username} · {fmt(previewVideo.creator.follower_count)} followers
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
