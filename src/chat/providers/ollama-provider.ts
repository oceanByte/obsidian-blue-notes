import { BaseHttpProvider, HttpProviderConfig } from './base-http-provider'
import {
  ChatProviderError,
  ChatRequest,
  ChatResponse,
} from './chat-provider-interface'
import { Logger } from '../../utils/logger'
import { ProviderRegistry } from './provider-config'
import { requestUrl } from 'obsidian'

export class OllamaProvider extends BaseHttpProvider {
  private serverUrl: string

  constructor(serverUrl: string, model: string) {
    super(serverUrl, model)
    this.serverUrl = serverUrl || 'http://localhost:11434'
  }

  protected config: HttpProviderConfig = {
    name: 'Ollama',
    chatEndpoint: '',
    validateEndpoint: '',
    authHeader: () => ({}),
    buildRequestBody: (request: ChatRequest, model: string) => {
      return {
        model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: request.stream ?? false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 2000,
        },
      }
    },
    parseResponse: (data: unknown) => {
      const response = data as {
        model: string;
        message: {
          role: string;
          content: string;
        };
        done: boolean;
      }

      return {
        content: response.message.content,
        model: response.model,
      }
    },
    parseStreamChunk: (json: unknown) => {
      const chunk = json as {
        message?: {
          content?: string;
        };
        done?: boolean;
      }
      return chunk.message?.content || null
    },
  }

  get name(): string {
    return this.config.name
  }

  isConfigured(): boolean {
    return this.serverUrl.length > 0
  }

  async validateApiKey(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false
    }

    try {
      const response = await requestUrl({
        url: `${this.serverUrl}/api/tags`,
        method: 'GET',
      })

      if (response.status === 200) {
        return true
      }

      return false
    } catch (error) {
      Logger.error('Ollama server validation failed:', error)
      return false
    }
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    if (!this.isConfigured()) {
      throw new ChatProviderError(
        'Ollama server URL not configured',
        'MISSING_SERVER_URL',
      )
    }

    try {
      const body = this.config.buildRequestBody
        ? this.config.buildRequestBody(request, this.model)
        : this.buildRequestBody(request)

      Logger.debug('Sending request to Ollama:', {
        model: this.model,
        messageCount: request.messages.length,
      })

      const response = await requestUrl({
        url: `${this.serverUrl}/api/chat`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (response.status !== 200) {
        throw this.handleOllamaError(response)
      }

      const data = response.json

      return this.config.parseResponse
        ? this.config.parseResponse(data)
        : this.defaultParseResponse(data)
    } catch (error) {
      if (error instanceof ChatProviderError) {
        throw error
      }
      throw new ChatProviderError(
        `Ollama request failed: ${error.message}`,
        'REQUEST_FAILED',
      )
    }
  }

  async *streamMessage(
    request: ChatRequest,
  ): AsyncGenerator<string, void, unknown> {
    if (!this.isConfigured()) {
      throw new ChatProviderError(
        'Ollama server URL not configured',
        'MISSING_SERVER_URL',
      )
    }

    const body = this.config.buildRequestBody
      ? this.config.buildRequestBody({ ...request, stream: true }, this.model)
      : this.buildRequestBody({ ...request, stream: true })

    try {
      const response = await fetch(`${this.serverUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw this.handleOllamaError({
          status: response.status,
          json: await response.json(),
        })
      }

      yield* this.parseOllamaStreamResponse(response)
    } catch (error) {
      if (error instanceof ChatProviderError) {
        throw error
      }
      throw new ChatProviderError(
        `Ollama streaming failed: ${error.message}`,
        'STREAM_FAILED',
      )
    }
  }

  private async *parseOllamaStreamResponse(
    response: Response,
  ): AsyncGenerator<string, void, unknown> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new ChatProviderError('No response body', 'NO_RESPONSE_BODY')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed === '') {
          continue
        }

        try {
          const json = JSON.parse(trimmed)
          const content = this.config.parseStreamChunk
            ? this.config.parseStreamChunk(json)
            : null

          if (content) {
            yield content
          }

          if (json.done) {
            return
          }
        } catch {
          Logger.warn('Failed to parse Ollama stream line:', trimmed)
        }
      }
    }
  }

  private handleOllamaError(response: {
    status: number;
    json: unknown;
  }): ChatProviderError {
    const status = response.status
    const data = response.json as {
      error?: string;
    }

    let message = 'Unknown error'
    const code = 'UNKNOWN_ERROR'

    if (data?.error) {
      message = data.error
    }

    switch (status) {
    case 404:
      return new ChatProviderError(
        `Model '${this.model}' not found. Make sure the model is pulled in Ollama.`,
        'MODEL_NOT_FOUND',
        status,
      )
    case 500:
    case 502:
    case 503:
      return new ChatProviderError(
        'Ollama server is temporarily unavailable. Please try again later.',
        'SERVICE_UNAVAILABLE',
        status,
      )
    default:
      return new ChatProviderError(message, code, status)
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await requestUrl({
        url: `${this.serverUrl}/api/tags`,
        method: 'GET',
      })

      if (response.status === 200) {
        const data = response.json as { models: Array<{ name: string }> }
        return data.models.map((m) => m.name)
      }

      return []
    } catch (error) {
      Logger.error('Failed to fetch Ollama models:', error)
      return []
    }
  }
}

ProviderRegistry.register({
  id: 'ollama',
  name: 'Ollama',
  createProvider: (serverUrl: string, model: string) =>
    new OllamaProvider(serverUrl, model),
  defaultModel: 'llama2',
  availableModels: [
    { id: 'llama2', name: 'Llama 2' },
    { id: 'llama3', name: 'Llama 3' },
    { id: 'mistral', name: 'Mistral' },
    { id: 'gemma', name: 'Gemma' },
    { id: 'codellama', name: 'Code Llama' },
  ],
  apiKeyPlaceholder: 'http://localhost:11434',
})
