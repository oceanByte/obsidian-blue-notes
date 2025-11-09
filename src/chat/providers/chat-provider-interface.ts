export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export abstract class ChatProvider {
  abstract name: string
  abstract apiKey: string
  abstract model: string

  abstract isConfigured(): boolean
  abstract validateApiKey(): Promise<boolean>
  abstract sendMessage(request: ChatRequest): Promise<ChatResponse>
  abstract streamMessage(
    request: ChatRequest,
  ): AsyncGenerator<string, void, unknown>

  protected buildRequestBody(request: ChatRequest): Record<string, unknown> {
    return {
      model: this.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2000,
      stream: request.stream ?? false,
    }
  }
}

export class ChatProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
  ) {
    super(message)
    this.name = 'ChatProviderError'
  }
}
