import { BaseHttpProvider, HttpProviderConfig } from './base-http-provider'
import { ProviderRegistry } from './provider-config'

export class OpenAIProvider extends BaseHttpProvider {
  protected config: HttpProviderConfig = {
    name: 'OpenAI',
    chatEndpoint: 'https://api.openai.com/v1/chat/completions',
    validateEndpoint: 'https://api.openai.com/v1/models',
    authHeader: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
  }
}

ProviderRegistry.register({
  id: 'openai',
  name: 'OpenAI',
  createProvider: (apiKey: string, model: string) => new OpenAIProvider(apiKey, model),
  defaultModel: 'gpt-4o',
  availableModels: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  ],
  apiKeyPlaceholder: 'sk-...',
  validateEndpoint: 'https://api.openai.com/v1/models',
})
