import { useState } from 'react'

export default function EmailGate({ onSubmit }) {
  const [val, setVal] = useState('')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', flexDirection: 'column', gap: 24,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#7c6af7', marginBottom: 6 }}>Passionbits Dev UI</div>
        <div style={{ fontSize: 14, color: '#64748b' }}>Meta Ads &amp; Content Publishing Tester</div>
      </div>
      <div style={{ background: '#161926', border: '1px solid #2a2d3e', borderRadius: 12, padding: 32, width: 360 }}>
        <div className="label" style={{ marginBottom: 8 }}>Enter your email to continue</div>
        <input
          className="input"
          type="email"
          placeholder="user@example.com"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && val.includes('@') && onSubmit(val.trim())}
          autoFocus
        />
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 14 }}
          disabled={!val.includes('@')}
          onClick={() => onSubmit(val.trim())}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
