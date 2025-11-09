import { BaseHttpProvider, HttpProviderConfig } from './base-http-provider'
import { ChatRequest } from './chat-provider-interface'
import { Logger } from '../../utils/logger'
import { ProviderRegistry } from './provider-config'
import { requestUrl } from 'obsidian'

export class AnthropicProvider extends BaseHttpProvider {
  protected config: HttpProviderConfig = {
    name: 'Anthropic',
    chatEndpoint: 'https://api.anthropic.com/v1/messages',
    validateEndpoint: 'https://api.anthropic.com/v1/messages',
    authHeader: (apiKey: string) => ({
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    buildRequestBody: (request: ChatRequest, model: string) => {

      const messages = request.messages.filter((m) => m.role !== 'system')
      const systemMessage = request.messages.find((m) => m.role === 'system')

      const body: Record<string, unknown> = {
        model,
        max_tokens: request.maxTokens ?? 2000,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }

      if (systemMessage) {
        body.system = systemMessage.content
      }

      if (request.temperature !== undefined) {
        body.temperature = request.temperature
      }

      if (request.stream) {
        body.stream = true
      }

      return body
    },
    parseResponse: (data: unknown) => {
      const response = data as {
        content: Array<{ text: string }>;
        model: string;
        usage?: {
          input_tokens: number;
          output_tokens: number;
        };
      }

      return {
        content: response.content[0].text,
        model: response.model,
        usage: response.usage
          ? {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          }
          : undefined,
      }
    },
    parseStreamChunk: (json: unknown) => {
      const chunk = json as {
        type?: string;
        delta?: { text?: string };
      }
      return chunk.type === 'content_block_delta' && chunk.delta?.text
        ? chunk.delta.text
        : null
    },
  }

  async validateApiKey(): Promise<boolean> {
    if (!this.isConfigured()) {
      Logger.debug('Anthropic API key not configured')
      return false
    }

    try {
      Logger.debug('Validating Anthropic API key:', {
        model: this.model,
        apiKeyPrefix: this.apiKey.substring(0, 15) + '...',
      })

      const response = await requestUrl({
        url: this.config.validateEndpoint,
        method: 'POST',
        headers: {
          ...this.config.authHeader(this.apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      })

      Logger.debug('Anthropic API key validation successful')
      return response.status === 200
    } catch (error) {
      Logger.error('Anthropic API key validation failed:', error)
      return false
    }
  }
}

ProviderRegistry.register({
  id: 'anthropic',
  name: 'Anthropic',
  createProvider: (apiKey: string, model: string) => new AnthropicProvider(apiKey, model),
  defaultModel: 'claude-sonnet-4-5-20250929',
  availableModels: [
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1' },
  ],
  apiKeyPlaceholder: 'sk-ant-...',
})
