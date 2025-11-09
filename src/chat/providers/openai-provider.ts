import { BaseHttpProvider, HttpProviderConfig } from './base-http-provider'
import { ChatRequest } from './chat-provider-interface'
import { ProviderRegistry } from './provider-config'

export class OpenAIProvider extends BaseHttpProvider {
  protected config: HttpProviderConfig = {
    name: 'OpenAI',
    chatEndpoint: 'https://api.openai.com/v1/chat/completions',
    validateEndpoint: 'https://api.openai.com/v1/models',
    authHeader: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    buildRequestBody: (request: ChatRequest, model: string) => {
      const isGPT5 = model.startsWith('gpt-5')

      const body: Record<string, unknown> = {
        model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }

      if (isGPT5) {
        body.max_completion_tokens = request.maxTokens ?? 2000
      } else {
        body.max_tokens = request.maxTokens ?? 2000
        body.temperature = request.temperature ?? 0.7
      }

      if (request.stream) {
        body.stream = true
      }

      return body
    },
  }
}

ProviderRegistry.register({
  id: 'openai',
  name: 'OpenAI',
  createProvider: (apiKey: string, model: string) => new OpenAIProvider(apiKey, model),
  defaultModel: 'gpt-5',
  availableModels: [
    { id: 'gpt-5', name: 'GPT-5' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
  ],
  apiKeyPlaceholder: 'sk-...',
})
