import { App, TFile } from 'obsidian'
import { SemanticSearchModal } from '../../src/ui/search-modal'
import type SemanticNotesPlugin from '../../src/main'

vi.useFakeTimers()

describe('SemanticSearchModal', () => {
  let app: App
  let mockPlugin: Partial<SemanticNotesPlugin>
  let searchModal: SemanticSearchModal
  let mockSearch: any

  beforeEach(() => {
    app = new App()

    mockSearch = vi.fn().mockResolvedValue([
      {
        file: new TFile('test.md'),
        chunk: {
          content: 'test content',
          preview: 'test preview',
          startLine: 0,
          endLine: 10,
          headings: [],
          wordCount: 2,
          hash: 'hash1',
        },
        similarity: 0.95,
        metadata: {
          wordCount: 100,
          tags: [],
          folder: '/',
        },
        path: 'test.md',
      },
    ])

    mockPlugin = {
      semanticSearch: {
        search: mockSearch,
      },
    } as any

    searchModal = new SemanticSearchModal(app, mockPlugin as SemanticNotesPlugin)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('debouncing', () => {
    it('should debounce search calls and only execute once after delay', async () => {
      const query = 'test query'

      // Simulate rapid typing - call getSuggestions multiple times
      // Only the last call's promise will resolve; earlier ones are cancelled
      searchModal.getSuggestions(query)
      searchModal.getSuggestions(query)
      const lastPromise = searchModal.getSuggestions(query)

      // Fast-forward time by the debounce delay (300ms)
      await vi.advanceTimersByTimeAsync(300)

      // Wait for the last promise to resolve
      await lastPromise

      // Search should only be called once, not three times
      expect(mockSearch).toHaveBeenCalledTimes(1)
      expect(mockSearch).toHaveBeenCalledWith(query, {
        limit: 20,
        threshold: 0.1,
      })
    })

    it('should not execute search before debounce delay', async () => {
      const query = 'test query'

      searchModal.getSuggestions(query)

      // Advance time by less than debounce delay
      await vi.advanceTimersByTimeAsync(100)

      // Search should not have been called yet
      expect(mockSearch).not.toHaveBeenCalled()
    })

    it('should reset debounce timer on each new keystroke', async () => {
      const query = 'test query'

      // Simulate typing with delays
      searchModal.getSuggestions('t')
      await vi.advanceTimersByTimeAsync(100)

      searchModal.getSuggestions('te')
      await vi.advanceTimersByTimeAsync(100)

      searchModal.getSuggestions('tes')
      await vi.advanceTimersByTimeAsync(100)

      searchModal.getSuggestions(query)

      // At this point, 300ms have passed total, but timer was reset each time
      expect(mockSearch).not.toHaveBeenCalled()

      // Now advance by the full debounce delay
      await vi.advanceTimersByTimeAsync(300)

      // Now it should have been called once
      expect(mockSearch).toHaveBeenCalledTimes(1)
      expect(mockSearch).toHaveBeenCalledWith(query, {
        limit: 20,
        threshold: 0.1,
      })
    })

    it('should return empty array for queries shorter than 3 characters without debouncing', async () => {
      const result = await searchModal.getSuggestions('ab')

      // Should return immediately without waiting for debounce
      expect(result).toEqual([])
      expect(mockSearch).not.toHaveBeenCalled()
    })
  })
})
