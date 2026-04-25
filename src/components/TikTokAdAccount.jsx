import { useState, useEffect } from 'react'
import { tiktokAdsOAuth, tiktokAds } from '../api'
import ConnectionBadge from './ConnectionBadge'
import { useToast } from './useToast.jsx'

export default function TikTokAdAccount({ email }) {
  const { show, Toast } = useToast()

  const [connStatus, setConnStatus] = useState(null)
  const [connLoading, setConnLoading] = useState(false)
  const [adAccounts, setAdAccounts] = useState([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { checkStatus() }, [email])

  async function checkStatus() {
    setConnLoading(true)
    const r = await tiktokAdsOAuth.status(email)
    setConnStatus(r.data)
    setConnLoading(false)
    if (r.data?.connected) loadAdAccounts()
  }

  async function loadAdAccounts() {
    setAccountsLoading(true)
    const r = await tiktokAds.listAccounts(email)
    if (r.success) setAdAccounts(r.data)
    else show(r.message || 'Failed to load ad accounts', 'error')
    setAccountsLoading(false)
  }

  function openOAuth() {
    tiktokAdsOAuth.authorize(email).then(r => {
      if (!r.data?.authorization_url) { show('Could not get authorization URL', 'error'); return }
      const popup = window.open(r.data.authorization_url, 'tiktok_ads_oauth', 'width=600,height=700')
      const onMessage = (e) => {
        if (e.data?.source === 'passionbits-tiktok-ads-oauth') {
          window.removeEventListener('message', onMessage)
          clearInterval(timer)
          if (e.data.success) { show('TikTok Ads connected!'); checkStatus() }
          else show(e.data.message || 'Connection failed', 'error')
        }
      }
      window.addEventListener('message', onMessage)
      const timer = setInterval(() => {
        if (popup?.closed) { clearInterval(timer); window.removeEventListener('message', onMessage); checkStatus() }
      }, 1000)
    })
  }

  async function disconnect() {
    await tiktokAdsOAuth.disconnect(email)
    setConnStatus(null); setAdAccounts([])
    show('Disconnected')
  }

  async function refreshToken() {
    setRefreshing(true)
    const r = await tiktokAdsOAuth.refresh(email)
    if (r.success) { show('Token refreshed'); checkStatus() }
    else show(r.message || 'Refresh failed', 'error')
    setRefreshing(false)
  }

  return (
    <div>
      {Toast}

      {/* ── Connection ── */}
      <div className="card">
        <div className="card-title">TikTok Ads Connection</div>
        <div className="row" style={{ alignItems: 'center' }}>
          <ConnectionBadge status={connStatus} />
          {connLoading && <span className="spinner" />}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {connStatus?.connected ? (
              <>
                <button className="btn btn-outline btn-sm" onClick={refreshToken} disabled={refreshing}>
                  {refreshing ? 'Refreshing…' : 'Refresh Token'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={disconnect}>Disconnect</button>
              </>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={openOAuth}>Connect TikTok Ads</button>
            )}
            <button className="btn btn-outline btn-sm" onClick={checkStatus} disabled={connLoading}>Refresh</button>
          </div>
        </div>

        {connStatus && !connStatus.connected && (
          <div className="err" style={{ marginTop: 8 }}>
            {connStatus.reason === 'token_expired'
              ? 'Access token expired — click "Refresh Token" to renew without re-authorizing.'
              : connStatus.reason === 'refresh_expired'
                ? 'Refresh token expired — please reconnect.'
                : `Reason: ${connStatus.reason}`}
          </div>
        )}

        {connStatus?.connected && (
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 8, display: 'flex', gap: 16 }}>
            <span>{connStatus.advertiser_count} advertiser{connStatus.advertiser_count !== 1 ? 's' : ''} connected</span>
            {connStatus.hours_until_token_expiry != null && (
              <span style={{ color: connStatus.hours_until_token_expiry < 4 ? '#ef4444' : '#94a3b8' }}>
                Token expires in {connStatus.hours_until_token_expiry}h
                {connStatus.hours_until_token_expiry < 4 && ' — refresh soon'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Advertiser Accounts ── */}
      {connStatus?.connected && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            Advertiser Accounts
            <button className="btn btn-outline btn-sm" onClick={loadAdAccounts} disabled={accountsLoading}>
              {accountsLoading ? 'Loading…' : 'Reload'}
            </button>
          </div>

          {accountsLoading && <div style={{ padding: '12px 0', color: '#94a3b8' }}>Loading advertisers…</div>}

          {!accountsLoading && adAccounts.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>
              No advertiser accounts found. Make sure your TikTok Ads account has at least one active advertiser.
            </div>
          )}

          {adAccounts.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#94a3b8', fontWeight: 500 }}>Advertiser ID</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#94a3b8', fontWeight: 500 }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#94a3b8', fontWeight: 500 }}>Currency</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#94a3b8', fontWeight: 500 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {adAccounts.map(acc => (
                  <tr key={acc.advertiser_id} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '8px', color: '#94a3b8', fontFamily: 'monospace' }}>{acc.advertiser_id}</td>
                    <td style={{ padding: '8px', color: '#e2e8f0' }}>{acc.advertiser_name || acc.name || '—'}</td>
                    <td style={{ padding: '8px', color: '#94a3b8' }}>{acc.currency || '—'}</td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: acc.status === 'STATUS_ENABLE' ? '#10b98120' : '#ef444420',
                        color: acc.status === 'STATUS_ENABLE' ? '#10b981' : '#ef4444',
                      }}>
                        {acc.status === 'STATUS_ENABLE' ? 'Active' : (acc.status || 'Unknown')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: 12, padding: '10px 12px', background: '#0f172a', borderRadius: 8, fontSize: 12, color: '#64748b' }}>
            <strong style={{ color: '#94a3b8' }}>Phase 1 — OAuth connected.</strong> Ad performance analytics (spend, ROAS, hook/hold/click/buy scores) coming in the next phase once TikTok app review is approved.
          </div>
        </div>
      )}
    </div>
  )
}
