// Season model for memberships (see docs/medlemskapssalg-plan.md and the client
// doc "Oppsett nettside medlemskap"): memberships are valid for the current
// season, not rolling 12 months.
//   Spring: valid until Jun 30, on sale from Dec 1 (of the previous year).
//   Autumn: valid until Dec 31, on sale from May 1.
// The season windows are deliberately code-side (deterministic, no editor
// mistakes); prices and the master on/off switch live in the membership-config
// global.

export type Season = {
  /** Stable key stored on orders, e.g. "2027-var" / "2026-host" */
  key: string
  /** Editor/buyer-facing label, e.g. "Vår 2027" */
  label: string
  /** Membership expiry for this season (end of day, local time) */
  validUntil: Date
}

/** The season currently on sale, given the sales windows above:
 *  Dec -> next year's spring; Jan-Apr -> this year's spring; May-Nov -> autumn. */
export function seasonOnSale(now: Date): Season {
  const y = now.getFullYear()
  const m = now.getMonth() // 0-based
  if (m === 11) return spring(y + 1)
  if (m <= 3) return spring(y)
  return autumn(y)
}

/** Rebuild a Season from its stored key ("2027-var" / "2026-host"), so
 *  fulfilment derives validUntil from what the order was created for, not from
 *  when the webhook happens to arrive. */
export function seasonFromKey(key: string): Season | null {
  const m = /^(\d{4})-(var|host)$/.exec(key)
  if (!m) return null
  return m[2] === 'var' ? spring(Number(m[1])) : autumn(Number(m[1]))
}

function spring(year: number): Season {
  return { key: `${year}-var`, label: `Vår ${year}`, validUntil: endOfDay(year, 5, 30) }
}

function autumn(year: number): Season {
  return { key: `${year}-host`, label: `Høst ${year}`, validUntil: endOfDay(year, 11, 31) }
}

function endOfDay(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 23, 59, 59)
}
