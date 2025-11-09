import type { ChatProvider } from './chat-provider-interface'

/**
 * Model configuration for a provider
 */
export interface ModelConfig {
  id: string;
  name: string;
}

/**
 * Provider configuration metadata
 */
export interface ProviderConfig {
  id: string;
  name: string;
  createProvider: (apiKey: string, model: string) => ChatProvider;
  defaultModel: string;
  availableModels: ModelConfig[];
  apiKeyPlaceholder?: string;
}

/**
 * Registry of all available chat providers
 */
export class ProviderRegistry {
  private static providers = new Map<string, ProviderConfig>()

  /**
   * Register a new chat provider
   */
  static register(config: ProviderConfig): void {
    this.providers.set(config.id, config)
  }

  /**
   * Get a provider configuration by ID
   */
  static get(id: string): ProviderConfig | undefined {
    return this.providers.get(id)
  }

  /**
   * Get all registered provider IDs
   */
  static getAllIds(): string[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Get all registered provider configurations
   */
  static getAll(): ProviderConfig[] {
    return Array.from(this.providers.values())
  }

  /**
   * Check if a provider is registered
   */
  static has(id: string): boolean {
    return this.providers.has(id)
  }
}
