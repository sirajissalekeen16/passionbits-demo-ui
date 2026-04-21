import { useState } from 'react'

const TIMEZONES = [
  { label: 'GMT+0 (UTC)', value: '+0' },
  { label: 'GMT+1 (CET)', value: '+1' },
  { label: 'GMT+2 (EET)', value: '+2' },
  { label: 'GMT+3', value: '+3' },
  { label: 'GMT+4', value: '+4' },
  { label: 'GMT+5:30 (IST)', value: '+5:30' },
  { label: 'GMT+5:45 (NPT)', value: '+5:45' },
  { label: 'GMT+6', value: '+6' },
  { label: 'GMT+7 (ICT)', value: '+7' },
  { label: 'GMT+8 (CST)', value: '+8' },
  { label: 'GMT+9 (JST)', value: '+9' },
  { label: 'GMT+10 (AEST)', value: '+10' },
  { label: 'GMT+12', value: '+12' },
  { label: 'GMT-5 (EST)', value: '-5' },
  { label: 'GMT-6 (CST)', value: '-6' },
  { label: 'GMT-7 (MST)', value: '-7' },
  { label: 'GMT-8 (PST)', value: '-8' },
  { label: 'GMT-11', value: '-11' },
]

export default function ScheduleInput({ onChange }) {
  const [enabled, setEnabled] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [tz, setTz] = useState('+0')

  function buildValue(isEnabled, d, t, z) {
    if (!isEnabled || !d || !t) return null
    const [y, m, d_] = d.split('-')
    const [h, min] = t.split(':')
    return `${d_}/${m}/${y}-${h}:${min} GMT${z}`
  }

  function handleDateChange(v) { setDate(v); onChange(buildValue(enabled, v, time, tz)) }
  function handleTimeChange(v) { setTime(v); onChange(buildValue(enabled, date, v, tz)) }
  function handleTzChange(v)   { setTz(v);   onChange(buildValue(enabled, date, time, v)) }
  function handleToggle() {
    const next = !enabled
    setEnabled(next)
    onChange(buildValue(next, date, time, tz))
  }

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', color: '#94a3b8' }}>
        <input type="checkbox" checked={enabled} onChange={handleToggle} style={{ accentColor: '#7c6af7', width: 15, height: 15 }} />
        Schedule post (optional)
      </label>

      {enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid #2a2d3e' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div className="label" style={{ marginBottom: 4 }}>Date</div>
              <input
                type="date"
                className="input"
                value={date}
                onChange={e => handleDateChange(e.target.value)}
              />
            </div>
            <div style={{ flex: '1 1 120px', minWidth: 0 }}>
              <div className="label" style={{ marginBottom: 4 }}>Time (HH:mm)</div>
              <input
                type="time"
                className="input"
                value={time}
                onChange={e => handleTimeChange(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 4 }}>Timezone</div>
            <select className="select" value={tz} onChange={e => handleTzChange(e.target.value)}>
              {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {date && time && (
            <div style={{ fontSize: 12, color: '#64748b', padding: '6px 10px', background: '#0f1117', borderRadius: 6, border: '1px solid #2a2d3e' }}>
              Posts at: <span style={{ color: '#94a3b8' }}>{new Date(date + 'T' + time).toLocaleString()} {tz.replace('+', 'GMT+').replace('-', 'GMT-')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
