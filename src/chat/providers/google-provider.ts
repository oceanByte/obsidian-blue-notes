import { BaseHttpProvider, HttpProviderConfig } from './base-http-provider'
import { ChatRequest } from './chat-provider-interface'
import { Logger } from '../../utils/logger'
import { ProviderRegistry } from './provider-config'
import { requestUrl } from 'obsidian'

export class GoogleProvider extends BaseHttpProvider {
  protected config: HttpProviderConfig = {
    name: 'Google',
    chatEndpoint: `https://generativelanguage.googleapis.com/v1/models/${
      this.model
    }:generateContent`,
    validateEndpoint: `https://generativelanguage.googleapis.com/v1/models/${this.model}`,
    authHeader: (apiKey: string) => ({
      'x-goog-api-key': apiKey,
    }),
    buildRequestBody: (request: ChatRequest) => {
      const body: Record<string, object> = {
        contents: [
          {
            parts: request.messages.map((m) => ({
              text: m.content,
            })),
          },
        ],
        generationConfig:{
          maxOutputTokens: request.maxTokens ?? 2000,
        }
      }

      if (request.temperature !== undefined) {
        body.generationConfig = { ...body.generationConfig, temperature: request.temperature }
      }

      return body
    },
  }
  request: any

  async validateApiKey(): Promise<boolean> {
    Logger.debug(this.apiKey)
    if (!this.isConfigured()) {
      Logger.debug('Google API key not configured')
      return false
    }

    try {
      Logger.debug('Validating Google API key:', {
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

      Logger.debug('Google API key validation successful')
      return response.status === 200
    } catch (error) {
      Logger.error('Google API key validation failed:', error)
      return false
    }
  }
}

ProviderRegistry.register({
  id: 'google',
  name: 'Google',
  createProvider: (apiKey: string, model: string) =>
    new GoogleProvider(apiKey, model),
  defaultModel: 'gemini-2.5-flash',
  availableModels: [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  ],
  apiKeyPlaceholder: 'GOOGLE_API_KEY',
})
