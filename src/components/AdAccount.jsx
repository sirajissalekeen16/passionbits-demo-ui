import { useState, useEffect } from 'react'
import { metaOAuth, metaAds } from '../api'
import ConnectionBadge from './ConnectionBadge'
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
    </div>
  )
}
