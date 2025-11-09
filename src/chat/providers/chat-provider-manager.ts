import type { ChatProvider } from './chat-provider-interface'
import type { ChatSettings } from '../chat-settings'
import { Logger } from '../../utils/logger'
import { ProviderRegistry } from './provider-config'

import './openai-provider'
import './groq-provider'
import './anthropic-provider'
import './requesty-provider'

export class ChatProviderManager {
  private providers = new Map<string, ChatProvider>()
  private currentProvider: ChatProvider | null = null

  constructor(private settings: ChatSettings) {
    this.initialize()
  }

  initialize(): void {
    this.providers.clear()

    for (const config of ProviderRegistry.getAll()) {
      const apiKey = this.settings.apiKeys[config.id] || ''
      const model = this.settings.models[config.id] || config.defaultModel

      const provider = config.createProvider(apiKey, model)

      if (provider.isConfigured()) {
        this.providers.set(config.id, provider)
        Logger.debug(`${config.name} provider initialized`)
      }
    }

    this.selectProvider(this.settings.provider)
  }

  selectProvider(providerName: string): void {
    const provider = this.providers.get(providerName)

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
    return Array.from(this.providers.keys()).filter((key) =>
      this.providers.get(key)?.isConfigured(),
    )
  }

  isProviderAvailable(providerName: string): boolean {
    const provider = this.providers.get(providerName)
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
    const provider = this.providers.get(providerName)

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
    this.initialize()
  }

  getCurrentProviderName(): string | null {
    if (!this.currentProvider) {
      return null
    }

    for (const [name, provider] of this.providers.entries()) {
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
    this.providers.clear()
    this.currentProvider = null
  }
}
