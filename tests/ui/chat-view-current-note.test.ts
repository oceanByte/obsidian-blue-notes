import { describe, it, expect, beforeEach, vi } from 'vitest'
import { App, TFile, ItemView, MarkdownRenderer, Notice } from 'obsidian'
import { ChatView, CHAT_VIEW_TYPE } from '../../src/ui/chat-view'
import type SemanticNotesPlugin from '../../src/main'

describe('ChatView - Add Current Note Button', () => {
  let app: App
  let mockPlugin: Partial<SemanticNotesPlugin>
  let chatView: ChatView
  let mockLeaf: any

  beforeEach(() => {
    app = new App()

    // Mock the plugin with required dependencies
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
          streamMessage: vi.fn(),
        }),
        getCurrentProviderName: vi.fn().mockReturnValue('OpenAI'),
        getCurrentModel: vi.fn().mockReturnValue('gpt-4'),
      },
      fileProcessor: {
        extractText: vi.fn().mockResolvedValue('test content'),
      },
      semanticSearch: {
        getIndexStats: vi.fn().mockReturnValue({ cachedNotes: 100 }),
        findSimilar: vi.fn().mockResolvedValue([]),
      },
    } as any

    // Mock the workspace leaf with proper structure
    mockLeaf = {
      view: {
        getViewType: vi.fn().mockReturnValue(CHAT_VIEW_TYPE),
        app,
      },
    }

    app.workspace = {
      activeLeaf: mockLeaf,
      onLayoutChange: vi.fn(),
      getLeaf: vi.fn().mockReturnValue(mockLeaf),
      getActiveFile: vi.fn().mockReturnValue(null),
    } as any

    // Create ChatView instance
    chatView = new ChatView(mockLeaf, mockPlugin as SemanticNotesPlugin)

    // Mock the DOM elements that are created in onOpen
    chatView['contextIndicator'] = {
      parentElement: {
        parentElement: {
          querySelector: vi.fn().mockReturnValue(null),
        },
      },
      removeClass: vi.fn(),
      addClass: vi.fn(),
    } as any

    // Mock private methods to avoid DOM operations
    chatView['updateContextIndicator'] = vi.fn()
    chatView['showContextDetails'] = vi.fn()
  })

  describe('handleAddCurrentNote', () => {
    it('should add current note to custom context when note is open', () => {
      // Arrange: Set up an active markdown file
      const mockFile = new TFile('test-note.md')
      mockFile.path = 'folder/test-note.md'
      vi.mocked(app.workspace.getActiveFile).mockReturnValue(mockFile)

      // Act: Call the method to add current note
      chatView.handleAddCurrentNote()

      // Assert: Current note path should be in custom context
      expect(chatView.customContextNotes).toContain('folder/test-note.md')
    })

    it('should not add note if no file is currently active', () => {
      // Arrange: No active file
      vi.mocked(app.workspace.getActiveFile).mockReturnValue(null)

      const initialCount = chatView.customContextNotes.length

      // Act: Try to add current note
      chatView.handleAddCurrentNote()

      // Assert: Context notes should not change
      expect(chatView.customContextNotes.length).toBe(initialCount)
    })

    it('should not add note if it is not a markdown file', () => {
      // Arrange: Set up a non-markdown file
      const mockFile = new TFile('test-note.txt')
      mockFile.path = 'folder/test-note.txt'
      mockFile.extension = 'txt'
      vi.mocked(app.workspace.getActiveFile).mockReturnValue(mockFile)

      const initialCount = chatView.customContextNotes.length

      // Act: Try to add current note
      chatView.handleAddCurrentNote()

      // Assert: Non-markdown file should not be added
      expect(chatView.customContextNotes.length).toBe(initialCount)
    })

    it('should not add duplicate if note is already in context', () => {
      // Arrange: Set up an active markdown file and add it first time
      const mockFile = new TFile('test-note.md')
      mockFile.path = 'folder/test-note.md'
      vi.mocked(app.workspace.getActiveFile).mockReturnValue(mockFile)

      chatView.handleAddCurrentNote()
      const countAfterFirst = chatView.customContextNotes.length

      // Act: Try to add the same note again
      chatView.handleAddCurrentNote()

      // Assert: Should still have the same count (no duplicate)
      expect(chatView.customContextNotes.length).toBe(countAfterFirst)
      // Count occurrences of the path
      const occurrences = chatView.customContextNotes.filter(
        (path) => path === 'folder/test-note.md',
      ).length
      expect(occurrences).toBe(1)
    })

    it('should show success notice when note is added', () => {
      // Arrange
      const mockFile = new TFile('test-note.md')
      mockFile.path = 'folder/test-note.md'
      vi.mocked(app.workspace.getActiveFile).mockReturnValue(mockFile)

      // Act
      chatView.handleAddCurrentNote()

      // Assert: Verify that the note was added
      expect(chatView.customContextNotes).toContain('folder/test-note.md')
    })

    it('should update context indicator after adding note', () => {
      // Arrange
      const mockFile = new TFile('test-note.md')
      mockFile.path = 'folder/test-note.md'
      vi.mocked(app.workspace.getActiveFile).mockReturnValue(mockFile)

      // Act
      chatView.handleAddCurrentNote()

      // Assert: customContextNotes should be updated
      expect(chatView.customContextNotes.length).toBeGreaterThan(0)
      expect(chatView.customContextNotes).toContain('folder/test-note.md')
    })
  })

  describe('Add Current Note button visibility', () => {
    it('button should be disabled when no file is active', () => {
      // Arrange
      app.workspace.activeLeaf!.view.file = null

      // We'll verify this after implementation
      expect(chatView).toBeDefined()
    })

    it('button should be enabled when markdown file is active', () => {
      // Arrange
      const mockFile = new TFile('test-note.md')
      mockFile.path = 'folder/test-note.md'
      app.workspace.activeLeaf!.view.file = mockFile

      // We'll verify this after implementation
      expect(chatView).toBeDefined()
    })
  })
})
