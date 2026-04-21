export default function ConnectionBadge({ status }) {
  if (!status) return <span className="badge badge-gray"><span className="dot" />Not checked</span>
  if (status.connected) return <span className="badge badge-green"><span className="dot" />Connected{status.days_until_expiry != null ? ` · ${status.days_until_expiry}d left` : ''}</span>
  if (status.reason === 'token_expired') return <span className="badge badge-yellow"><span className="dot" />Token Expired</span>
  return <span className="badge badge-red"><span className="dot" />Not connected</span>
}
