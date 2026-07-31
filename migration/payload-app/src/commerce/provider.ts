import { randomUUID } from 'crypto'

// Payment-provider abstraction. Fase 1 ships with a mock provider only (no
// Vipps merchant agreement yet — Vipps has no public sandbox without one).
// The real Vipps MobilePay Checkout provider slots in here later with the same
// shape: createSession() returns a hosted-payment redirect, and payment
// completion arrives out-of-band (webhook for Vipps, the mock-pay endpoint for
// the mock) and goes through the same fulfilment code path.

export type CheckoutSession = {
  providerRef: string
  redirectUrl: string
}

export type PaymentProvider = {
  name: 'mock' | 'vipps'
  createSession(args: {
    orderId: number | string
    amountOre: number
    description: string
    serverURL: string
  }): Promise<CheckoutSession>
}

const mockProvider: PaymentProvider = {
  name: 'mock',
  createSession: async ({ orderId, serverURL }) => ({
    providerRef: `mock-${orderId}-${randomUUID().slice(0, 8)}`,
    redirectUrl: `${serverURL}/api/commerce/mock-pay?order=${orderId}`,
  }),
}

export function getProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER === 'vipps') {
    throw new Error('Vipps provider not implemented yet (awaiting merchant agreement) — unset PAYMENT_PROVIDER to use the mock')
  }
  return mockProvider
}
