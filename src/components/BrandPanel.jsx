// ── BrandPanel — shows rich brand intelligence in a collapsible panel ─────────
export default function BrandPanel({ rich }) {
  if (!rich) return null

  const idProduct = [
    ['Core Identity', rich.core_identity],
    ['Products', rich.product_offering],
    ['Unique Benefits', rich.unique_benefits],
    ['Problem Solved', rich.problem_solution],
  ].filter(([, v]) => v)

  const purpose = [
    ['Mission', rich.mission],
    ['Why Customers Care', rich.why_care],
    ['Differentiation', rich.differentiation],
    ['Brand Resonance', rich.brand_resonance],
    ['Owned Space', rich.owned_space],
  ].filter(([, v]) => v)

  const competitors = rich.competitors || []

  if (!idProduct.length && !purpose.length && !competitors.length) return null

  return (
    <details open style={{ marginTop: 2 }}>
      <summary style={{
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        color: '#94a3b8',
        userSelect: 'none',
        listStyle: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{ fontSize: 10 }}>▶</span>
        Brand Intelligence
      </summary>

      <div style={{
        marginTop: 10,
        background: '#0a0d18',
        border: '1px solid #1e2537',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>

        {idProduct.length > 0 && (
          <div>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.7px',
              marginBottom: 8,
            }}>
              Identity & Product
            </div>
            {idProduct.map(([label, value]) => (
              <div key={label} style={{ fontSize: 12, marginBottom: 5, lineHeight: 1.5 }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{label}: </span>
                <span style={{ color: '#cbd5e1' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {purpose.length > 0 && (
          <div>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.7px',
              marginBottom: 8,
            }}>
              Purpose & Positioning
            </div>
            {purpose.map(([label, value]) => (
              <div key={label} style={{ fontSize: 12, marginBottom: 5, lineHeight: 1.5 }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{label}: </span>
                <span style={{ color: '#cbd5e1' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {competitors.length > 0 && (
          <div>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.7px',
              marginBottom: 8,
            }}>
              Competitors
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {competitors.map(c => (
                <span key={c} style={{
                  background: '#1e2537',
                  border: '1px solid #2a2d3e',
                  borderRadius: 20,
                  padding: '3px 10px',
                  fontSize: 11,
                  color: '#94a3b8',
                }}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </details>
  )
}
