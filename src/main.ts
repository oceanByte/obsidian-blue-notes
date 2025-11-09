import { Notice, Plugin, TFile } from 'obsidian'

import {
  type ChatSettings,
  DEFAULT_CHAT_SETTINGS,
} from './chat/chat-settings'

import { CHAT_VIEW_TYPE, ChatView } from './ui/chat-view'
import { Logger, LogLevel } from './utils/logger'
import { ONNXModelType, ProviderType } from './embeddings/provider-interface'
import { SemanticSearchModal, SimilarNotesModal } from './ui/search-modal'
import { ChatProviderManager } from './chat/providers/chat-provider-manager'
import { ContextManager } from './chat/context/context-manager'
import { EmbeddingCache } from './embeddings/cache'
import { EmbeddingProcessor } from './embeddings/processor'
import { FileProcessor } from './utils/file-processor'
import { getPluginDataDir } from './utils/plugin-paths'
import { MESSAGES } from './constants/messages'
import { ProviderManager } from './embeddings/provider-manager'
import { SemanticNotesSettingTab } from './ui/settings-tab'
import { SemanticSearch } from './search/semantic-search'



interface SemanticNotesSettings {
  provider: {
    type: ProviderType;
    modelType: ONNXModelType;
    enabled: boolean;
  };
  autoProcess: boolean;
  searchThreshold: number;
  searchLimit: number;
  processing: {
    batchSize: number;
    minWordCount: number;
    adaptiveBatching: boolean;
    checkIntervalMinutes: number;
  };
  logLevel: LogLevel;
  chat: ChatSettings;
}

const DEFAULT_SETTINGS: SemanticNotesSettings = {
  provider: {
    type: ProviderType.ONNX,
    modelType: ONNXModelType.E5_SMALL,
    enabled: true,
  },
  autoProcess: true,
  searchThreshold: 0.5,
  searchLimit: 10,
  processing: {
    batchSize: 20,
    minWordCount: 15,
    adaptiveBatching: true,
    checkIntervalMinutes: 5,
  },
  logLevel: LogLevel.ERROR,
  chat: DEFAULT_CHAT_SETTINGS,
}

export default class SemanticNotesPlugin extends Plugin {
  settings: SemanticNotesSettings
  providerManager: ProviderManager
  cache: EmbeddingCache
  processor: EmbeddingProcessor
  semanticSearch: SemanticSearch
  fileProcessor: FileProcessor
  chatProviderManager: ChatProviderManager
  contextManager: ContextManager
  periodicCheckInterval: number | null = null
  settingsTab: SemanticNotesSettingTab | null = null

  async onload() {
    await this.loadSettings()

    Logger.setLevel(this.settings.logLevel)

    this.registerView(CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this))

    const pluginDataDir = getPluginDataDir(this.app)

    this.providerManager = new ProviderManager(this)
    this.cache = new EmbeddingCache(pluginDataDir)
    await this.cache.initialize()

    this.processor = new EmbeddingProcessor(this, this.cache)
    this.semanticSearch = new SemanticSearch(this, this.cache)
    this.fileProcessor = new FileProcessor(this.app.vault, this.app)

    this.chatProviderManager = new ChatProviderManager(this.settings.chat)

