import {
  type App,
  Notice,
  PluginSettingTab,
  Setting,
} from 'obsidian'

import { Logger, LogLevel } from '../utils/logger'
import { DownloadProgressNotifier } from '../utils/download-progress-notifier'
import { MESSAGES } from '../constants/messages'
import { ONNXModelType } from '../embeddings/provider-interface'
import { ProviderRegistry } from '../chat/providers/provider-config'

import type SemanticNotesPlugin from '../main'

export class SemanticNotesSettingTab extends PluginSettingTab {
  plugin: SemanticNotesPlugin

  constructor(app: App, plugin: SemanticNotesPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  private getInstallationStatusDesc(stateManager: any): string {
    if (stateManager.isInstalled()) {
      return 'ONNX Runtime binaries are installed and ready to use'
    } else if (stateManager.hasFailed()) {
      return 'Installation failed. Click the button below to retry.'
    } else {
      return 'ONNX Runtime binaries need to be downloaded (50-127MB depending on platform)'
    }
  }

  display(): void {
    const { containerEl } = this

    containerEl.empty()

    {
      const provider = this.plugin.providerManager.getProvider()

      interface ModelDownloader {
        getModelInfo: (
          modelType: ONNXModelType,
        ) => { description: string } | undefined;
        isModelDownloaded: (modelType: ONNXModelType) => boolean;
      }

      const downloader =
        provider && 'getDownloader' in provider
          ? (
            provider as { getDownloader: () => ModelDownloader }
          ).getDownloader()
          : null

      new Setting(containerEl)
        .setName('Model type')
        .setDesc(
          'Choose which ONNX model to use. Models are downloaded automatically on first use.',
        )
        .addDropdown((dropdown) => {

          for (const modelType of Object.values(ONNXModelType)) {
            const modelInfo = downloader?.getModelInfo(modelType)
            const isDownloaded = downloader?.isModelDownloaded(modelType)
            const downloadStatus = isDownloaded ? '✓' : '⬇'
            const label = modelInfo
              ? `${downloadStatus} ${modelInfo.description}`
              : modelType
            dropdown.addOption(modelType, label)
          }

          return dropdown
            .setValue(
              this.plugin.settings.provider.modelType || ONNXModelType.E5_SMALL,
            )
            .onChange(async (value) => {
              const previousModel = this.plugin.settings.provider.modelType
              const newModel = value as ONNXModelType

              if (previousModel !== newModel) {
                this.plugin.settings.provider.modelType = newModel
                await this.plugin.saveSettings()

                const provider = this.plugin.providerManager.getProvider()
                if (provider && 'switchModel' in provider) {
                  try {
                    await (
                      provider as {
                        switchModel: (model: ONNXModelType, silent?: boolean) => Promise<void>;
                      }
                    ).switchModel(newModel, true)

                    await this.plugin.cache.switchModel(newModel)

                    if ('getTokenLimit' in provider) {
                      const tokenLimit = (provider as any).getTokenLimit()
                      this.plugin.processor.updateTokenLimit(tokenLimit)
                    }

                    this.display()

                    const modelInfo = this.plugin.providerManager.getProvider()?.['getDownloader']?.()?.getModelInfo(newModel)
                    const modelName = modelInfo?.name || newModel
                    new Notice(`Switched to ${modelName}. Processing vault...`)

                    await this.plugin.processor.processVault(true)
                  } catch (error) {
                    new Notice(MESSAGES.ERROR(error.message))
                  }
                }
              }
            })
        })
    }


    new Setting(containerEl)
      .setName('Auto-process notes')
      .setDesc(
        'Automatically generate embeddings for modified notes using periodic checking',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoProcess)
          .onChange(async (value) => {
            this.plugin.settings.autoProcess = value
            await this.plugin.saveSettings()

            if (value) {
              this.plugin.startPeriodicCheck()
            } else {
              this.plugin.stopPeriodicCheck()
            }
          }),
      )

    new Setting(containerEl)
      .setName('Check interval (minutes)')
      .setDesc(
        'How often to check for modified notes (applies when auto-process is enabled)',
      )
      .addSlider((slider) =>
        slider
          .setLimits(1, 60, 1)
          .setValue(this.plugin.settings.processing.checkIntervalMinutes)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.processing.checkIntervalMinutes = value
            await this.plugin.saveSettings()

            if (this.plugin.settings.autoProcess) {
              this.plugin.startPeriodicCheck()
            }
          }),
      )

    new Setting(containerEl).setName('Search').setHeading()

    new Setting(containerEl)
      .setName('Enable inline search')
      .setDesc('Enable semantic search suggestions when you type ‘//’ followed by your query.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.inlineSearch?.enabled ?? true)
          .onChange(async (value) => {
            if (!this.plugin.settings.inlineSearch) {
              this.plugin.settings.inlineSearch = {
                enabled: value,
              }
            } else {
              this.plugin.settings.inlineSearch.enabled = value
            }
            await this.plugin.saveSettings()

            new Notice('Please reload the plugin for this change to take effect')
          }),
      )

    new Setting(containerEl)
      .setName('Search threshold')
      .setDesc(
        'Minimum similarity score for search results (0.0 - 1.0). Lower = more results.',
      )
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.05)
          .setValue(this.plugin.settings.searchThreshold)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.searchThreshold = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Search result limit')
      .setDesc('Maximum number of results to return')
      .addSlider((slider) =>
        slider
          .setLimits(5, 50, 5)
          .setValue(this.plugin.settings.searchLimit)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.searchLimit = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl).setName('Chat').setHeading()

    containerEl.createEl('p', {
      text: 'You manually select which notes to include in chat conversations. Only use the AI chat if you are comfortable sharing note content with third parties.',
      cls: 'setting-item-description',
    })

    new Setting(containerEl)
      .setName('Chat provider')
      .setDesc('Choose which AI provider to use for chat')
      .addDropdown((dropdown) => {

        for (const config of ProviderRegistry.getAll()) {
          dropdown.addOption(config.id, config.name)
        }

        dropdown
          .setValue(this.plugin.settings.chat.provider)
          .onChange(async (value) => {
            this.plugin.settings.chat.provider = value
            await this.plugin.saveSettings()
            this.plugin.chatProviderManager.updateSettings(
              this.plugin.settings.chat,
            )

            const chatView = this.plugin.getChatView()
            if (chatView) {
              chatView.refresh()
            }
            this.display()
          })

        return dropdown
      })

    const selectedProviderConfig = ProviderRegistry.get(
      this.plugin.settings.chat.provider,
    )

    if (selectedProviderConfig) {
      const isOllama = selectedProviderConfig.id === 'ollama'
      const apiKeyLabel = isOllama ? 'Server URL' : 'API key'
      const apiKeyDesc = isOllama
        ? 'Enter your Ollama server URL (e.g., http://localhost:11434)'
        : 'Enter your API key'

      new Setting(containerEl)
        .setName(apiKeyLabel)
        .setDesc(apiKeyDesc)
        .addText((text) => {
          const apiKey = this.plugin.settings.chat.apiKeys[selectedProviderConfig.id] || ''

          text
            .setPlaceholder(selectedProviderConfig.apiKeyPlaceholder || 'API key...')
            .setValue(apiKey)
            .onChange(async (value) => {
              this.plugin.settings.chat.apiKeys[selectedProviderConfig.id] = value
              await this.plugin.saveSettings()
              this.plugin.chatProviderManager.updateSettings(
                this.plugin.settings.chat,
              )

              const chatView = this.plugin.getChatView()
              if (chatView) {
                chatView.refresh()
              }
            })
          text.inputEl.type = isOllama ? 'text' : 'password'
          return text
        })
        .addButton((button) =>
          button.setButtonText('Test').onClick(async () => {
            button.setDisabled(true)
            button.setButtonText('Testing...')
            try {
              const isValid =
                await this.plugin.chatProviderManager.validateProvider(
                  selectedProviderConfig.id,
                )
              const successMessage = isOllama
                ? `${selectedProviderConfig.name} server is reachable`
                : `${selectedProviderConfig.name} API key is valid`
              const errorMessage = isOllama
                ? `${selectedProviderConfig.name} server is unreachable`
                : `${selectedProviderConfig.name} API key is invalid`
              if (isValid) {
                new Notice(successMessage)
              } else {
                new Notice(errorMessage)
              }
            } catch (error) {
              new Notice(`Error: ${error.message}`)
            } finally {
              button.setDisabled(false)
              button.setButtonText('Test')
            }
          }),
        )

      if (isOllama) {
        const modelSetting = new Setting(containerEl)
          .setName('Model')
          .setDesc('Click "Discover Models" to load your installed Ollama models')

        const createModelDropdown = async (discoveredModels: string[] = []) => {
          modelSetting.clear()
          modelSetting.setName('Model')

          if (discoveredModels.length > 0) {
            modelSetting.setDesc(`Found ${discoveredModels.length} installed model(s)`)

            const currentModel = this.plugin.settings.chat.models[selectedProviderConfig.id] || selectedProviderConfig.defaultModel

            modelSetting.addDropdown((dropdown) => {
              discoveredModels.forEach((model) => {
                dropdown.addOption(model, model)
              })

              const modelExists = discoveredModels.includes(currentModel)
              dropdown.setValue(modelExists ? currentModel : discoveredModels[0])

              if (!modelExists && discoveredModels.length > 0) {
                this.plugin.settings.chat.models[selectedProviderConfig.id] = discoveredModels[0]
                this.plugin.saveSettings()
              }

              dropdown.onChange(async (value) => {
                this.plugin.settings.chat.models[selectedProviderConfig.id] = value
                await this.plugin.saveSettings()
                this.plugin.chatProviderManager.updateSettings(
                  this.plugin.settings.chat,
                )

                const chatView = this.plugin.getChatView()
                if (chatView) {
                  chatView.refresh()
                }
              })
              return dropdown
            })
          } else {
            modelSetting.setDesc('Click "Discover Models" to load your installed Ollama models')
          }

          modelSetting.addButton((button) =>
            button
              .setButtonText('Discover Models')
              .setTooltip('Fetch installed models from Ollama server')
              .onClick(async () => {
                button.setDisabled(true)
                button.setButtonText('Discovering...')
                try {
                  const provider = this.plugin.chatProviderManager.getProvider()
                  if (provider && 'getAvailableModels' in provider) {
                    const models = await (
                      provider as { getAvailableModels: () => Promise<string[]> }
                    ).getAvailableModels()

                    if (models.length > 0) {
                      new Notice(`Found ${models.length} model(s)`)
                      await createModelDropdown(models)
                    } else {
                      new Notice('No models found. Make sure Ollama is running and models are installed.')
                    }
                  }
                } catch (error) {
                  new Notice(`Failed to discover models: ${error.message}`)
                } finally {
                  button.setDisabled(false)
                  button.setButtonText('Discover Models')
                }
              }),
          )
        }

        const serverUrl = this.plugin.settings.chat.apiKeys[selectedProviderConfig.id]
        if (serverUrl && serverUrl.length > 0) {
          const provider = this.plugin.chatProviderManager.getProvider()
          if (provider && 'getAvailableModels' in provider) {
            (provider as { getAvailableModels: () => Promise<string[]> })
              .getAvailableModels()
              .then(models => {
                if (models.length > 0) {
                  createModelDropdown(models)
                } else {
                  createModelDropdown([])
                }
              })
              .catch(() => {
                createModelDropdown([])
              })
          } else {
            createModelDropdown([])
          }
        } else {
          createModelDropdown([])
        }
      } else {
        new Setting(containerEl)
          .setName('Model')
          .setDesc('Choose which model to use')
          .addDropdown((dropdown) => {
            selectedProviderConfig.availableModels.forEach((model) => {
              dropdown.addOption(model.id, model.name)
            })

            const currentModel = this.plugin.settings.chat.models[selectedProviderConfig.id]
            const isValid = selectedProviderConfig.availableModels.some(
              (m) => m.id === currentModel,
            )
            const modelToUse = currentModel && isValid
              ? currentModel
              : selectedProviderConfig.defaultModel

            if (modelToUse !== currentModel) {
              this.plugin.settings.chat.models[selectedProviderConfig.id] = modelToUse
              this.plugin.saveSettings()
            }

            return dropdown.setValue(modelToUse).onChange(async (value) => {
              this.plugin.settings.chat.models[selectedProviderConfig.id] = value
              await this.plugin.saveSettings()
              this.plugin.chatProviderManager.updateSettings(
                this.plugin.settings.chat,
              )

              const provider = this.plugin.chatProviderManager.getProvider()
              if (provider && 'switchModel' in provider) {
                try {
                  await (
                    provider as { switchModel: (model: string) => Promise<void> }
                  ).switchModel(value)
                } catch (error) {
                  new Notice(MESSAGES.ERROR(error.message))
                }
              }

              const chatView = this.plugin.getChatView()
              if (chatView) {
                chatView.refresh()
              }
            })
          })
      }
    }

    new Setting(containerEl)
      .setName('Temperature')
      .setDesc(
        'Controls randomness in responses (0.0 = deterministic, 1.0 = creative)',
      )
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.1)
          .setValue(this.plugin.settings.chat.temperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.chat.temperature = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Max tokens')
      .setDesc('Maximum length of AI responses')
      .addSlider((slider) =>
        slider
          .setLimits(500, 4000, 100)
          .setValue(this.plugin.settings.chat.maxTokens)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.chat.maxTokens = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('System prompt')
      .setDesc('Instructions for the AI assistant')
      .addTextArea((text) =>
        text
          .setPlaceholder('You are a helpful AI assistant...')
          .setValue(this.plugin.settings.chat.systemPrompt)
          .onChange(async (value) => {
            this.plugin.settings.chat.systemPrompt = value
            await this.plugin.saveSettings()
          })
          .then((textarea) => {
            textarea.inputEl.rows = 4
            textarea.inputEl.addClass('system-prompt-textarea')
          }),
      )

    new Setting(containerEl).setName('Cache').setHeading()

    const stats = this.plugin.semanticSearch.getIndexStats()
    const coverage =
      stats.totalNotes > 0
        ? ((stats.cachedNotes / stats.totalNotes) * 100).toFixed(1)
        : '0'

    new Setting(containerEl)
      .setName('Cache statistics')
      .setDesc(
        `Cached: ${stats.cachedNotes}/${stats.totalNotes} notes (${coverage}%) • Size: ${(stats.cacheSize / 1024).toFixed(2)} KB`,
      )

    new Setting(containerEl)
      .setName('Clear cache')
      .setDesc('Remove all cached embeddings')
      .addButton((button) =>
        button
          .setButtonText('Clear cache')
          .setWarning()
          .onClick(async () => {
            this.plugin.cache.clear()
            await this.plugin.cache.save()
            new Notice(MESSAGES.CACHE_CLEARED)
            this.display()
          }),
      )

    new Setting(containerEl)
      .setName('Process entire vault')
      .setDesc('Generate embeddings for all notes in the vault')
      .addButton((button) =>
        button
          .setButtonText('Process vault')
          .setCta()
          .onClick(async () => {
            try {
              await this.plugin.processor.processVault()
              this.display()
            } catch (error) {
              new Notice(MESSAGES.ERROR(error.message))
            }
          }),
      )

    new Setting(containerEl).setName('Advanced').setHeading()

    const onnxProvider = this.plugin.providerManager.getProvider()

    if (onnxProvider && 'getBinaryDownloader' in onnxProvider) {
      const downloader = (onnxProvider as any).getBinaryDownloader()
      const stateManager = downloader.getStateManager()

      new Setting(containerEl)
        .setName('Installation Status')
        .setDesc(this.getInstallationStatusDesc(stateManager))
        .addButton((button) => {
          if (stateManager.hasFailed() || !stateManager.isInstalled()) {
            button
              .setButtonText('Download ONNX Runtime')
              .setCta()
              .onClick(async () => {
                button.setDisabled(true)
                button.setButtonText('Downloading...')

                try {
                  const notifier = new DownloadProgressNotifier({
                    items: ['ONNX Runtime'],
                  })
                  await (onnxProvider as any).ensureRuntimeInstalled(notifier)
                  this.display()
                } catch (error) {
                  const errorMsg = error instanceof Error ? error.message : String(error)
                  new Notice(`Installation failed: ${errorMsg}`)
                } finally {
                  button.setDisabled(false)
                  button.setButtonText('Download ONNX Runtime')
                }
              })
          } else {
            button
              .setButtonText('Installed')
              .setDisabled(true)
          }
        })

      if (stateManager.isInstalled()) {
        new Setting(containerEl)
          .setName('Version')
          .setDesc(stateManager.getVersion() || 'Unknown')
      }

      if (stateManager.hasFailed()) {
        const errorEl = containerEl.createEl('div', {
          cls: 'setting-item-description mod-warning'
        })
        errorEl.createEl('strong', { text: 'Error: ' })
        errorEl.appendText(stateManager.getError() || 'Unknown error')
      }
    } else {
      new Setting(containerEl)
        .setName('ONNX Provider')
        .setDesc('Not available')
    }

    new Setting(containerEl)
      .setName('Log level')
      .setDesc('Control console logging verbosity')
      .addDropdown((dropdown) =>
        dropdown
          .addOption(LogLevel.NONE.toString(), 'None')
          .addOption(LogLevel.ERROR.toString(), 'Error')
          .addOption(LogLevel.WARN.toString(), 'Warning')
          .addOption(LogLevel.INFO.toString(), 'Info')
          .addOption(LogLevel.DEBUG.toString(), 'Debug')
          .setValue(this.plugin.settings.logLevel.toString())
          .onChange(async (value) => {
            this.plugin.settings.logLevel = parseInt(value) as LogLevel
            Logger.setLevel(this.plugin.settings.logLevel)
            await this.plugin.saveSettings()
          }),
      )
  }
}
