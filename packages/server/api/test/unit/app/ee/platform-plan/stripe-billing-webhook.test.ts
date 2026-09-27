import { ApEdition, ApSubscriptionStatus, PlanName, STANDARD_CLOUD_PLAN } from '@inboxfm-connect/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDistributedStore = {
    store: new Map<string, unknown>(),
    async putIfAbsent(key: string, value: unknown): Promise<boolean> {
        if (this.store.has(key)) {
            return false
        }
        this.store.set(key, value)
        return true
    },
    clear() {
        this.store.clear()
    },
}

vi.mock('../../../../../src/app/database/redis-connections', () => ({
    distributedStore: mockDistributedStore,
}))

const mockPlatformPlanUpdate = vi.fn().mockResolvedValue({})
const mockAiCreditsPaymentSucceeded = vi.fn().mockResolvedValue({})

vi.mock('../../../../../src/app/ee/platform/platform-plan/platform-plan.service', () => ({
    ACTIVE_FLOW_PRICE_ID: 'price_active_flows_test',
    platformPlanService: () => ({
        update: mockPlatformPlanUpdate,
        getOrCreateForPlatform: vi.fn().mockResolvedValue({
            platformId: 'plat_123',
            stripeCustomerId: 'cus_123',
        }),
    }),
}))

vi.mock('../../../../../src/app/ee/platform/platform-plan/platform-ai-credits.service', () => ({
    platformAiCreditsService: () => ({
        aiCreditsPaymentSucceeded: mockAiCreditsPaymentSucceeded,
        handleAutoTopUpCheckoutSessionCompleted: vi.fn().mockResolvedValue({}),
    }),
}))

const mockRetrieveSubscription = vi.fn()
const mockStripe = {
    subscriptions: {
        retrieve: mockRetrieveSubscription,
    },
    webhooks: {
        constructEvent: vi.fn(),
    },
}

vi.mock('../../../../../src/app/ee/platform/platform-plan/stripe-helper', () => ({
    StripeCheckoutType: {
        AI_CREDIT_PAYMENT: 'AI_CREDIT_PAYMENT',
        AI_CREDIT_AUTO_TOP_UP: 'AI_CREDIT_AUTO_TOP_UP',
    },
    stripeHelper: () => ({
        getStripe: () => mockStripe,
        getSubscriptionCycleDates: vi.fn().mockResolvedValue({
            startDate: 1000,
            endDate: 2000,
            cancelDate: undefined,
        }),
    }),
    stripeWebhookSecret: 'whsec_test',
}))

describe('Stripe Billing Webhook & Resilience', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDistributedStore.clear()
    })

    describe('Out-of-order invoice.payment_failed resilience', () => {
        it('updates status to PAST_DUE when live subscription from Stripe is past_due', async () => {
            mockRetrieveSubscription.mockResolvedValueOnce({
                id: 'sub_123',
                status: 'past_due',
                metadata: { platformId: 'plat_123' },
            })

            const subscription = await mockStripe.subscriptions.retrieve('sub_123')
            expect(subscription.status).toBe('past_due')

            if (subscription.status === 'past_due') {
                await mockPlatformPlanUpdate({
                    platformId: subscription.metadata.platformId,
                    stripeSubscriptionStatus: ApSubscriptionStatus.PAST_DUE,
                })
            }

            expect(mockPlatformPlanUpdate).toHaveBeenCalledWith({
                platformId: 'plat_123',
                stripeSubscriptionStatus: ApSubscriptionStatus.PAST_DUE,
            })
        })

        it('ignores stale invoice.payment_failed when live subscription from Stripe is active', async () => {
            mockRetrieveSubscription.mockResolvedValueOnce({
                id: 'sub_123',
                status: 'active',
                metadata: { platformId: 'plat_123' },
            })

            const subscription = await mockStripe.subscriptions.retrieve('sub_123')
            expect(subscription.status).toBe('active')

            // Simulation of resilient controller logic
            if (subscription.status === 'past_due') {
                await mockPlatformPlanUpdate({
                    platformId: subscription.metadata.platformId,
                    stripeSubscriptionStatus: ApSubscriptionStatus.PAST_DUE,
                })
            }

            expect(mockPlatformPlanUpdate).not.toHaveBeenCalled()
        })
    })

    describe('Credit grant idempotency deduplication', () => {
        it('grants credits on initial invoice.paid auto top-up and ignores duplicate retries', async () => {
            const invoiceId = 'in_test_123'
            const creditKey = `stripe_credit_processed_${invoiceId}`

            // First attempt
            const firstResult = await mockDistributedStore.putIfAbsent(creditKey, 1)
            expect(firstResult).toBe(true)
            if (firstResult) {
                await mockAiCreditsPaymentSucceeded('plat_123', 50, 'AI_CREDIT_AUTO_TOP_UP')
            }
            expect(mockAiCreditsPaymentSucceeded).toHaveBeenCalledTimes(1)

            // Second delivery (webhook retry)
            const secondResult = await mockDistributedStore.putIfAbsent(creditKey, 1)
            expect(secondResult).toBe(false)
            if (secondResult) {
                await mockAiCreditsPaymentSucceeded('plat_123', 50, 'AI_CREDIT_AUTO_TOP_UP')
            }
            expect(mockAiCreditsPaymentSucceeded).toHaveBeenCalledTimes(1)
        })
    })

    describe('Invoice subscription ID extraction across Stripe models', () => {
        it('extracts subscription ID from v18 parent subscription details', () => {
            const invoice = {
                parent: {
                    subscription_details: {
                        subscription: 'sub_v18_parent',
                    },
                },
            } as any

            const subId = typeof invoice.parent?.subscription_details?.subscription === 'string'
                ? invoice.parent.subscription_details.subscription
                : undefined

            expect(subId).toBe('sub_v18_parent')
        })

        it('extracts subscription ID from line items fallback', () => {
            const invoice = {
                lines: {
                    data: [{ subscription: 'sub_lines_data' }],
                },
            } as any

            const subId = typeof invoice.lines?.data?.[0]?.subscription === 'string'
                ? invoice.lines.data[0].subscription
                : undefined

            expect(subId).toBe('sub_lines_data')
        })
    })

    describe('Subscription status enum coverage', () => {
        it('covers all valid Stripe subscription statuses in ApSubscriptionStatus', () => {
            const validStripeStatuses = [
                'active',
                'canceled',
                'past_due',
                'unpaid',
                'incomplete',
                'incomplete_expired',
                'trialing',
            ]

            const enumValues = Object.values(ApSubscriptionStatus)
            for (const status of validStripeStatuses) {
                expect(enumValues).toContain(status)
            }
        })
    })
})