    this.contextManager = new ContextManager(this)

    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.processor.invalidate(file)
        }
      }),
    )

    if (this.settings.autoProcess) {
      this.startPeriodicCheck()
    }

    this.addCommand({
      id: 'semantic-search',
      name: 'Semantic search',
      callback: () => {
        new SemanticSearchModal(this.app, this).open()
      },
    })

    this.addCommand({
      id: 'find-similar',
      name: 'Find similar notes',
      callback: async () => {
        const activeFile = this.app.workspace.getActiveFile()
        if (!activeFile) {
          new Notice(MESSAGES.NO_ACTIVE_FILE)
          return
        }

        try {
          const provider = this.providerManager.getProvider()
          if (!provider) {
            new Notice(MESSAGES.NO_EMBEDDING_PROVIDER_AVAILABLE)
            return
          }

          const content = await this.fileProcessor.extractText(activeFile)
          const contentHash = EmbeddingCache.computeHash(content)
          const isCached = this.cache.has(activeFile.path, contentHash)

          if (!isCached) {
            new Notice(MESSAGES.PROCESSING_CURRENT_FILE)
          }

          const results = await this.semanticSearch.findSimilar(activeFile, {
            limit: 10,
            threshold: 0.3,
          })

          if (results.length === 0) {
            new Notice(MESSAGES.NO_SIMILAR_NOTES)
            return
          }

          new SimilarNotesModal(this.app, activeFile, results).open()
        } catch (error) {
          new Notice(MESSAGES.ERROR(error.message))
        }
      },
    })

    this.addCommand({
      id: 'open-chat',
      name: 'Open AI chat',
      callback: () => this.activateChatView(),
    })

    this.addCommand({
      id: 'process-vault',
      name: 'Process entire vault',
      callback: async () => {
        try {
          await this.processor.processVault()
        } catch (error) {
          new Notice(MESSAGES.ERROR(error.message))
        }
      },
    })

    this.addCommand({
      id: 'process-current-file',
      name: 'Process current file',
      callback: async () => {
        const activeFile = this.app.workspace.getActiveFile()
        if (!activeFile) {
          new Notice(MESSAGES.NO_ACTIVE_FILE)
          return
        }

        try {
          const wasProcessed = await this.processor.processFile(activeFile)
          await this.cache.save()

          if (wasProcessed) {
            new Notice(MESSAGES.FILE_PROCESSED)
          } else {
            new Notice(MESSAGES.USING_CACHED_EMBEDDING)
          }
        } catch (error) {
          new Notice(MESSAGES.ERROR(error.message))
        }
      },
    })

    this.addRibbonIcon('message-square', 'Open AI chat', () => {
      this.activateChatView()
    })

    this.settingsTab = new SemanticNotesSettingTab(this.app, this)
    this.addSettingTab(this.settingsTab)

    Logger.info('Blue Notes plugin loaded')

    this.downloadDependencies()
  }

  onunload() {
    this.stopPeriodicCheck()
    if (this.providerManager) {
      this.providerManager.dispose()
    }
    if (this.chatProviderManager) {
      this.chatProviderManager.dispose()
    }
    if (this.cache) {
      this.cache.save()
    }
  }

  startPeriodicCheck() {
    this.stopPeriodicCheck()
    const intervalMs =
      this.settings.processing.checkIntervalMinutes * 60 * 1000
    this.periodicCheckInterval = window.setInterval(() => {
      this.processor.checkAndQueueModified()
    }, intervalMs)
    Logger.info(
      `Started periodic check every ${this.settings.processing.checkIntervalMinutes} minutes`,
    )
  }

  stopPeriodicCheck() {
    if (this.periodicCheckInterval !== null) {
      window.clearInterval(this.periodicCheckInterval)
      this.periodicCheckInterval = null
    }
  }

  /**
   * Download ONNX Runtime and embedding model in parallel
   * This runs after settings are loaded so the UI is immediately available
   */
  private async downloadDependencies() {
    const stats = this.cache.getStats()
    const isFirstTime = stats.count === 0

    try {
      await this.providerManager.initialize()
      Logger.info('Provider initialized with runtime and model ready')

      if (this.settingsTab && this.settingsTab.containerEl.childElementCount > 0) {
        this.settingsTab.display()
        Logger.debug('Settings UI refreshed after downloads')
      }

      if (isFirstTime) {
        Logger.info('First load - starting automatic vault processing')
        try {
          await this.processor.processVault()
        } catch (error) {
          Logger.error('Automatic vault processing failed:', error)
          new Notice(MESSAGES.ERROR(error.message))
        }
      }
    } catch (error) {
      Logger.error('Failed to initialize provider:', error)
    }
  }

  async loadSettings() {
    const loadedData = await this.loadData()
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData)

    if (this.settings.chat) {
      const { ProviderRegistry } = await import('./chat/providers/provider-config')

      await import('./chat/providers/openai-provider')
      await import('./chat/providers/groq-provider')
      await import('./chat/providers/anthropic-provider')

      for (const config of ProviderRegistry.getAll()) {
        this.settings.chat.apiKeys[config.id] ??= ''
        this.settings.chat.models[config.id] ??= config.defaultModel
      }
    }
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }


  async activateChatView() {
    const { workspace } = this.app

    let leaf = workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0]

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false)
      if (rightLeaf) {
        leaf = rightLeaf
        await leaf.setViewState({
          type: CHAT_VIEW_TYPE,
          active: true,
        })
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf)
    }
  }

  getChatView(): ChatView | null {
    const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)
    if (leaves.length > 0) {
      const view = leaves[0].view
      return view instanceof ChatView ? view : null
    }
    return null
  }
}
