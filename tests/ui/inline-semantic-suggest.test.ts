import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InlineSemanticSuggest } from '../../src/ui/inline-semantic-suggest'
import type SemanticNotesPlugin from '../../src/main'
import type { Editor, EditorPosition } from 'obsidian'

// Mock plugin with minimal required structure
const createMockPlugin = (): Partial<SemanticNotesPlugin> => ({
  app: {} as any,
  settings: {
    inlineSearch: {
      enabled: true,
      threshold: 0.3,
      limit: 10,
    },
    provider: {
      type: 'onnx' as any,
      modelType: 'e5-small' as any,
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
    logLevel: 'error' as any,
    chat: {} as any,
  },
  semanticSearch: {
    search: vi.fn().mockResolvedValue([]),
  } as any,
})

// Mock Editor
const createMockEditor = (line: string): Partial<Editor> => ({
  getLine: vi.fn().mockReturnValue(line),
  replaceRange: vi.fn(),
  setCursor: vi.fn(),
})

describe('InlineSemanticSuggest', () => {
  let suggest: InlineSemanticSuggest
  let mockPlugin: Partial<SemanticNotesPlugin>

  beforeEach(() => {
    mockPlugin = createMockPlugin()
    suggest = new InlineSemanticSuggest(mockPlugin as SemanticNotesPlugin)
  })

  describe('onTrigger', () => {
    it('should trigger when typing "//" at start of line', () => {
      const editor = createMockEditor('//test query') as Editor
      const cursor: EditorPosition = { line: 0, ch: 12 }

      const result = suggest.onTrigger(cursor, editor, null)

      expect(result).not.toBeNull()
      expect(result?.query).toBe('test query')
      expect(result?.start).toEqual({ line: 0, ch: 0 })
      expect(result?.end).toEqual(cursor)
    })

    it('should trigger when typing "//" in middle of line', () => {
      const editor = createMockEditor('Some text //search term') as Editor
      const cursor: EditorPosition = { line: 0, ch: 23 }

      const result = suggest.onTrigger(cursor, editor, null)

      expect(result).not.toBeNull()
      expect(result?.query).toBe('search term')
      expect(result?.start).toEqual({ line: 0, ch: 10 })
      expect(result?.end).toEqual(cursor)
    })

    it('should trigger with empty query after "//"', () => {
      const editor = createMockEditor('//') as Editor
      const cursor: EditorPosition = { line: 0, ch: 2 }

      const result = suggest.onTrigger(cursor, editor, null)

      expect(result).not.toBeNull()
      expect(result?.query).toBe('')
      expect(result?.start).toEqual({ line: 0, ch: 0 })
      expect(result?.end).toEqual(cursor)
    })

    it('should not trigger without "//"', () => {
      const editor = createMockEditor('normal text') as Editor
      const cursor: EditorPosition = { line: 0, ch: 11 }

      const result = suggest.onTrigger(cursor, editor, null)

      expect(result).toBeNull()
    })

    it('should not trigger with single "/"', () => {
      const editor = createMockEditor('/single slash') as Editor
      const cursor: EditorPosition = { line: 0, ch: 13 }

      const result = suggest.onTrigger(cursor, editor, null)

      expect(result).toBeNull()
    })
  })

  describe('getSuggestions', () => {
    it('should return empty array for queries shorter than 2 characters', async () => {
      const context = {
        query: 'a',
        start: { line: 0, ch: 0 },
        end: { line: 0, ch: 3 },
      } as any

      const results = await suggest.getSuggestions(context)

      expect(results).toEqual([])
      expect(mockPlugin.semanticSearch?.search).not.toHaveBeenCalled()
    })

    it('should call semantic search with query and settings', async () => {
      const DEBOUNCE_WAIT_TIME_MS = 350

      const context = {
        query: 'test query',
        start: { line: 0, ch: 0 },
        end: { line: 0, ch: 12 },
      } as any

      const mockResults = [
        {
          file: { basename: 'Test Note' } as any,
          chunk: { headings: [], preview: 'Test content' } as any,
          chunkId: 'chunk-1',
          similarity: 0.8,
          path: 'Test Note.md',
          metadata: { wordCount: 100, tags: [], folder: '/' },
        },
      ]

      vi.mocked(mockPlugin.semanticSearch!.search).mockResolvedValue(mockResults)

      const resultsPromise = suggest.getSuggestions(context)
      await new Promise(resolve => setTimeout(resolve, DEBOUNCE_WAIT_TIME_MS))
      const results = await resultsPromise

      expect(mockPlugin.semanticSearch?.search).toHaveBeenCalledWith('test query', {
        limit: 10,
        threshold: 0.3,
      })
      expect(results).toEqual(mockResults)
    })

    it('should handle search errors gracefully', async () => {
      const DEBOUNCE_WAIT_TIME_MS = 350

      const context = {
        query: 'test query',
        start: { line: 0, ch: 0 },
        end: { line: 0, ch: 12 },
      } as any

      vi.mocked(mockPlugin.semanticSearch!.search).mockRejectedValue(
        new Error('Search failed'),
      )

      const resultsPromise = suggest.getSuggestions(context)
      await new Promise(resolve => setTimeout(resolve, DEBOUNCE_WAIT_TIME_MS))
      const results = await resultsPromise

      expect(results).toEqual([])
    })

    it('should debounce searches', async () => {
      const DEBOUNCE_WAIT_TIME_MS = 350

      const context = {
        query: 'test',
        start: { line: 0, ch: 0 },
        end: { line: 0, ch: 6 },
      } as any

      vi.mocked(mockPlugin.semanticSearch!.search).mockClear()

      suggest.getSuggestions(context)
      suggest.getSuggestions(context)
      const lastPromise = suggest.getSuggestions(context)

      await new Promise(resolve => setTimeout(resolve, DEBOUNCE_WAIT_TIME_MS))
      await lastPromise

      expect(mockPlugin.semanticSearch?.search).toHaveBeenCalledTimes(1)
    })
  })

  describe('selectSuggestion', () => {
    it('should replace query with wiki link', () => {
      const mockEditor = createMockEditor('//test query')
      const context = {
        editor: mockEditor,
        start: { line: 0, ch: 0 },
        end: { line: 0, ch: 12 },
      }

      ;(suggest as any).context = context

      const result = {
        file: { basename: 'My Note' } as any,
        chunk: { headings: [], preview: 'Content' } as any,
        chunkId: 'chunk-1',
        similarity: 0.9,
        path: 'My Note.md',
        metadata: { wordCount: 100, tags: [], folder: '/' },
      }

      const wikiLink = '[[My Note]]'
      const expectedCursorPosition = wikiLink.length

      suggest.selectSuggestion(result, {} as any)

      expect(mockEditor.replaceRange).toHaveBeenCalledWith(
        wikiLink,
        { line: 0, ch: 0 },
        { line: 0, ch: 12 },
      )

      expect(mockEditor.setCursor).toHaveBeenCalledWith({
        line: 0,
        ch: expectedCursorPosition,
      })
    })
  })
})
