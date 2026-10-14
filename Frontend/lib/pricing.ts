// Single source of truth for prices shown on the web. Must match the Stripe prices behind
// STRIPE_PRICE_MONTHLY / STRIPE_PRICE_SEMESTER on the backend (and the iOS products).
export const PRICING = {
  monthly: { amount: 4.99, label: '$4.99', per: '/month' },
  semester: { amount: 19.99, label: '$19.99', per: 'every 6 months', name: 'Semester Pass' },
} as const

/** "Dec 20" from "2026-12-20" (promo end date, local-time safe). */
export function promoEndLabel(ymd: string | null | undefined): string {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
