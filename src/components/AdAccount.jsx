import { useState, useEffect } from 'react'
import { metaOAuth, metaAds } from '../api'
import ConnectionBadge from './ConnectionBadge'
import AdInsights from './AdInsights'
import { useToast } from './useToast.jsx'

const DATE_PRESETS = ['today', 'yesterday', 'last_7d', 'last_14d', 'last_30d', 'last_90d', 'this_month', 'last_month']

export default function AdAccount({ email }) {
  const { show, Toast } = useToast()

  // Connection
  const [connStatus, setConnStatus] = useState(null)
  const [connLoading, setConnLoading] = useState(false)

  // Ad accounts
  const [adAccounts, setAdAccounts] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [accountsLoading, setAccountsLoading] = useState(false)

  // Ask
  const [question, setQuestion] = useState('')
  const [datePreset, setDatePreset] = useState('last_30d')
  const [answer, setAnswer] = useState('')
  const [askLoading, setAskLoading] = useState(false)

  // Report
  const [reportQuery, setReportQuery] = useState('')
  const [reportType, setReportType] = useState('pdf')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportResult, setReportResult] = useState(null)

  // Overall report
  const [overallLoading, setOverallLoading] = useState(false)
  const [overallResult, setOverallResult] = useState(null)

  // Past reports
  const [pastReports, setPastReports] = useState([])
  const [pastLoading, setPastLoading] = useState(false)
  const [pastType, setPastType] = useState('pdf')

  // Account performance (new)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [adsList, setAdsList] = useState({ items: [], total: 0, total_pages: 0 })
  const [adsLoading, setAdsLoading] = useState(false)
  const [sortBy, setSortBy] = useState('overall_score')
  const [order, setOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [minSpend, setMinSpend] = useState(0)

  // Video preview modal
  const [previewAd, setPreviewAd] = useState(null)

  useEffect(() => { checkStatus() }, [email])

  async function checkStatus() {
    setConnLoading(true)
    const r = await metaOAuth.status(email)
    setConnStatus(r.data)
    setConnLoading(false)
    if (r.data?.connected) loadAdAccounts()
  }

  async function loadAdAccounts() {
    setAccountsLoading(true)
    const r = await metaAds.listAccounts(email)
    if (r.success) { setAdAccounts(r.data); setSelectedIds([]) }
    setAccountsLoading(false)
  }

  function openOAuth() {
    metaOAuth.authorize(email).then(r => {
      if (!r.data?.authorization_url) { show('Could not get authorization URL', 'error'); return }
      const popup = window.open(r.data.authorization_url, 'meta_oauth', 'width=600,height=700')
      const timer = setInterval(() => {
        if (popup?.closed) { clearInterval(timer); checkStatus() }
      }, 1000)
    })
  }

  async function disconnect() {
    await metaOAuth.disconnect(email)
    setConnStatus(null); setAdAccounts([]); setSelectedIds([])
    show('Disconnected')
  }

  function toggleAccount(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function doAsk() {
    if (!question.trim()) return
    setAskLoading(true); setAnswer('')
    const r = await metaAds.ask(email, question, selectedIds, datePreset)
    if (r.success) setAnswer(r.data.answer)
    else { show(r.message || 'Ask failed', 'error'); setAnswer('') }
    setAskLoading(false)
  }

  async function doReport() {
    if (!reportQuery.trim()) return
    setReportLoading(true); setReportResult(null)
    const fn = reportType === 'pdf' ? metaAds.reportPdf : metaAds.reportHtml
    const r = await fn(email, reportQuery, selectedIds, datePreset)
    if (r.success) setReportResult(r.data)
    else show(r.message || 'Report failed', 'error')
    setReportLoading(false)
  }

  async function doOverall() {
    setOverallLoading(true); setOverallResult(null)
    const r = await metaAds.overallReport(email, selectedIds, datePreset)
    if (r.success) setOverallResult(r.data)
    else show(r.message || 'Overall report failed', 'error')
    setOverallLoading(false)
  }

  async function loadSummary() {
    setSummaryLoading(true)
    const accountId = selectedIds.length === 1 ? selectedIds[0] : undefined
    const r = await metaAds.accountSummary(email, { accountId, datePreset, minSpend })
    if (r.success) setSummary(r.data)
    else show(r.message || 'Summary failed', 'error')
    setSummaryLoading(false)
  }

  async function loadAds(nextPage = 1, nextSortBy = sortBy, nextOrder = order) {
    setAdsLoading(true)
    const accountId = selectedIds.length === 1 ? selectedIds[0] : undefined
    const r = await metaAds.accountAds(email, {
      accountId,
      sortBy: nextSortBy,
      order: nextOrder,
      page: nextPage,
      pageSize,
      minSpend,
      includeRecent: true,
    })
    if (r.success) setAdsList(r.data)
    else show(r.message || 'Ads load failed', 'error')
    setAdsLoading(false)
  }

  function toggleSort(col) {
    if (col === sortBy) {
      const next = order === 'desc' ? 'asc' : 'desc'
      setOrder(next); setPage(1); loadAds(1, col, next)
    } else {
      setSortBy(col); setOrder('desc'); setPage(1); loadAds(1, col, 'desc')
    }
  }

  function sparkline(values, width = 220, height = 40, stroke = '#6366f1') {
    if (!values || values.length < 2) return null
    const min = Math.min(...values), max = Math.max(...values)
    const range = max - min || 1
    const step = width / (values.length - 1)
    const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${height - ((v - min) / range) * height}`).join(' ')
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <path d={d} fill="none" stroke={stroke} strokeWidth="2" />
      </svg>
    )
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

  async function loadPastReports() {
    setPastLoading(true)
    let r
    if (pastType === 'pdf') r = await metaAds.listPdfReports(email)
    else if (pastType === 'html') r = await metaAds.listHtmlReports(email)
    else r = await metaAds.listOverall(email)
    if (r.success) setPastReports(r.data)
    setPastLoading(false)
  }

  return (
    <div>
      {Toast}

      {/* ── Connection ── */}
      <div className="card">
        <div className="card-title">Connection</div>
        <div className="row" style={{ alignItems: 'center' }}>
          <ConnectionBadge status={connStatus} />
          {connLoading && <span className="spinner" />}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {connStatus?.connected
              ? <button className="btn btn-danger btn-sm" onClick={disconnect}>Disconnect</button>
              : <button className="btn btn-primary btn-sm" onClick={openOAuth}>Connect Meta Ads</button>
            }
            <button className="btn btn-outline btn-sm" onClick={checkStatus} disabled={connLoading}>Refresh</button>
          </div>
        </div>
        {connStatus && !connStatus.connected && (
          <div className="err" style={{ marginTop: 8 }}>
            Reason: {connStatus.reason}
          </div>
        )}
        {connStatus?.connected && (
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
            Connected as <span style={{ color: '#94a3b8' }}>{connStatus.name}</span>
          </div>
        )}
      </div>

      {connStatus?.connected && (
        <>
          {/* ── Ad Account Picker ── */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Ad Accounts</div>
              <button className="btn btn-ghost btn-sm" onClick={loadAdAccounts} disabled={accountsLoading}>
                {accountsLoading ? <span className="spinner" /> : 'Reload'}
              </button>
            </div>
            {adAccounts.length === 0 && !accountsLoading && (
              <div style={{ color: '#64748b', fontSize: 13 }}>No ad accounts found.</div>
            )}
            <div className="accounts-grid">
              {adAccounts.map(a => (
                <div
                  key={a.id}
                  className={`account-item ${selectedIds.includes(a.id) ? 'selected' : ''}`}
                  onClick={() => toggleAccount(a.id)}
                >
                  <input type="checkbox" readOnly checked={selectedIds.includes(a.id)} />
                  <div>
                    <div className="account-name">{a.name}</div>
                    <div className="account-meta">{a.id} · {a.currency} · {a.timezone_name}</div>
                  </div>
                </div>
              ))}
            </div>
            {adAccounts.length > 0 && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                {selectedIds.length === 0 ? 'All accounts selected (default)' : `${selectedIds.length} account(s) selected`}
              </div>
            )}
          </div>

          {/* ── Date Preset ── */}
          <div className="card">
            <div className="card-title">Date Range</div>
            <div className="row">
              <select className="select" value={datePreset} onChange={e => setDatePreset(e.target.value)}>
                {DATE_PRESETS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <div style={{ fontSize: 13, color: '#64748b', alignSelf: 'center' }}>
                Applied to all queries and reports below
              </div>
            </div>
          </div>

          {/* ── Account Performance ── */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Account Performance</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: '#64748b' }}>Min spend</label>
                <input
                  type="number" min="0" step="10" value={minSpend}
                  onChange={e => setMinSpend(Number(e.target.value) || 0)}
                  style={{ width: 70, padding: '4px 6px', borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 13 }}
                />
                <button className="btn btn-outline btn-sm" onClick={loadSummary} disabled={summaryLoading}>
                  {summaryLoading ? <span className="spinner" /> : 'Load Summary'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => { setPage(1); loadAds(1) }} disabled={adsLoading}>
                  {adsLoading ? <span className="spinner" /> : 'Load Ads'}
                </button>
              </div>
            </div>

            {summary && (
              <div style={{ marginBottom: 16 }}>
                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 12 }}>
                  {[
                    ['Spend', `$${summary.totals.spend.toLocaleString()}`],
                    ['Impressions', summary.totals.impressions.toLocaleString()],
                    ['Clicks', summary.totals.clicks.toLocaleString()],
                    ['CPM', `$${summary.totals.cpm}`],
                    ['CPC', `$${summary.totals.cpc}`],
                    ['CTR', `${summary.totals.ctr}%`],
                    ['ROAS', `${summary.totals.roas}x`],
                    ['Total ads', summary.total_ads],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: '#0f172a', padding: '8px 10px', borderRadius: 6, border: '1px solid #1e293b' }}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{k}</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Avg scores */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 12 }}>
                  {[
                    ['Hook', summary.averages.avg_hook_score],
                    ['Hold', summary.averages.avg_hold_score],
                    ['Click', summary.averages.avg_click_score],
                    ['Buy', summary.averages.avg_buy_score],
                    ['ROAS Score', summary.averages.avg_roas_score],
                    ['Overall', summary.averages.avg_overall_score],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', background: '#0f172a', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{k} Score</div>
                      {scorePill(v)}
                    </div>
                  ))}
                </div>

                {/* Graphs */}
                {summary.graph?.length > 1 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                    {[
                      ['Spend', summary.graph.map(g => g.spend), '#6366f1'],
                      ['CPM', summary.graph.map(g => g.cpm), '#06b6d4'],
                      ['CPC', summary.graph.map(g => g.cpc), '#f59e0b'],
                      ['CTR %', summary.graph.map(g => g.ctr), '#10b981'],
                    ].map(([label, vals, color]) => (
                      <div key={label} style={{ background: '#0f172a', padding: 10, borderRadius: 6, border: '1px solid #1e293b' }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{label} — last {summary.graph.length}d</div>
                        {sparkline(vals, 220, 40, color)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {adsList.items.length > 0 && (
              <>
                <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid #1e293b' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#cbd5e1' }}>
                    <thead style={{ background: '#0f172a', color: '#94a3b8' }}>
                      <tr>
                        {[
                          ['Ad', 'ad_name'],
                          ['Spend', 'spend'],
                          ['ROAS', 'roas'],
                          ['Hook', 'hook_score'],
                          ['Hold', 'hold_score'],
                          ['Click', 'click_score'],
                          ['Buy', 'buy_score'],
                          ['Overall', 'overall_score'],
                          ['7d ROAS', 'recent_roas_7d'],
                          ['CPM', 'cpm'],
                          ['CPC', 'cpc'],
                          ['CTR', 'ctr'],
                          ['Purchases', 'purchases'],
                          ['Days', 'days_running'],
                          ['Start', 'start_date'],
                        ].map(([label, col]) => (
                          <th
                            key={col}
                            onClick={() => toggleSort(col)}
                            style={{
                              padding: '8px 10px', textAlign: 'left', cursor: 'pointer',
                              userSelect: 'none', fontWeight: 500, fontSize: 11, textTransform: 'uppercase',
                              color: sortBy === col ? '#6366f1' : '#94a3b8',
                              borderBottom: '1px solid #1e293b',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {label}{sortBy === col ? (order === 'desc' ? ' ↓' : ' ↑') : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {adsList.items.map(ad => (
                        <tr key={ad.id} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '8px 10px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(ad.thumbnail_url || ad.video_url) ? (
                              <button
                                type="button"
                                onClick={() => ad.video_url && setPreviewAd(ad)}
                                disabled={!ad.video_url}
                                title={ad.video_url ? 'Click to play video' : 'No video URL available'}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 8,
                                  background: 'transparent', border: 'none', padding: 0,
                                  cursor: ad.video_url ? 'pointer' : 'default',
                                  color: 'inherit', font: 'inherit', textAlign: 'left',
                                  maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}
                              >
                                <span style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
                                  {ad.thumbnail_url
                                    ? <img src={ad.thumbnail_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', display: 'block' }} />
                                    : <div style={{ width: 32, height: 32, borderRadius: 4, background: '#1e293b' }} />
                                  }
                                  {ad.video_url && (
                                    <span style={{
                                      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                                      background: 'rgba(0,0,0,0.45)', borderRadius: 4, fontSize: 12, color: '#fff',
                                    }}>▶</span>
                                  )}
                                </span>
                                <span title={ad.ad_name} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {ad.ad_name || '—'}
                                </span>
                              </button>
                            ) : (
                              <span title={ad.ad_name}>{ad.ad_name || '—'}</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px' }}>${ad.spend.toLocaleString()}</td>
                          <td style={{ padding: '8px 10px' }}>{ad.roas}x</td>
                          <td style={{ padding: '8px 10px' }}>{scorePill(ad.hook_score)}</td>
                          <td style={{ padding: '8px 10px' }}>{scorePill(ad.hold_score)}</td>
                          <td style={{ padding: '8px 10px' }}>{scorePill(ad.click_score)}</td>
                          <td style={{ padding: '8px 10px' }}>{scorePill(ad.buy_score)}</td>
                          <td style={{ padding: '8px 10px' }}>{scorePill(ad.overall_score)}</td>
                          <td style={{ padding: '8px 10px' }}>{ad.recent_roas_7d != null ? `${ad.recent_roas_7d}x` : '—'}</td>
                          <td style={{ padding: '8px 10px' }}>${ad.cpm}</td>
                          <td style={{ padding: '8px 10px' }}>${ad.cpc}</td>
                          <td style={{ padding: '8px 10px' }}>{ad.ctr}%</td>
                          <td style={{ padding: '8px 10px' }}>{ad.purchases}</td>
                          <td style={{ padding: '8px 10px' }}>{ad.days_running ?? '—'}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#94a3b8' }}>
                            {ad.start_date ? new Date(ad.start_date).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 13, color: '#94a3b8' }}>
                  <div>
                    Page {page} of {adsList.total_pages} · {adsList.total} ad{adsList.total === 1 ? '' : 's'} · sort by {sortBy} {order}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm" disabled={page <= 1 || adsLoading}
                      onClick={() => { const p = page - 1; setPage(p); loadAds(p) }}>← Prev</button>
                    <button className="btn btn-outline btn-sm" disabled={page >= adsList.total_pages || adsLoading}
                      onClick={() => { const p = page + 1; setPage(p); loadAds(p) }}>Next →</button>
                  </div>
                </div>
              </>
            )}

            {!summary && adsList.items.length === 0 && (
              <div style={{ fontSize: 13, color: '#64748b' }}>
                Click <b>Load Summary</b> for KPIs + graphs, or <b>Load Ads</b> for the per-ad performance table
                (sortable by any column — default: overall score).
              </div>
            )}
          </div>

          {/* ── AI Account Insights ── */}
          <AdInsights platform="meta" email={email} datePreset={datePreset} />

          {/* ── Ask ── */}
          <div className="card">
            <div className="card-title">Ask AI</div>
            <div className="col">
              <textarea
                className="textarea"
                placeholder="e.g. Which campaign had the best ROAS last month?"
                value={question}
                onChange={e => setQuestion(e.target.value)}
              />
              <div>
                <button className="btn btn-primary" onClick={doAsk} disabled={askLoading || !question.trim()}>
                  {askLoading ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="spinner" /> Asking…</span> : 'Ask'}
                </button>
              </div>
              {answer && <div className="response-box">{answer}</div>}
            </div>
          </div>

          {/* ── Generate Report ── */}
          <div className="card">
            <div className="card-title">Generate Report</div>
            <div className="col">
              <div className="row">
                <select className="select" value={reportType} onChange={e => setReportType(e.target.value)}>
                  <option value="pdf">PDF Report</option>
                  <option value="html">HTML Report</option>
                </select>
              </div>
              <textarea
                className="textarea"
                placeholder="e.g. Detailed performance breakdown of all campaigns"
                value={reportQuery}
                onChange={e => setReportQuery(e.target.value)}
              />
              <div>
                <button className="btn btn-primary" onClick={doReport} disabled={reportLoading || !reportQuery.trim()}>
                  {reportLoading ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="spinner" /> Generating…</span> : 'Generate'}
                </button>
              </div>
              {reportResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {reportResult.pdf_url && (
                    <a className="report-link" href={reportResult.pdf_url} target="_blank" rel="noreferrer">
                      ↗ Open PDF Report
                    </a>
                  )}
                  {reportResult.html && (
                    <button className="btn btn-outline btn-sm" style={{ width: 'fit-content' }}
                      onClick={() => { const w = window.open(); w.document.write(reportResult.html) }}>
                      Open HTML Report
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Overall Report ── */}
          <div className="card">
            <div className="card-title">Overall Comprehensive Report</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              Covers all campaigns, creatives, audience, costs, and strategy. May take 30–60 seconds.
            </div>
            <div className="col">
              <div>
                <button className="btn btn-primary" onClick={doOverall} disabled={overallLoading}>
                  {overallLoading ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="spinner" /> Generating…</span> : 'Generate Overall Report'}
                </button>
              </div>
              {overallResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>
                    Accounts: {overallResult.accounts_analyzed}
                  </div>
                  {overallResult.pdf_url && (
                    <a className="report-link" href={overallResult.pdf_url} target="_blank" rel="noreferrer">
                      ↗ Open PDF Report
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Past Reports ── */}
          <div className="card">
            <div className="card-title">Past Reports</div>
            <div className="row" style={{ marginBottom: 12 }}>
              <select className="select" value={pastType} onChange={e => setPastType(e.target.value)}>
                <option value="pdf">PDF Reports</option>
                <option value="html">HTML Reports</option>
                <option value="overall">Overall Reports</option>
              </select>
              <button className="btn btn-outline btn-sm" onClick={loadPastReports} disabled={pastLoading}>
                {pastLoading ? <span className="spinner" /> : 'Load'}
              </button>
            </div>
            <div className="report-list">
              {pastReports.length === 0 && <div style={{ color: '#64748b', fontSize: 13 }}>No reports loaded yet.</div>}
              {pastReports.map(r => (
                <div key={r.report_id} className="report-item">
                  <div>
                    <div className="report-query">{r.query || r.date_range || 'Overall Report'}</div>
                    <div className="report-date">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</div>
                  </div>
                  {r.pdf_url && (
                    <a className="report-link" href={r.pdf_url} target="_blank" rel="noreferrer">↗ PDF</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Video preview modal */}
      {previewAd && (
        <div
          onClick={() => setPreviewAd(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'grid', placeItems: 'center', zIndex: 9999, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0f172a', borderRadius: 8, padding: 16, maxWidth: 480,
              width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 10,
              border: '1px solid #1e293b',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={previewAd.ad_name}>
                {previewAd.ad_name || 'Ad video'}
              </div>
              <button
                onClick={() => setPreviewAd(null)}
                style={{ background: 'transparent', border: '1px solid #334155', color: '#cbd5e1', padding: '2px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                title="Close"
              >×</button>
            </div>
            <video
              src={previewAd.video_url}
              poster={previewAd.thumbnail_url || undefined}
              controls
              autoPlay
              playsInline
              style={{ width: '100%', maxHeight: '70vh', background: '#000', borderRadius: 4 }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#94a3b8' }}>
              {previewAd.campaign_name && <span><b style={{ color: '#cbd5e1' }}>Campaign:</b> {previewAd.campaign_name}</span>}
              {typeof previewAd.spend === 'number' && <span><b style={{ color: '#cbd5e1' }}>Spend:</b> {previewAd.spend.toLocaleString()}</span>}
              {previewAd.roas != null && <span><b style={{ color: '#cbd5e1' }}>ROAS:</b> {previewAd.roas}x</span>}
              {previewAd.overall_score != null && <span><b style={{ color: '#cbd5e1' }}>Overall:</b> {previewAd.overall_score}</span>}
              <a
                href={previewAd.video_url}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#6366f1', marginLeft: 'auto' }}
              >
                Open in new tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
