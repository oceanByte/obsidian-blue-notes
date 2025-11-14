import { describe, it, expect, beforeEach, vi } from 'vitest'
import { App } from 'obsidian'
import { ChatView, CHAT_VIEW_TYPE } from '../../src/ui/chat-view'
import type SemanticNotesPlugin from '../../src/main'

describe('ChatView - Export Filename Sanitization', () => {
  let app: App
  let mockPlugin: Partial<SemanticNotesPlugin>
  let chatView: ChatView
  let mockLeaf: any

  beforeEach(() => {
    app = new App()

    mockPlugin = {
      app,
      settings: {
        chat: {
          temperature: 0.5,
          maxTokens: 2000,
          systemPrompt: 'You are a helpful assistant',
        },
      },
      chatProviderManager: {
        getProvider: vi.fn().mockReturnValue({
          isConfigured: vi.fn().mockReturnValue(true),
        }),
        getCurrentProviderName: vi.fn().mockReturnValue('OpenAI'),
        getCurrentModel: vi.fn().mockReturnValue('gpt-4'),
      },
      fileProcessor: {
        extractText: vi.fn().mockResolvedValue('test content'),
      },
    } as any

    mockLeaf = {
      view: {
        getViewType: vi.fn().mockReturnValue(CHAT_VIEW_TYPE),
        app,
      },
    }

    app.workspace = {
      activeLeaf: mockLeaf,
      getLeaf: vi.fn().mockReturnValue(mockLeaf),
      getActiveFile: vi.fn().mockReturnValue(null),
    } as any

    app.vault = {
      create: vi.fn().mockResolvedValue({}),
    } as any

    chatView = new ChatView(mockLeaf, mockPlugin as SemanticNotesPlugin)

    chatView['contextIndicator'] = {
      parentElement: {
        parentElement: {
          querySelector: vi.fn().mockReturnValue(null),
        },
      },
      removeClass: vi.fn(),
      addClass: vi.fn(),
    } as any

    chatView['sessionManager'].createNewSession()
  })

  describe('sanitizeFilename', () => {
    it('should remove colons from filenames', () => {
      const unsanitized = 'Chat 2025-11-14 15:58:00.md'
      const sanitized = chatView.sanitizeFilename(unsanitized)

      expect(sanitized).not.toContain(':')
    })

    it('should remove forward slashes from filenames', () => {
      const unsanitized = 'Chat/2025-11-14.md'
      const sanitized = chatView.sanitizeFilename(unsanitized)

      expect(sanitized).not.toContain('/')
    })

    it('should remove backslashes from filenames', () => {
      const unsanitized = 'Chat\\2025-11-14.md'
      const sanitized = chatView.sanitizeFilename(unsanitized)

      expect(sanitized).not.toContain('\\')
    })

    it('should remove all invalid filename characters', () => {
      const unsanitized = 'Chat 2025-11-14 15:58:00 <invalid> | ? *.md'
      const sanitized = chatView.sanitizeFilename(unsanitized)

      expect(sanitized).not.toMatch(/[<>:"/\\|?*]/)
    })

    it('should preserve valid characters', () => {
      const valid = 'Chat 2025-11-14.md'
      const sanitized = chatView.sanitizeFilename(valid)

      expect(sanitized).toBe(valid)
    })

    it('should replace invalid characters with hyphens for readability', () => {
      const unsanitized = 'Chat 2025-11-14 15:58:00.md'
      const sanitized = chatView.sanitizeFilename(unsanitized)

      expect(sanitized).toContain('-')
      expect(sanitized).toMatch(/Chat 2025-11-14 \d+-\d+-\d+\.md/)
    })

    it('should handle multiple consecutive invalid characters', () => {
      const unsanitized = 'Chat::: 2025.md'
      const sanitized = chatView.sanitizeFilename(unsanitized)

      expect(sanitized).not.toContain(':')
      expect(sanitized).toMatch(/Chat.*2025\.md/)
    })
  })

  describe('export with sanitized filename', () => {
    it('should export chat with sanitized filename', async () => {
      chatView['sessionManager'].addMessage({
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
      })

      await chatView['handleExport']()

      expect(app.vault.create).toHaveBeenCalled()
      const callArgs = vi.mocked(app.vault.create).mock.calls[0]
      const filename = callArgs[0] as string

      expect(filename).not.toMatch(/[<>:"/\\|?*]/)
      expect(filename).toMatch(/\.md$/)
    })
  })
})
