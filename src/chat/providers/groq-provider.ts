import { BaseHttpProvider, HttpProviderConfig } from './base-http-provider'
import { ProviderRegistry } from './provider-config'

export class GroqProvider extends BaseHttpProvider {
  protected config: HttpProviderConfig = {
    name: 'Groq',
    chatEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    validateEndpoint: 'https://api.groq.com/openai/v1/models',
    authHeader: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
  }
}

ProviderRegistry.register({
  id: 'groq',
  name: 'Groq',
  createProvider: (apiKey: string, model: string) => new GroqProvider(apiKey, model),
  defaultModel: 'llama-3.3-70b-versatile',
  availableModels: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
    { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B' },
  ],
  apiKeyPlaceholder: 'gsk_...',
})
