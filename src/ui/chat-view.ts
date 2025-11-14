import {
  ItemView,
  MarkdownRenderer,
  Notice,
  TFile,
  type WorkspaceLeaf,
} from 'obsidian'

import {
  type ChatMessage,
} from '../chat/providers/chat-provider-interface'
import { ChatSessionManager } from '../chat/chat-session'
import { Logger } from '../utils/logger'
import { NoteSelectorModal } from './note-selector-modal'

import type SemanticNotesPlugin from '../main'

export const CHAT_VIEW_TYPE = 'ai-chat-view'

export class ChatView extends ItemView {
  plugin: SemanticNotesPlugin
  sessionManager: ChatSessionManager
  private messagesContainer: HTMLElement
  private inputContainer: HTMLElement
  private inputEl: HTMLTextAreaElement
  private sendButton: HTMLButtonElement
  private statusEl: HTMLElement
  private contextIndicator: HTMLElement
  private isProcessing = false
  customContextNotes: string[] = []

  constructor(leaf: WorkspaceLeaf, plugin: SemanticNotesPlugin) {
    super(leaf)
    this.plugin = plugin
    this.sessionManager = new ChatSessionManager()
  }

  getViewType(): string {
    return CHAT_VIEW_TYPE
  }

  getDisplayText(): string {
    return 'AI Chat'
  }

  getIcon(): string {
    return 'message-square'
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1]
    container.empty()
    container.addClass('chat-view-container')

    this.createHeader(container)
    this.createStatusBar(container)
    this.createContextIndicator(container)
    this.createMessagesArea(container)
    this.createInputArea(container)

