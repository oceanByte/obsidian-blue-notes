import { ProviderRegistry } from './providers/provider-config'

export interface ChatSettings {
  provider: string;
  apiKeys: Record<string, string>;
  models: Record<string, string>;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

/**
 * Get default chat settings based on registered providers
 */
export function getDefaultChatSettings(): ChatSettings {
  const providers = ProviderRegistry.getAll()
  const apiKeys: Record<string, string> = {}
  const models: Record<string, string> = {}

  for (const provider of providers) {
    apiKeys[provider.id] = ''
    models[provider.id] = provider.defaultModel
  }

  return {
    provider: providers[0]?.id || 'ollama',
    apiKeys,
    models,
    temperature: 0.5,
    maxTokens: 2000,
    systemPrompt: `You are an AI assistant integrated with Obsidian. Use the provided notes as your main context to answer questions, explain concepts, and suggest related ideas.
- Prefer accuracy over speculation, but you may reason or elaborate when helpful.
- Clearly separate facts from your interpretations.
- Aim for clarity, usefulness, and insight, as if helping the user learn from and build upon their own notes.`,
  }
}

/**
 * Legacy constant for backward compatibility
 * @deprecated Use getDefaultChatSettings() instead
 */
export const DEFAULT_CHAT_SETTINGS = getDefaultChatSettings()
