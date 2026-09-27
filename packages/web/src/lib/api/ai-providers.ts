import type {
  AIProviderModel,
  AIProviderWithoutSensitiveData,
  CreateAIProviderRequest,
  UpdateAIProviderRequest,
} from '@inboxfm-connect/shared'
import { apiClient } from './client'

export enum AIProviderName {
  OPENAI = 'openai',
  OPENROUTER = 'openrouter',
  ANTHROPIC = 'anthropic',
  AZURE = 'azure',
  GOOGLE = 'google',
  ACTIVEPIECES = 'activepieces',
  CLOUDFLARE_GATEWAY = 'cloudflare-gateway',
  CUSTOM = 'custom',
  BEDROCK = 'bedrock',
  MISTRAL = 'mistral',
}

export enum AIProviderModelType {
  IMAGE = 'image',
  TEXT = 'text',
}

const AI_PROVIDERS_PATH = '/ai-providers'

const aiProvidersApi = {
  list(): Promise<AIProviderWithoutSensitiveData[]> {
    return apiClient.get<AIProviderWithoutSensitiveData[]>(AI_PROVIDERS_PATH)
  },

  listModels(provider: AIProviderName): Promise<AIProviderModel[]> {
    return apiClient.get<AIProviderModel[]>(`${AI_PROVIDERS_PATH}/${encodeURIComponent(provider)}/models`)
  },

  create(request: CreateAIProviderRequest): Promise<void> {
    return apiClient.post<void>(AI_PROVIDERS_PATH, request)
  },

  update(id: string, request: UpdateAIProviderRequest): Promise<void> {
    return apiClient.post<void>(`${AI_PROVIDERS_PATH}/${encodeURIComponent(id)}`, request)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete<void>(`${AI_PROVIDERS_PATH}/${encodeURIComponent(id)}`)
  },
}

export { aiProvidersApi }