    this.sessionManager.createNewSession()
  }

  async onClose(): Promise<void> {
    this.containerEl.empty()
  }

  private createHeader(container: Element): void {
    const header = container.createDiv({ cls: 'chat-header' })

    header.createEl('h4', { text: 'AI Chat', cls: 'chat-title' })

    const actions = header.createDiv({ cls: 'chat-actions' })

    const exportBtn = actions.createEl('button', {
      cls: 'chat-action-button',
      attr: { 'aria-label': 'Export conversation' },
      text: '💾',
    })
    exportBtn.addEventListener('click', () => this.handleExport())

    const newChatBtn = actions.createEl('button', {
      cls: 'chat-action-button',
      attr: { 'aria-label': 'New conversation' },
      text: '📄',
    })
    newChatBtn.addEventListener('click', () => this.handleNewChat())
  }

  private createStatusBar(container: Element): void {
    this.statusEl = container.createDiv({ cls: 'chat-status-bar' })
    this.updateStatusBar()
  }

  private createContextIndicator(container: Element): void {
    const wrapper = container.createDiv({ cls: 'chat-context-wrapper' })

    const header = wrapper.createDiv({ cls: 'chat-context-header' })

    this.contextIndicator = header.createDiv({
      cls: 'chat-context-indicator',
    })
    this.contextIndicator.addEventListener('click', () => this.toggleContextDetails())

    const buttons = header.createDiv({ cls: 'chat-context-buttons' })

    const addCurrentNoteButton = buttons.createEl('button', {
      cls: 'chat-context-add-button',
      text: '📄',
      attr: { 'aria-label': 'Add current note as context' },
    })

    addCurrentNoteButton.addEventListener('click', (e) => {
      e.stopPropagation()
      this.handleAddCurrentNote()
    })

    const addButton = buttons.createEl('button', {
      cls: 'chat-context-add-button',
      text: '+',
      attr: { 'aria-label': 'Add custom context note' },
    })

    addButton.addEventListener('click', (e) => {
      e.stopPropagation()
      this.handleAddCustomContext()
    })

    this.updateContextIndicator()
  }

  private toggleContextDetails(): void {
    if (this.customContextNotes.length === 0) {
      return
    }

    const wrapper = this.contextIndicator.parentElement?.parentElement
    if (!wrapper) return

    const detailsEl = wrapper.querySelector(
      '.chat-context-details',
    )!

    if (detailsEl) {
      detailsEl.remove()
      this.contextIndicator.removeClass('expanded')
    } else {
      this.showContextDetails()
    }
  }

  private createMessagesArea(container: Element): void {
    const messagesWrapper = container.createDiv({
      cls: 'chat-messages-wrapper',
    })
    this.messagesContainer = messagesWrapper.createDiv({
      cls: 'chat-messages',
    })
  }

  private createInputArea(container: Element): void {
    this.inputContainer = container.createDiv({ cls: 'chat-input-container' })

    this.inputEl = this.inputContainer.createEl('textarea', {
      cls: 'chat-input',
      attr: {
        placeholder: 'Ask a question about your notes...',
        rows: '3',
      },
    })

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.handleSend()
      }
    })

    this.sendButton = this.inputContainer.createEl('button', {
      cls: 'chat-send-button',
      text: '↑',
      attr: { 'aria-label': 'Send message' },
    })

    this.sendButton.addEventListener('click', () => this.handleSend())
  }

  private updateStatusBar(): void {
    const provider = this.plugin.chatProviderManager.getProvider()
    const providerName =
      this.plugin.chatProviderManager.getCurrentProviderName()
    const model = this.plugin.chatProviderManager.getCurrentModel()

    if (!provider?.isConfigured()) {
      this.statusEl.setText('⚠️ No provider configured (click to configure)')
      this.statusEl.addClass('chat-status-warning')
      this.statusEl.addClass('chat-status-clickable')

      this.statusEl.removeEventListener('click', this.openSettings)
      this.statusEl.addEventListener('click', this.openSettings)
    } else {
      this.statusEl.setText(`${providerName} • ${model}`)
      this.statusEl.removeClass('chat-status-warning')
      this.statusEl.removeClass('chat-status-clickable')
      this.statusEl.removeEventListener('click', this.openSettings)
    }
  }

  private openSettings = async (): Promise<void> => {
    const setting = (this.app as any).setting
    await setting.open()
    setting.openTabById('resonance-notes')
  }

  private updateContextIndicator(): void {
    const wrapper = this.contextIndicator.parentElement
    if (!wrapper) return

    wrapper.show()
    this.contextIndicator.empty()

    const totalCount = this.customContextNotes.length

    let text = '📎 No context notes'
    if (totalCount > 0) {
      text = `📎 Context: ${totalCount} note${totalCount === 1 ? '' : 's'}`
      text += ' (click to toggle)'
    }

    this.contextIndicator.setText(text)

    if (totalCount > 0) {
      this.contextIndicator.addClass('clickable')
    } else {
      this.contextIndicator.removeClass('clickable')

      const wrapperParent = wrapper.parentElement
      if (wrapperParent) {
        const existingDetails = wrapperParent.querySelector('.chat-context-details')
        if (existingDetails) {
          existingDetails.remove()
          this.contextIndicator.removeClass('expanded')
        }
      }
    }
  }

  private showContextDetails(): void {
    const wrapper = this.contextIndicator.parentElement?.parentElement
    if (!wrapper) return

    if (this.customContextNotes.length === 0) return

    this.contextIndicator.addClass('expanded')
    const detailsEl = wrapper.createDiv({ cls: 'chat-context-details' })

    const customSection = detailsEl.createDiv({
      cls: 'chat-context-section',
    })

    const customList = customSection.createEl('ul', {
      cls: 'chat-context-notes-list',
    })

    this.customContextNotes.forEach((notePath) => {
      const file = this.app.vault.getAbstractFileByPath(notePath)
      const listItem = customList.createEl('li', {
        cls: 'chat-context-note-custom',
      })

      if (file instanceof TFile) {
        const link = listItem.createEl('a', {
          cls: 'chat-context-note-link',
          text: file.basename,
        })

        link.addEventListener('click', (e) => {
          e.preventDefault()
          this.app.workspace.getLeaf(false).openFile(file)
        })

        listItem.createEl('span', {
          cls: 'chat-context-note-path',
          text: ` (${file.parent?.path || ''})`,
        })

        const similarBtn = listItem.createEl('button', {
          cls: 'chat-context-note-similar',
          text: 'Similar',
          attr: { 'aria-label': 'Add similar notes' },
        })

        similarBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          this.handleAddSimilarNotes(file)
        })

        const removeBtn = listItem.createEl('button', {
          cls: 'chat-context-note-remove',
          text: '×',
          attr: { 'aria-label': 'Remove from context' },
        })

        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          this.removeCustomContext(notePath)
        })
      } else {
        listItem.setText(notePath)
      }
    })
  }

  private async handleSend(): Promise<void> {
    const content = this.inputEl.value.trim()

    if (!content || this.isProcessing) {
      return
    }

    const provider = this.plugin.chatProviderManager.getProvider()
    if (!provider?.isConfigured()) {
      new Notice('Please configure a chat provider in settings')
      return
    }

    this.isProcessing = true
    this.inputEl.value = ''
    this.inputEl.disabled = true
    this.sendButton.disabled = true

    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    }

    this.sessionManager.addMessage(userMessage)
    this.renderMessage(userMessage)
    this.scrollToBottom()

    const assistantMessageEl = this.createMessageElement('assistant')
    const assistantContentEl = assistantMessageEl.querySelector(
      '.chat-message-content',
    ) as HTMLElement

    try {
      const messages = await this.buildMessagesForAPI()

      let fullResponse = ''

      const stream = provider.streamMessage({
        messages,
        temperature: this.plugin.settings.chat.temperature,
        maxTokens: this.plugin.settings.chat.maxTokens,
        stream: true,
      })

      for await (const chunk of stream) {
        fullResponse += chunk
        assistantContentEl.setText(fullResponse)
        this.scrollToBottom()
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      }

      this.sessionManager.addMessage(assistantMessage)
      this.sessionManager.markFirstRequestComplete()

      assistantContentEl.empty()
      await MarkdownRenderer.renderMarkdown(
        fullResponse,
        assistantContentEl,
        '',
        this.plugin,
      )
    } catch (error) {
      Logger.error('Chat error:', error)

      const errorMessage = error?.message || 'An error occurred while processing your request.'

      assistantContentEl.setText(`❌ ${errorMessage}`)
      assistantContentEl.addClass('chat-message-error')

      new Notice(errorMessage)
    } finally {
      this.isProcessing = false
      this.inputEl.disabled = false
      this.sendButton.disabled = false
      this.inputEl.focus()
    }
  }

  private async buildMessagesForAPI(): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = []
    const isFirstRequest = this.sessionManager.isFirstRequest()

    let systemContent = this.plugin.settings.chat.systemPrompt || ''

    if (isFirstRequest && this.customContextNotes.length > 0) {
      const customContextMessage = await this.buildCustomContextMessage()
      if (customContextMessage) {
        systemContent = customContextMessage + '\n\n' + systemContent
      }
    }

    if (systemContent) {
      messages.push({
        role: 'system',
        content: systemContent,
        timestamp: Date.now(),
      })
    }

    const conversationMessages = this.sessionManager.getMessages()
    const messagesToInclude = isFirstRequest
      ? conversationMessages
      : conversationMessages.slice(-15)

    messages.push(...messagesToInclude)

    return messages
  }

  private async buildCustomContextMessage(): Promise<string> {
    if (this.customContextNotes.length === 0) {
      return ''
    }

    const parts: string[] = []
    parts.push('# Custom Context Notes')
    parts.push('')
    parts.push('The following notes were explicitly selected as context:')
    parts.push('')

    for (const notePath of this.customContextNotes) {
      const file = this.app.vault.getAbstractFileByPath(notePath)

      if (file instanceof TFile) {
        try {
          const content = await this.plugin.fileProcessor.extractText(file)
          parts.push(`## Note: ${file.basename}`)
          parts.push(`Path: ${file.path}`)
          parts.push('')
          parts.push(content)
          parts.push('')
          parts.push('---')
          parts.push('')
        } catch (error) {
          Logger.error(`Error reading custom context note ${notePath}:`, error)
        }
      }
    }

    return parts.join('\n')
  }

  private renderMessage(message: ChatMessage): void {
    const messageEl = this.createMessageElement(message.role)
    const contentEl = messageEl.querySelector(
      '.chat-message-content',
    ) as HTMLElement

    if (message.role === 'assistant') {
      MarkdownRenderer.renderMarkdown(
        message.content,
        contentEl,
        '',
        this.plugin,
      )
    } else {
      contentEl.setText(message.content)
    }
  }

  private createMessageElement(
    role: 'user' | 'assistant' | 'system',
  ): HTMLElement {
    const messageEl = this.messagesContainer.createDiv({
      cls: `chat-message chat-message-${role}`,
    })

    const avatar = messageEl.createDiv({ cls: 'chat-message-avatar' })
    avatar.setText(role === 'user' ? '👤' : '🤖')

    const content = messageEl.createDiv({ cls: 'chat-message-content' })

    const timestamp = messageEl.createDiv({ cls: 'chat-message-timestamp' })
    timestamp.setText(new Date().toLocaleTimeString())

    if (role === 'assistant') {
      const actions = messageEl.createDiv({ cls: 'chat-message-actions' })

      const copyBtn = actions.createEl('button', {
        cls: 'chat-message-action-button',
        text: '📋',
        attr: { 'aria-label': 'Copy message' },
      })

      copyBtn.addEventListener('click', () => {
        const text = content.getText()
        navigator.clipboard.writeText(text)
        new Notice('Copied to clipboard')
      })
    }

    return messageEl
  }

  private scrollToBottom(): void {
    const wrapper = this.messagesContainer.parentElement
    if (wrapper) {
      wrapper.scrollTop = wrapper.scrollHeight
    }
  }

  handleNewChat(): void {
    if (this.sessionManager.hasMessages()) {
      this.messagesContainer.empty()
      this.sessionManager.createNewSession()
      this.updateContextIndicator()
      new Notice('Started new conversation')
    }
  }

  private async handleExport(): Promise<void> {
    if (!this.sessionManager.hasMessages()) {
      new Notice('No conversation to export')
      return
    }

    try {
      const markdown = this.sessionManager.exportToMarkdown()

      const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const filename = `Chat ${timestamp}.md`

      await this.app.vault.create(filename, markdown)
      new Notice(`Exported to ${filename}`)
    } catch (error) {
      Logger.error('Export error:', error)
      new Notice('Failed to export conversation')
    }
  }

  refresh(): void {
    this.updateStatusBar()
    this.updateContextIndicator()
  }

  setContextNotes(notes: string[]): void {
    this.sessionManager.setContextNotes(notes)
    this.updateContextIndicator()
  }

  private handleAddCustomContext(): void {
    new NoteSelectorModal(this.app, (file: TFile) => {
      if (!this.customContextNotes.includes(file.path)) {
        this.customContextNotes.push(file.path)
        new Notice(`Added ${file.basename} to context`)

        const wrapper = this.contextIndicator.parentElement?.parentElement
        const detailsWereShown = wrapper?.querySelector('.chat-context-details') !== null

        if (wrapper) {
          const existingDetails = wrapper.querySelector('.chat-context-details')
          if (existingDetails) {
            existingDetails.remove()
            this.contextIndicator.removeClass('expanded')
          }
        }

        this.updateContextIndicator()

        if (detailsWereShown) {
          this.showContextDetails()
        }
      } else {
        new Notice(`${file.basename} is already in context`)
      }
    }).open()
  }

  handleAddCurrentNote(): void {
    const activeFile = this.app.workspace.getActiveFile()

    if (!activeFile) {
      new Notice('No file is currently open')
      return
    }

    if (activeFile.extension !== 'md') {
      new Notice('Only markdown files can be added as context')
      return
    }

    if (this.customContextNotes.includes(activeFile.path)) {
      new Notice(`${activeFile.basename} is already in context`)
      return
    }

    this.customContextNotes.push(activeFile.path)
    new Notice(`Added ${activeFile.basename} to context`)

    const wrapper = this.contextIndicator.parentElement?.parentElement
    const detailsWereShown = wrapper?.querySelector('.chat-context-details') !== null

    if (wrapper) {
      const existingDetails = wrapper.querySelector('.chat-context-details')
      if (existingDetails) {
        existingDetails.remove()
        this.contextIndicator.removeClass('expanded')
      }
    }

    this.updateContextIndicator()

    if (detailsWereShown) {
      this.showContextDetails()
    }
  }

  private removeCustomContext(notePath: string): void {
    const index = this.customContextNotes.indexOf(notePath)
    if (index > -1) {
      this.customContextNotes.splice(index, 1)

      const wrapper = this.contextIndicator.parentElement?.parentElement
      const detailsWereShown = wrapper?.querySelector('.chat-context-details') !== null

      if (wrapper) {
        const existingDetails = wrapper.querySelector('.chat-context-details')
        if (existingDetails) {
          existingDetails.remove()
          this.contextIndicator.removeClass('expanded')
        }
      }

      this.updateContextIndicator()

      if (detailsWereShown && this.customContextNotes.length > 0) {
        this.showContextDetails()
      }
    }
  }

  clearCustomContext(): void {
    this.customContextNotes = []
    this.updateContextIndicator()
  }

  private async handleAddSimilarNotes(file?: TFile): Promise<void> {
    const targetFile = file || this.app.workspace.getActiveFile()

    if (!targetFile) {
      new Notice('No file specified to find similar notes')
      return
    }

    try {
      new Notice(`Finding notes similar to ${targetFile.basename}...`)

      const stats = this.plugin.semanticSearch.getIndexStats()
      if (stats.cachedNotes === 0) {
        new Notice('No embeddings found. Please process your vault first.')
        return
      }

      Logger.debug(`Finding similar notes for: ${targetFile.path}`)
      Logger.debug(`Index stats: ${stats.cachedNotes} cached notes`)

      const results = await this.plugin.semanticSearch.findSimilar(targetFile, {
        limit: 5,
        threshold: 0.3,
      })

      Logger.debug(`Found ${results.length} similar notes`)

      if (results.length === 0) {
        new Notice(
          'No similar notes found. Try lowering the threshold or processing more notes.',
        )
        return
      }

      let addedCount = 0
      for (const result of results) {
        if (!this.customContextNotes.includes(result.path)) {
          this.customContextNotes.push(result.path)
          addedCount++
        }
      }

      if (addedCount > 0) {
        const wrapper = this.contextIndicator.parentElement?.parentElement
        const detailsWereShown = wrapper?.querySelector('.chat-context-details') !== null

        if (wrapper) {
          const existingDetails = wrapper.querySelector('.chat-context-details')
          if (existingDetails) {
            existingDetails.remove()
            this.contextIndicator.removeClass('expanded')
          }
        }

        this.updateContextIndicator()

        if (detailsWereShown) {
          this.showContextDetails()
        }

        new Notice(
          `Added ${addedCount} similar note${addedCount === 1 ? '' : 's'} to context`,
        )
      } else {
        new Notice('All similar notes are already in context')
      }
    } catch (error) {
      Logger.error('Error finding similar notes:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      new Notice(`Failed to find similar notes: ${errorMsg}`)
    }
  }
}
