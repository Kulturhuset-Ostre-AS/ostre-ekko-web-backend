'use client'
/**
 * Salgsrapporter — custom admin view på /admin/rapporter.
 * Forhåndsvalg: denne måneden, hittil i år, kalenderår (velgbart), pluss fritt
 * tidsrom og per-arrangement-filter. Data fra /api/commerce/reports/sales
 * (admin-cookien følger med automatisk — samme origin). CSV-eksport per utvalg.
 */
import React, { useCallback, useEffect, useState } from 'react'

type Report = {
  orders: number
  totalOre: number
  events: { eventId: number | null; eventTitle: string; tickets: number; revenueOre: number; perType: Record<string, { quantity: number; revenueOre: number }> }[]
  membership: { count: number; revenueOre: number; perType: Record<string, { quantity: number; revenueOre: number }> }
}

const kr = (ore: number) => (ore / 100).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr'
const iso = (d: Date) => d.toISOString()

export default function SalesReports() {
  const now = new Date()
  const [from, setFrom] = useState(() => iso(new Date(now.getFullYear(), now.getMonth(), 1)).slice(0, 10))
  const [to, setTo] = useState(() => iso(now).slice(0, 10))
  const [year, setYear] = useState(now.getFullYear())
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async (f: string, t: string) => {
    setError('')
    try {
      const r = await fetch(`/api/commerce/reports/sales?from=${f}T00:00:00.000Z&to=${t}T23:59:59.999Z`, { credentials: 'include' })
      if (!r.ok) throw new Error(`${r.status}`)
      setReport(await r.json())
    } catch (e) {
      setError('Kunne ikke hente rapporten (' + String(e) + ')')
    }
  }, [])

  useEffect(() => { load(from, to) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const preset = (f: Date, t: Date) => {
    const fs = iso(f).slice(0, 10), ts = iso(t).slice(0, 10)
    setFrom(fs); setTo(ts); load(fs, ts)
  }

  const csvHref = `/api/commerce/reports/sales?from=${from}T00:00:00.000Z&to=${to}T23:59:59.999Z&format=csv`
  const cell: React.CSSProperties = { padding: '6px 12px', borderBottom: '1px solid var(--theme-elevation-150)', textAlign: 'left' }

  return (
    <div style={{ padding: 'calc(var(--base) * 2)' }}>
      <h1>Salgsrapporter</h1>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0', alignItems: 'center' }}>
        <button type="button" onClick={() => preset(new Date(now.getFullYear(), now.getMonth(), 1), now)}>Denne måneden</button>
        <button type="button" onClick={() => preset(new Date(now.getFullYear(), 0, 1), now)}>Hittil i år</button>
        <span>
          Kalenderår:{' '}
          <select value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); preset(new Date(y, 0, 1), new Date(y, 11, 31)) }}>
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </span>
        <span style={{ marginLeft: 12 }}>
          Fra <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />{' '}
          Til <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />{' '}
          <button type="button" onClick={() => load(from, to)}>Hent</button>
        </span>
        <a href={csvHref} style={{ marginLeft: 'auto' }}>Last ned CSV</a>
      </div>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {report && (
        <>
          <p><strong>{report.orders}</strong> ordre · totalt <strong>{kr(report.totalOre)}</strong></p>

          <h2 style={{ marginTop: 24 }}>Billetter per arrangement</h2>
          {report.events.length === 0 && <p>Ingen billettsalg i perioden.</p>}
          {report.events.map((e) => (
            <details key={String(e.eventId)} style={{ margin: '8px 0' }} open={report.events.length <= 3}>
              <summary style={{ cursor: 'pointer' }}>
                <strong>{e.eventTitle}</strong> — {e.tickets} billetter, {kr(e.revenueOre)}
              </summary>
              <table style={{ borderCollapse: 'collapse', margin: '8px 0 8px 16px' }}>
                <thead><tr><th style={cell}>Billettype</th><th style={cell}>Antall</th><th style={cell}>Omsetning</th></tr></thead>
                <tbody>
                  {Object.entries(e.perType).map(([name, t]) => (
                    <tr key={name}><td style={cell}>{name}</td><td style={cell}>{t.quantity}</td><td style={cell}>{kr(t.revenueOre)}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}

          <h2 style={{ marginTop: 24 }}>Medlemskap</h2>
          {report.membership.count === 0 ? <p>Ingen medlemskapssalg i perioden.</p> : (
            <table style={{ borderCollapse: 'collapse' }}>
              <thead><tr><th style={cell}>Type</th><th style={cell}>Antall</th><th style={cell}>Omsetning</th></tr></thead>
              <tbody>
                {Object.entries(report.membership.perType).map(([name, t]) => (
                  <tr key={name}><td style={cell}>{name === 'ordinary' ? 'Ordinært' : name === 'student' ? 'Student' : name}</td><td style={cell}>{t.quantity}</td><td style={cell}>{kr(t.revenueOre)}</td></tr>
                ))}
                <tr><td style={cell}><strong>Sum</strong></td><td style={cell}><strong>{report.membership.count}</strong></td><td style={cell}><strong>{kr(report.membership.revenueOre)}</strong></td></tr>
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
