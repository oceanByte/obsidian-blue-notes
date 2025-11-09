import type { ChatMessage } from './providers/chat-provider-interface'

export interface ChatSession {
  id: string;
  created: number;
  updated: number;
  messages: ChatMessage[];
  contextNotes: string[];
  isFirstRequest: boolean;
}

export class ChatSessionManager {
  private currentSession: ChatSession | null = null

  createNewSession(): ChatSession {
    this.currentSession = {
      id: this.generateSessionId(),
      created: Date.now(),
      updated: Date.now(),
      messages: [],
      contextNotes: [],
      isFirstRequest: true,
    }
    return this.currentSession
  }

  getCurrentSession(): ChatSession | null {
    return this.currentSession
  }

  addMessage(message: ChatMessage): void {
    if (!this.currentSession) {
      this.createNewSession()
    }
    this.currentSession!.messages.push(message)
    this.currentSession!.updated = Date.now()
  }

  getMessages(): ChatMessage[] {
    return this.currentSession?.messages || []
  }

  setContextNotes(notes: string[]): void {
    if (!this.currentSession) {
      this.createNewSession()
    }
    this.currentSession!.contextNotes = notes
  }

  getContextNotes(): string[] {
    return this.currentSession?.contextNotes || []
  }

  clearSession(): void {
    this.currentSession = null
  }

  hasMessages(): boolean {
    return (this.currentSession?.messages.length || 0) > 0
  }

  isFirstRequest(): boolean {
    return this.currentSession?.isFirstRequest ?? true
  }

  markFirstRequestComplete(): void {
    if (this.currentSession) {
      this.currentSession.isFirstRequest = false
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  exportToMarkdown(): string {
    if (!this.currentSession || this.currentSession.messages.length === 0) {
      return ''
    }

    const lines: string[] = []
    lines.push('# Chat Session')
    lines.push('')
    lines.push(`Created: ${new Date(this.currentSession.created).toLocaleString()}`)
    lines.push('')

    if (this.currentSession.contextNotes.length > 0) {
      lines.push('## Context Notes')
      this.currentSession.contextNotes.forEach((note) => {
        lines.push(`- [[${note}]]`)
      })
      lines.push('')
    }

    lines.push('## Conversation')
    lines.push('')

    this.currentSession.messages.forEach((message) => {
      if (message.role === 'user') {
        lines.push('### You')
        lines.push('')
        lines.push(message.content)
        lines.push('')
      } else if (message.role === 'assistant') {
        lines.push('### AI')
        lines.push('')
        lines.push(message.content)
        lines.push('')
      }
    })

    return lines.join('\n')
  }
}
