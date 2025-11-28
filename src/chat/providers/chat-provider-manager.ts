import type { ChatProvider } from './chat-provider-interface'
import type { ChatSettings } from '../chat-settings'
import { Logger } from '../../utils/logger'
import { ProviderRegistry } from './provider-config'

import './ollama-provider'
import './openai-provider'
import './anthropic-provider'
import './groq-provider'
import './google-provider'
import './requesty-provider'

export class ChatProviderManager {
  private providerCache = new Map<string, ChatProvider>()
  private currentProvider: ChatProvider | null = null

  constructor(private settings: ChatSettings) {
    this.initialize()
  }

  initialize(): void {
    this.selectProvider(this.settings.provider)
  }

  private createProvider(providerName: string): ChatProvider | null {
    const config = ProviderRegistry.get(providerName)
    if (!config) {
      return null
    }

    const apiKey = this.settings.apiKeys[config.id] || ''
    const model = this.settings.models[config.id] || config.defaultModel

    return config.createProvider(apiKey, model)
  }

  selectProvider(providerName: string): void {
    let provider = this.providerCache.get(providerName)

    if (!provider) {
      provider = this.createProvider(providerName)
      if (provider) {
        this.providerCache.set(providerName, provider)
        Logger.debug(`${provider.name} provider initialized`)
      }
    }

    if (!provider) {
      Logger.warn(`Provider '${providerName}' not available or not configured`)
      this.currentProvider = null
      return
    }

    if (!provider.isConfigured()) {
      Logger.warn(`Provider '${providerName}' is not properly configured`)
      this.currentProvider = null
      return
    }

    this.currentProvider = provider
    Logger.info(`Selected chat provider: ${provider.name}`)
  }

  getProvider(): ChatProvider | null {
    return this.currentProvider
  }

  getAvailableProviders(): string[] {
    return ProviderRegistry.getAllIds()
  }

  isProviderAvailable(providerName: string): boolean {
    const provider =
      this.providerCache.get(providerName) || this.createProvider(providerName)
    return provider ? provider.isConfigured() : false
  }

  async validateCurrentProvider(): Promise<boolean> {
    if (!this.currentProvider) {
      return false
    }

    try {
      const isValid = await this.currentProvider.validateApiKey()
      if (!isValid) {
        Logger.error(
          `Provider ${this.currentProvider.name} API key validation failed`,
        )
      }
      return isValid
    } catch (error) {
      Logger.error(
        `Error validating provider ${this.currentProvider.name}:`,
        error,
      )
      return false
    }
  }

  async validateProvider(providerName: string): Promise<boolean> {
    const provider =
      this.providerCache.get(providerName) || this.createProvider(providerName)

    if (!provider) {
      return false
    }

    try {
      return await provider.validateApiKey()
    } catch (error) {
      Logger.error(`Error validating provider ${providerName}:`, error)
      return false
    }
  }

  updateSettings(settings: ChatSettings): void {
    this.settings = settings
    this.providerCache.clear()
    this.initialize()
  }

  getCurrentProviderName(): string | null {
    if (!this.currentProvider) {
      return null
    }

    for (const [name, provider] of this.providerCache.entries()) {
      if (provider === this.currentProvider) {
        return name
      }
    }

    return null
  }

  getCurrentModel(): string | null {
    return this.currentProvider?.model || null
  }

  dispose(): void {
    this.providerCache.clear()
    this.currentProvider = null
  }
}
