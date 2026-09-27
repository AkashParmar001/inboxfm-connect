import { ActivepiecesError, assertNotNullOrUndefined, ErrorCode, isNil } from '@inboxfm-connect/core-utils'
import { CreateAICreditCheckoutSessionParamsSchema, CreateCheckoutSessionParamsSchema, PlatformBillingInformation, PrincipalType, STANDARD_CLOUD_PLAN, UpdateActiveFlowsAddonParamsSchema, UpdateAICreditsAutoTopUpParamsSchema } from '@inboxfm-connect/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { securityAccess } from '../../../core/security/authorization/fastify-security'
import { platformService } from '../../../platform/platform.service'
import { userService } from '../../../user/user-service'
import { platformAiCreditsService } from './platform-ai-credits.service'
import { platformPlanService } from './platform-plan.service'
import { stripeHelper } from './stripe-helper'

export const platformPlanController: FastifyPluginAsyncZod = async (fastify) => {

    fastify.get('/info', InfoRequest, async (request) => {
        const platform = await platformService(request.log).getOneOrThrow(request.principal.platform.id)
        const [platformPlan, usage] = await Promise.all([
            platformPlanService(request.log).getOrCreateForPlatform(platform.id),
            platformPlanService(request.log).getUsage(platform.id),
        ])

        const { stripeSubscriptionCancelDate: cancelDate } = platformPlan
        const { endDate: nextBillingDate } = await platformPlanService(request.log).getBillingDates(platformPlan)

        const nextBillingAmount = await platformPlanService(request.log).getNextBillingAmount({ subscriptionId: platformPlan.stripeSubscriptionId })

        const response: PlatformBillingInformation = {
            plan: platformPlan,
            usage,
            nextBillingAmount,
            nextBillingDate,
            cancelAt: cancelDate,
        }
        return response
    })

    fastify.post('/portal', {
        config: {
            security: securityAccess.platformAdminOnly([PrincipalType.USER]),
        },
    }, async (request) => {
        const stripe = stripeHelper(request.log).getStripe()
        if (isNil(stripe)) {
            throw new ActivepiecesError({
                code: ErrorCode.VALIDATION,
                params: {
                    message: 'Stripe billing is not configured on this instance',
                },
            })
        }
        const platformPlan = await platformPlanService(request.log).getOrCreateForPlatform(request.principal.platform.id)
        if (isNil(platformPlan.stripeCustomerId)) {
            throw new ActivepiecesError({
                code: ErrorCode.VALIDATION,
                params: {
                    message: 'No active Stripe billing customer exists for this platform',
                },
            })
        }
        const url = await stripeHelper(request.log).createPortalSessionUrl(request.principal.platform.id)
        return { url }
    })

    fastify.post('/create-checkout-session', CreateCheckoutSessionRequest, async (request) => {
        const stripe = stripeHelper(request.log).getStripe()
        if (isNil(stripe)) {
            throw new ActivepiecesError({
                code: ErrorCode.VALIDATION,
                params: {
                    message: 'Stripe billing is not configured on this instance',
                },
            })
        }

        const platformPlan = await platformPlanService(request.log).getOrCreateForPlatform(request.principal.platform.id)

        let customerId = platformPlan.stripeCustomerId
        if (isNil(customerId)) {
            const platform = await platformService(request.log).getOneOrThrow(request.principal.platform.id)
            const owner = await userService(request.log).getMetaInformation({ id: platform.ownerId })
            customerId = await stripeHelper(request.log).createCustomer(owner, platform.id)
            await platformPlanService(request.log).update({
                platformId: platform.id,
                stripeCustomerId: customerId,
            })
        }

        const { newActiveFlowsLimit } = request.body

        const baseActiveFlowsLimit = STANDARD_CLOUD_PLAN.activeFlowsLimit ?? 0
        const extraActiveFlows = Math.max(0, newActiveFlowsLimit - baseActiveFlowsLimit)

        if (extraActiveFlows <= 0) {
            throw new ActivepiecesError({
                code: ErrorCode.VALIDATION,
                params: {
                    message: `Requested active flows limit (${newActiveFlowsLimit}) must exceed base plan limit (${baseActiveFlowsLimit}) to purchase additional flows.`,
                },
            })
        }

        const stripeCheckoutUrl = await stripeHelper(request.log).createNewSubscriptionCheckoutSession({
            platformId: platformPlan.platformId,
            customerId,
            extraActiveFlows,
        })
        return { stripeCheckoutUrl, url: stripeCheckoutUrl }
    })

    fastify.post('/update-active-flows-addon', UpdateActiveFlowsAddonRequest, async (request) => {
        const stripe = stripeHelper(request.log).getStripe()
        if (isNil(stripe)) {
            throw new ActivepiecesError({
                code: ErrorCode.VALIDATION,
                params: {
                    message: 'Stripe billing is not configured on this instance',
                },
            })
        }

        const { stripeCustomerId: customerId, ...platformPlan } = await platformPlanService(request.log).getOrCreateForPlatform(request.principal.platform.id)
        if (isNil(customerId)) {
            throw new ActivepiecesError({
                code: ErrorCode.VALIDATION,
                params: {
                    message: 'No active Stripe billing customer exists for this platform',
                },
            })
        }

        const { newActiveFlowsLimit } = request.body

        const baseActiveFlowsLimit = STANDARD_CLOUD_PLAN.activeFlowsLimit ?? 0
        const currentActiveFlowsLimit =  platformPlan.activeFlowsLimit ?? 0
        const extraActiveFlows = Math.max(0, newActiveFlowsLimit - baseActiveFlowsLimit)
        const isFreeDowngrade = newActiveFlowsLimit === baseActiveFlowsLimit

        assertNotNullOrUndefined(platformPlan.stripeSubscriptionId, 'Subscription doesnt exist')

        const isUpgrade = newActiveFlowsLimit > currentActiveFlowsLimit
        return stripeHelper(request.log).handleSubscriptionUpdate({
            subscriptionId: platformPlan.stripeSubscriptionId,
            extraActiveFlows,
            isUpgrade, 
            isFreeDowngrade,
        })
    })

    // AI Credits
    fastify.post('/ai-credits/create-checkout-session', CreateAICreditCheckoutSessionRequest, async (request) => {
        return platformAiCreditsService(request.log).initializeStripeAiCreditsPayment(request.principal.platform.id, request.body)
    })
    fastify.post('/ai-credits/auto-topup', UpdateAICreditsAutoTopUpRequest, async (request) => {
        return platformAiCreditsService(request.log).updateAutoTopUp(request.principal.platform.id, request.body)
    })
}

const InfoRequest = {
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
    response: {
        [StatusCodes.OK]: PlatformBillingInformation,
    },
}

const UpdateActiveFlowsAddonRequest = {
    schema: {
        body: UpdateActiveFlowsAddonParamsSchema,
    },
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
}

const CreateCheckoutSessionRequest = {
    schema: {
        body: CreateCheckoutSessionParamsSchema,
    },
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
}

const CreateAICreditCheckoutSessionRequest = {
    schema: {
        body: CreateAICreditCheckoutSessionParamsSchema,
        response: {
            [StatusCodes.OK]: z.object({
                stripeCheckoutUrl: z.string(),
            }),
        },
    },
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
}

const UpdateAICreditsAutoTopUpRequest = {
    schema: {
        body: UpdateAICreditsAutoTopUpParamsSchema,
        [StatusCodes.OK]: z.object({
            stripeCheckoutUrl: z.string().optional(),
        }),
    },
    config: {
        security: securityAccess.platformAdminOnly([PrincipalType.USER]),
    },
}
