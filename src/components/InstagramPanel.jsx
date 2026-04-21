import { useState, useEffect } from 'react'
import { igOAuth, posting } from '../api'
import ConnectionBadge from './ConnectionBadge'
import ScheduleInput from './ScheduleInput'
import { useToast } from './useToast.jsx'

export default function InstagramPanel({ email }) {
  const { show, Toast } = useToast()

  const [status, setStatus] = useState(null)
  const [connLoading, setConnLoading] = useState(false)

  // Post form
  const [videoUrl, setVideoUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [scheduledAt, setScheduledAt] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [posting_, setPosting] = useState(false)
  const [postResult, setPostResult] = useState(null)

  useEffect(() => { checkStatus() }, [email])

  async function checkStatus() {
    setConnLoading(true)
    const r = await igOAuth.status(email)
    setStatus(r.data)
    setConnLoading(false)
  }

  function openOAuth() {
    igOAuth.authorize(email).then(r => {
      if (!r.data?.authorization_url) { show('Could not get authorization URL', 'error'); return }
      const popup = window.open(r.data.authorization_url, 'ig_oauth', 'width=600,height=700')
      const timer = setInterval(() => {
        if (popup?.closed) { clearInterval(timer); checkStatus() }
      }, 1000)
    })
  }

  async function disconnect() {
    await igOAuth.disconnect(email)
    setStatus(null)
    show('Instagram disconnected')
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const r = await posting.uploadVideo(file)
    if (r.success) { setVideoUrl(r.data.video_url); show('Video uploaded to S3') }
    else show(r.message || 'Upload failed', 'error')
    setUploading(false)
  }

  async function handlePost() {
    if (!videoUrl || !caption.trim()) return
    setPosting(true); setPostResult(null)
    const r = await posting.postInstagram(email, videoUrl, caption, coverUrl || null, scheduledAt)
    if (r.success) {
      setPostResult(r.data)
      const msg = r.data.status === 'scheduled' ? `Post scheduled for ${r.data.scheduled_at_utc}` : 'Post queued — Instagram is processing the video'
      show(msg)
    } else {
      show(r.message || 'Post failed', 'error')
    }
    setPosting(false)
  }

  return (
    <div>
      {Toast}

      {/* ── Connection ── */}
      <div className="card">
        <div className="card-title">Instagram Connection</div>
        <div className="row" style={{ alignItems: 'center' }}>
          <ConnectionBadge status={status} />
          {connLoading && <span className="spinner" />}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {status?.connected
              ? <button className="btn btn-danger btn-sm" onClick={disconnect}>Disconnect</button>
              : <button className="btn btn-primary btn-sm" onClick={openOAuth}>Connect Instagram</button>
            }
            <button className="btn btn-outline btn-sm" onClick={checkStatus} disabled={connLoading}>Refresh</button>
          </div>
        </div>
        {status?.connected && (
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
            @<span style={{ color: '#94a3b8' }}>{status.username}</span>
            {status.days_until_expiry != null && ` · token expires in ${status.days_until_expiry} days`}
          </div>
        )}
        {status && !status.connected && status.reason === 'token_expired' && (
          <div className="err" style={{ marginTop: 8 }}>Token expired — reconnect via OAuth</div>
        )}
      </div>

      {/* ── Post Reel ── */}
      {status?.connected && (
        <div className="card">
          <div className="card-title">Post a Reel</div>
          <div className="col">
            {/* Video URL or Upload */}
            <div>
              <div className="label">Video URL (S3)</div>
              <div className="row">
                <input
                  className="input"
                  placeholder="https://assets.passionbits.io/videos/..."
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                />
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <input
                    type="file" accept="video/mp4,video/mpeg,video/quicktime"
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <button className="btn btn-outline btn-sm" disabled={uploading}>
                    {uploading ? <span className="spinner" /> : 'Upload File'}
                  </button>
                </div>
              </div>
            </div>

            {/* Caption */}
            <div>
              <div className="label">Caption</div>
              <textarea
                className="textarea"
                placeholder="Caption text, hashtags, mentions…"
                value={caption}
                onChange={e => setCaption(e.target.value)}
              />
            </div>

            {/* Cover URL (optional) */}
            <div>
              <div className="label">Cover Image URL (optional)</div>
              <input
                className="input"
                placeholder="https://..."
                value={coverUrl}
                onChange={e => setCoverUrl(e.target.value)}
              />
            </div>

            {/* Schedule */}
            <div>
              <ScheduleInput onChange={setScheduledAt} />
            </div>

            <div>
              <button
                className="btn btn-primary"
                onClick={handlePost}
                disabled={posting_ || !videoUrl || !caption.trim()}
              >
                {posting_ ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="spinner" /> {scheduledAt ? 'Scheduling…' : 'Posting…'}</span> : (scheduledAt ? 'Schedule Reel' : 'Post Reel')}
              </button>
            </div>

            {postResult && (
              <div className="response-box">
                <div>Status: <span style={{ color: postResult.status === 'scheduled' ? '#60a5fa' : '#fbbf24' }}>{postResult.status}</span></div>
                <div>Container ID: {postResult.container_id}</div>
                {postResult.scheduled_at_utc && <div>Scheduled: {new Date(postResult.scheduled_at_utc).toLocaleString()} UTC</div>}
                <div style={{ color: '#64748b', marginTop: 6 }}>{postResult.message}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Info ── */}
      <div className="card" style={{ borderColor: '#1e293b' }}>
        <div className="card-title">Notes</div>
        <ul style={{ fontSize: 13, color: '#64748b', lineHeight: 2, paddingLeft: 18 }}>
          <li>Instagram requires the video URL to be publicly accessible (S3 preferred)</li>
          <li>Video must be MP4, H.264, 9:16 aspect ratio, min 720p</li>
          <li>Publishing is async — result delivered via Socket.IO events</li>
          <li>Token expires every 60 days — user must re-authorize</li>
        </ul>
      </div>
    </div>
  )
}
