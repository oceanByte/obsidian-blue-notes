import { BaseHttpProvider, HttpProviderConfig } from './base-http-provider'
import { ProviderRegistry } from './provider-config'

export class RequestyProvider extends BaseHttpProvider {
  protected config: HttpProviderConfig = {
    name: 'Requesty',
    chatEndpoint: 'https://router.requesty.ai/v1/chat/completions',
    validateEndpoint: 'https://router.requesty.ai/v1/models',
    authHeader: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
  }
}

ProviderRegistry.register({
  id: 'requesty',
  name: 'Requesty',
  createProvider: (apiKey: string, model: string) => new RequestyProvider(apiKey, model),
  defaultModel: 'openai/gpt-4o',
  availableModels: [
    { id: 'openai/gpt-5', name: 'OpenAI GPT-5' },
    { id: 'openai/gpt-5-mini', name: 'OpenAI GPT-5 Mini' },
    { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o' },
    { id: 'anthropic/claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'openai/o3-mini', name: 'OpenAI o3-mini' },
    { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat' },
  ],
  apiKeyPlaceholder: 'rq_...',
})
