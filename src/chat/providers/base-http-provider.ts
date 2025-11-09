import { Logger } from '../../utils/logger'
import { requestUrl } from 'obsidian'

import {
  ChatProvider,
  ChatProviderError,
  ChatRequest,
  ChatResponse,
} from './chat-provider-interface'

/**
 * Configuration for HTTP-based chat providers
 */
export interface HttpProviderConfig {
  name: string;
  chatEndpoint: string;
  validateEndpoint: string;
  authHeader: (apiKey: string) => Record<string, string>;
  buildRequestBody?: (request: ChatRequest, model: string) => Record<string, unknown>;
  parseResponse?: (data: unknown) => { content: string; model: string; usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }};
  parseStreamChunk?: (json: unknown) => string | null;
  streamDoneMarker?: string;
}

/**
 * Base class for HTTP-based chat providers
 * Eliminates duplication of HTTP logic, streaming, and error handling
 */
export abstract class BaseHttpProvider extends ChatProvider {
  protected abstract config: HttpProviderConfig

  constructor(
    public apiKey: string,
    public model: string,
  ) {
    super()
  }

  get name(): string {
    return this.config.name
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0
  }

  async validateApiKey(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false
    }

    try {
      const response = await requestUrl({
        url: this.config.validateEndpoint,
        method: 'GET',
        headers: this.config.authHeader(this.apiKey),
      })

      return response.status === 200
    } catch (error) {
      Logger.error(`${this.config.name} API key validation failed:`, error)
      return false
    }
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    if (!this.isConfigured()) {
      throw new ChatProviderError(
        `${this.config.name} API key not configured`,
        'MISSING_API_KEY',
      )
    }

    try {
      const body = this.config.buildRequestBody
        ? this.config.buildRequestBody(request, this.model)
        : this.buildRequestBody(request)

      Logger.debug(`Sending request to ${this.config.name}:`, {
        model: this.model,
        messageCount: request.messages.length,
      })

      const response = await requestUrl({
        url: this.config.chatEndpoint,
        method: 'POST',
        headers: {
          ...this.config.authHeader(this.apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (response.status !== 200) {
        throw this.handleErrorResponse(response)
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
        `${this.config.name} request failed: ${error.message}`,
        'REQUEST_FAILED',
      )
    }
  }

  async *streamMessage(
    request: ChatRequest,
  ): AsyncGenerator<string, void, unknown> {
    if (!this.isConfigured()) {
      throw new ChatProviderError(
        `${this.config.name} API key not configured`,
        'MISSING_API_KEY',
      )
    }

    const body = this.config.buildRequestBody
      ? this.config.buildRequestBody({ ...request, stream: true }, this.model)
      : this.buildRequestBody({ ...request, stream: true })

    try {
      const response = await fetch(this.config.chatEndpoint, {
        method: 'POST',
        headers: {
          ...this.config.authHeader(this.apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw this.handleErrorResponse({
          status: response.status,
          json: await response.json(),
        })
      }

      yield* this.parseStreamResponse(response)
    } catch (error) {
      if (error instanceof ChatProviderError) {
        throw error
      }
      throw new ChatProviderError(
        `${this.config.name} streaming failed: ${error.message}`,
        'STREAM_FAILED',
      )
    }
  }

  /**
   * Parse SSE stream response
   * Common logic for all providers using Server-Sent Events
   */
  protected async *parseStreamResponse(
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
        if (trimmed === '' || trimmed === (this.config.streamDoneMarker || 'data: [DONE]')) {
          continue
        }

        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6))
            const content = this.config.parseStreamChunk
              ? this.config.parseStreamChunk(json)
              : this.defaultParseStreamChunk(json)

            if (content) {
              yield content
            }
          } catch {
            Logger.warn('Failed to parse SSE line:', trimmed)
          }
        }
      }
    }
  }

  /**
   * Default response parser for OpenAI-compatible APIs
   */
  protected defaultParseResponse(data: unknown): ChatResponse {
    const response = data as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    }

    return {
      content: response.choices[0].message.content,
      model: response.model,
      usage: response.usage
        ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
        : undefined,
    }
  }

  /**
   * Default stream chunk parser for OpenAI-compatible APIs
   */
  protected defaultParseStreamChunk(json: unknown): string | null {
    const chunk = json as {
      choices?: Array<{ delta?: { content?: string } }>;
    }
    return chunk.choices?.[0]?.delta?.content || null
  }

  /**
   * Common error response handler
   */
  protected handleErrorResponse(response: {
    status: number;
    json: unknown;
  }): ChatProviderError {
    const status = response.status
    const data = response.json as {
      error?: { message?: string; code?: string; type?: string };
    }

    let message = 'Unknown error'
    let code = 'UNKNOWN_ERROR'

    if (data?.error) {
      message = data.error.message || message
      code = data.error.code || data.error.type || code
    }

    switch (status) {
    case 401:
      return new ChatProviderError(
        `Invalid API key. Check your ${this.config.name} API key in settings.`,
        'INVALID_API_KEY',
        status,
      )
    case 429:
      return new ChatProviderError(
        'Rate limit exceeded. Please try again later.',
        'RATE_LIMIT_EXCEEDED',
        status,
      )
    case 500:
    case 502:
    case 503:
      return new ChatProviderError(
        `${this.config.name} service is temporarily unavailable. Please try again later.`,
        'SERVICE_UNAVAILABLE',
        status,
      )
    default:
      return new ChatProviderError(message, code, status)
    }
  }
}
