import { useState, useEffect } from 'react'
import { ttOAuth, posting } from '../api'
import ConnectionBadge from './ConnectionBadge'
import ScheduleInput from './ScheduleInput'
import { useToast } from './useToast.jsx'

const PRIVACY_OPTS = [
  { value: 'SELF_ONLY',             label: 'Self Only (default / safe)' },
  { value: 'FOLLOWER_OF_CREATOR',   label: 'Followers Only' },
  { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Mutual Followers' },
  { value: 'PUBLIC_TO_EVERYONE',    label: 'Public' },
]

export default function TikTokPanel({ email }) {
  const { show, Toast } = useToast()

  const [status, setStatus] = useState(null)
  const [connLoading, setConnLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Post form
  const [videoUrl, setVideoUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [privacy, setPrivacy] = useState('SELF_ONLY')
  const [disableDuet, setDisableDuet] = useState(false)
  const [disableComment, setDisableComment] = useState(false)
  const [disableStitch, setDisableStitch] = useState(false)
  const [scheduledAt, setScheduledAt] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [posting_, setPosting] = useState(false)
  const [postResult, setPostResult] = useState(null)

  useEffect(() => { checkStatus() }, [email])

  async function checkStatus() {
    setConnLoading(true)
    const r = await ttOAuth.status(email)
    setStatus(r.data)
    setConnLoading(false)
  }

  function openOAuth() {
    ttOAuth.authorize(email).then(r => {
      if (!r.data?.authorization_url) { show('Could not get authorization URL', 'error'); return }
      const popup = window.open(r.data.authorization_url, 'tt_oauth', 'width=600,height=750')
      const timer = setInterval(() => {
        if (popup?.closed) { clearInterval(timer); checkStatus() }
      }, 1000)
    })
  }

  async function refreshToken() {
    setRefreshing(true)
    const r = await ttOAuth.refresh(email)
    if (r.success) { show('Token refreshed'); await checkStatus() }
    else show(r.message || 'Refresh failed', 'error')
    setRefreshing(false)
  }

  async function disconnect() {
    await ttOAuth.disconnect(email)
    setStatus(null)
    show('TikTok disconnected')
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
    const r = await posting.postTiktok(email, videoUrl, caption, privacy, {
      disable_duet: disableDuet,
      disable_comment: disableComment,
      disable_stitch: disableStitch,
    }, scheduledAt)
    if (r.success) {
      setPostResult(r.data)
      const msg = r.data.status === 'scheduled' ? `Post scheduled for ${r.data.scheduled_at_utc}` : 'Post queued — TikTok is processing the video'
      show(msg)
    } else {
      show(r.message || 'Post failed', 'error')
    }
    setPosting(false)
  }

  const tokenExpired = status && !status.connected && status.reason === 'token_expired'
  const refreshExpired = status && !status.connected && status.reason === 'refresh_expired'

  return (
    <div>
      {Toast}

      {/* ── Connection ── */}
      <div className="card">
        <div className="card-title">TikTok Connection</div>
        <div className="row" style={{ alignItems: 'center' }}>
          <ConnectionBadge status={status} />
          {connLoading && <span className="spinner" />}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {status?.connected && (
              <button className="btn btn-outline btn-sm" onClick={refreshToken} disabled={refreshing}>
                {refreshing ? <span className="spinner" /> : 'Refresh Token'}
              </button>
            )}
            {tokenExpired && (
              <button className="btn btn-outline btn-sm" onClick={refreshToken} disabled={refreshing}>
                {refreshing ? <span className="spinner" /> : 'Refresh Token'}
              </button>
            )}
            {(status?.connected || tokenExpired)
              ? <button className="btn btn-danger btn-sm" onClick={disconnect}>Disconnect</button>
              : <button className="btn btn-primary btn-sm" onClick={openOAuth}>Connect TikTok</button>
            }
            <button className="btn btn-outline btn-sm" onClick={checkStatus} disabled={connLoading}>Refresh</button>
          </div>
        </div>

        {status?.connected && (
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
            @<span style={{ color: '#94a3b8' }}>{status.username}</span>
            {status.token_expires_at && (
              <> · access token expires {new Date(status.token_expires_at).toLocaleString()}</>
            )}
          </div>
        )}
        {tokenExpired && (
          <div className="err" style={{ marginTop: 8 }}>
            Access token expired (24h limit) — click "Refresh Token" to renew
          </div>
        )}
        {refreshExpired && (
          <div className="err" style={{ marginTop: 8 }}>
            Refresh token expired (365d limit) — must re-connect via OAuth
          </div>
        )}
      </div>

      {/* ── Post Video ── */}
      {status?.connected && (
        <div className="card">
          <div className="card-title">Post a Video</div>
          <div className="col">
            {/* Video URL or Upload */}
            <div>
              <div className="label">Video URL (assets.passionbits.io)</div>
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
              <div className="label">Caption (max 2200 chars)</div>
              <textarea
                className="textarea"
                placeholder="Video caption, hashtags…"
                value={caption}
                maxLength={2200}
                onChange={e => setCaption(e.target.value)}
              />
              <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 3 }}>
                {caption.length}/2200
              </div>
            </div>

            {/* Privacy */}
            <div>
              <div className="label">Privacy Level</div>
              <select className="select" value={privacy} onChange={e => setPrivacy(e.target.value)}>
                {PRIVACY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Note: Unaudited apps always post as SELF_ONLY regardless of selection
              </div>
            </div>

            {/* Interaction controls */}
            <div>
              <div className="label">Interaction Controls</div>
              <div className="row" style={{ gap: 16 }}>
                {[
                  ['Disable Duet', disableDuet, setDisableDuet],
                  ['Disable Comment', disableComment, setDisableComment],
                  ['Disable Stitch', disableStitch, setDisableStitch],
                ].map(([label, val, setter]) => (
                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', color: '#94a3b8' }}>
                    <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} style={{ accentColor: '#7c6af7' }} />
                    {label}
                  </label>
                ))}
              </div>
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
                {posting_ ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="spinner" /> {scheduledAt ? 'Scheduling…' : 'Posting…'}</span> : (scheduledAt ? 'Schedule to TikTok' : 'Post to TikTok')}
              </button>
            </div>

            {postResult && (
              <div className="response-box">
                <div>Status: <span style={{ color: postResult.status === 'scheduled' ? '#60a5fa' : '#fbbf24' }}>{postResult.status}</span></div>
                <div>Account: @{postResult.username}</div>
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
          <li>Video URL must be on <code style={{ color: '#94a3b8' }}>assets.passionbits.io</code> (domain-verified)</li>
          <li>Access token expires every 24 hours — use "Refresh Token" to renew</li>
          <li>Refresh token is valid for 365 days — after that, full OAuth required</li>
          <li>Unaudited apps: video lands in creator's inbox as SELF_ONLY</li>
          <li>Publishing is async — result delivered via Socket.IO events</li>
        </ul>
      </div>
    </div>
  )
}
