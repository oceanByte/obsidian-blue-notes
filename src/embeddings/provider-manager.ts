import { type EmbeddingProvider, ProviderType } from './provider-interface'
import { Logger } from '../utils/logger'
import type SemanticNotesPlugin from '../main'

/**
 * Manages embedding providers with fallback strategy
 */
export class ProviderManager {
  private plugin: SemanticNotesPlugin
  private currentProvider: EmbeddingProvider | null = null
  private providers = new Map<ProviderType, EmbeddingProvider>()

  constructor(plugin: SemanticNotesPlugin) {
    this.plugin = plugin
  }

  /**
   * Initialize provider manager and set up providers
   */
  async initialize(): Promise<void> {
    try {
      const provider = await this.createProvider(ProviderType.ONNX)
      if (!provider) {
        Logger.error('Failed to create ONNX provider')
        return
      }

      const isAvailable = await provider.isAvailable()
      if (!isAvailable) {
        Logger.info('ONNX provider not yet available, attempting runtime installation')
      }

      try {
        await provider.initialize()
        this.providers.set(ProviderType.ONNX, provider)
        this.currentProvider = provider
        Logger.debug('ONNX provider initialized successfully')
      } catch (error) {
        Logger.error(
          'Provider initialization failed (model may need to be downloaded):',
          error,
        )
      }
    } catch (error) {
      Logger.error('Failed to create ONNX provider:', error)
    }
  }

  /**
   * Create a provider instance based on type
   */
  private async createProvider(
    type: ProviderType,
  ): Promise<EmbeddingProvider | null> {
    if (type === ProviderType.ONNX) {
      const { ONNXProvider } = await import('./providers/onnx/provider')
      return new ONNXProvider(this.plugin)
    }
    return null
  }

  /**
   * Get the current active provider
   */
  getProvider(): EmbeddingProvider | null {
    return this.currentProvider
  }

  /**
   * Switch to a different provider
   */
  async switchProvider(type: ProviderType): Promise<boolean> {
    let provider = this.providers.get(type)

    if (!provider) {
      const newProvider = await this.createProvider(type)
      if (!newProvider) {
        return false
      }
      provider = newProvider
      this.providers.set(type, provider)
    }

    if (!(await provider.isAvailable())) {
      return false
    }

    if (this.currentProvider) {
      await this.currentProvider.dispose()
    }

    try {
      await provider.initialize()
      this.currentProvider = provider
      return true
    } catch (error) {
      Logger.error(`Failed to switch to ${type} provider:`, error)
      return false
    }
  }

  /**
   * Clean up all providers
   */
  async dispose(): Promise<void> {
    for (const provider of this.providers.values()) {
      await provider.dispose()
    }
    this.providers.clear()
    this.currentProvider = null
  }
}
