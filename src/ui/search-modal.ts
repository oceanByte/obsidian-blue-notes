import {
  type App,
  Notice,
  SuggestModal,
  type TFile,
} from 'obsidian'

import { Logger } from '../utils/logger'
import { MESSAGES } from '../constants/messages'

import type { ChunkSearchResult } from '../search/semantic-search'
import type SemanticNotesPlugin from '../main'

export class SemanticSearchModal extends SuggestModal<ChunkSearchResult> {
  private plugin: SemanticNotesPlugin
  private searchTimeout: NodeJS.Timeout | null = null

  constructor(app: App, plugin: SemanticNotesPlugin) {
    super(app)
    this.plugin = plugin
    this.setPlaceholder('Type to search notes semantically...')
    this.setInstructions([
      { command: '↑↓', purpose: 'navigate' },
      { command: '↵', purpose: 'open note' },
      { command: 'esc', purpose: 'dismiss' },
    ])
  }

  async getSuggestions(query: string): Promise<ChunkSearchResult[]> {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout)
    }

    if (!query || query.length < 3) {
      return []
    }

    return new Promise((resolve) => {
      this.searchTimeout = setTimeout(async () => {
        try {
          const searcher = this.plugin.semanticSearch
          if (!searcher) {
            Logger.error('Semantic search not initialized')
            resolve([])
            return
          }

          Logger.debug('Searching for:', query)
          const results = await searcher.search(query, {
            limit: 20,
            threshold: 0.1, // Lower threshold to show more results
          })

          Logger.debug(`Found ${results.length} results`)
          resolve(results)
        } catch (error) {
          new Notice(MESSAGES.SEARCH_FAILED(error.message))
          resolve([])
        }
      }, 200) // debounce delay
    })
  }

  renderSuggestion(result: ChunkSearchResult, el: HTMLElement): void {
    el.addClass('semantic-search-result')

    const header = el.createDiv({ cls: 'semantic-search-header' })

    const fileName = header.createDiv({ cls: 'semantic-search-filename' })
    fileName.setText(result.file.basename)

    if (result.chunk.headings.length > 0) {
      const headingPath = header.createDiv({ cls: 'semantic-search-heading-path' })
      const headingText = result.chunk.headings
        .map(h => h.replace(/^#+\s*/, ''))  // Remove # markers
        .join(' › ')
      headingPath.setText(headingText)
    }

    const preview = el.createDiv({ cls: 'semantic-search-preview' })
    preview.setText(result.chunk.preview)

    const footer = el.createDiv({ cls: 'semantic-search-footer' })

    const meta = footer.createDiv({ cls: 'semantic-search-meta' })
    const similarity = (result.similarity * 100).toFixed(1)
    const chunkWords = result.chunk.wordCount
    meta.setText(
      `${similarity}% • ${result.metadata.folder || '/'} • ${chunkWords} words`,
    )

    if (result.metadata.tags.length > 0) {
      const tags = footer.createDiv({ cls: 'semantic-search-tags' })
      tags.setText(result.metadata.tags.slice(0, 3).join(' '))
    }
  }

  onChooseSuggestion(result: ChunkSearchResult): void {
    this.app.workspace.getLeaf().openFile(result.file)
  }
}

export class SimilarNotesModal extends SuggestModal<ChunkSearchResult> {
  private results: ChunkSearchResult[]

  constructor(app: App, sourceFile: TFile, results: ChunkSearchResult[]) {
    super(app)
    this.results = results
    this.setPlaceholder(
      `${results.length} chunks similar to "${sourceFile.basename}"`,
    )
    this.setInstructions([
      { command: '↑↓', purpose: 'navigate' },
      { command: '↵', purpose: 'open note' },
      { command: 'esc', purpose: 'dismiss' },
    ])
  }

  getSuggestions(): ChunkSearchResult[] {
    return this.results
  }

  renderSuggestion(result: ChunkSearchResult, el: HTMLElement): void {
    el.addClass('semantic-search-result')

    const header = el.createDiv({ cls: 'semantic-search-header' })

    const fileName = header.createDiv({ cls: 'semantic-search-filename' })
    fileName.setText(result.file.basename)

    if (result.chunk.headings.length > 0) {
      const headingPath = header.createDiv({ cls: 'semantic-search-heading-path' })
      const headingText = result.chunk.headings
        .map(h => h.replace(/^#+\s*/, ''))  // Remove # markers
        .join(' › ')
      headingPath.setText(headingText)
    }

    const preview = el.createDiv({ cls: 'semantic-search-preview' })
    preview.setText(result.chunk.preview)

    const footer = el.createDiv({ cls: 'semantic-search-footer' })

    const meta = footer.createDiv({ cls: 'semantic-search-meta' })
    const similarity = (result.similarity * 100).toFixed(1)
    const chunkWords = result.chunk.wordCount
    meta.setText(
      `${similarity}% similar • ${result.metadata.folder || '/'} • ${chunkWords} words`,
    )

    if (result.metadata.tags.length > 0) {
      const tags = footer.createDiv({ cls: 'semantic-search-tags' })
      tags.setText(result.metadata.tags.slice(0, 3).join(' '))
    }
  }

  onChooseSuggestion(result: ChunkSearchResult): void {
    this.app.workspace.getLeaf().openFile(result.file)
  }
}
