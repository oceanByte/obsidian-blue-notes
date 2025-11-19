import {
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
} from 'obsidian'

import { Logger } from '../utils/logger'
import type { ChunkSearchResult } from '../search/semantic-search'
import type SemanticNotesPlugin from '../main'

/**
 * Inline semantic search suggester that triggers with "//" character sequence
 * Provides real-time semantic search results as the user types
 */
export class InlineSemanticSuggest extends EditorSuggest<ChunkSearchResult> {
  private plugin: SemanticNotesPlugin
  private searchTimeout: NodeJS.Timeout | null = null

  constructor(plugin: SemanticNotesPlugin) {
    super(plugin.app)
    this.plugin = plugin
  }

  /**
   * Detects when the user types "//" followed by optional text
   * Returns trigger info if found, null otherwise
   */
  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    _file: TFile | null,
  ): EditorSuggestTriggerInfo | null {
    const line = editor.getLine(cursor.line)
    const textBeforeCursor = line.substring(0, cursor.ch)

    const TRIGGER_PATTERN = /\/\/([^\[\]]*?)$/
    const match = textBeforeCursor.match(TRIGGER_PATTERN)

    if (!match) {
      return null
    }

    const query = match[1]
    const startPos = cursor.ch - match[0].length

    Logger.debug(`[InlineSearch] Triggered with query: "${query}"`)

    return {
      start: { line: cursor.line, ch: startPos },
      end: cursor,
      query,
    }
  }

  /**
   * Performs semantic search based on the user's query
   * Debounced to avoid excessive searches while typing
   */
  async getSuggestions(
    context: EditorSuggestContext,
  ): Promise<ChunkSearchResult[]> {
    const query = context.query.trim()
    const MIN_QUERY_LENGTH = 2
    const DEBOUNCE_DELAY_MS = 300

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout)
      this.searchTimeout = null
    }

    if (query.length < MIN_QUERY_LENGTH) {
      Logger.debug('[InlineSearch] Query too short, returning empty results')
      return []
    }

    return new Promise((resolve) => {
      this.searchTimeout = setTimeout(async () => {
        try {
          const searcher = this.plugin.semanticSearch
          if (!searcher) {
            Logger.error('[InlineSearch] Semantic search not initialized')
            resolve([])
            return
          }

          Logger.debug(`[InlineSearch] Searching for: "${query}"`)

          const settings = this.plugin.settings
          const results = await searcher.search(query, {
            limit: settings.searchLimit || 10,
            threshold: settings.searchThreshold || 0.3,
          })

          Logger.debug(`[InlineSearch] Found ${results.length} results`)
          resolve(results)
        } catch (error) {
          Logger.error('[InlineSearch] Search failed:', error)
          resolve([])
        }
      }, DEBOUNCE_DELAY_MS)
    })
  }

  /**
   * Renders each search result in the suggestion popup
   * Shows note name, heading path, preview, and similarity score
   */
  renderSuggestion(result: ChunkSearchResult, el: HTMLElement): void {
    const MAX_PREVIEW_LENGTH = 150
    const MAX_TAGS_DISPLAYED = 3

    el.addClass('inline-semantic-search-result')

    const container = el.createDiv({ cls: 'inline-semantic-search-container' })

    const header = container.createDiv({ cls: 'inline-semantic-search-header' })
    const fileName = header.createDiv({ cls: 'inline-semantic-search-filename' })
    fileName.setText(result.file.basename)

    if (result.chunk.headings.length > 0) {
      const headingPath = header.createDiv({
        cls: 'inline-semantic-search-heading-path'
      })
      const headingText = result.chunk.headings
        .map(h => h.replace(/^#+\s*/, ''))
        .join(' › ')
      headingPath.setText(headingText)
    }

    const preview = container.createDiv({ cls: 'inline-semantic-search-preview' })
    const previewText = result.chunk.preview.length > MAX_PREVIEW_LENGTH
      ? result.chunk.preview.substring(0, MAX_PREVIEW_LENGTH) + '...'
      : result.chunk.preview
    preview.setText(previewText)

    const footer = container.createDiv({ cls: 'inline-semantic-search-footer' })
    const similarity = (result.similarity * 100).toFixed(1)
    const meta = footer.createDiv({ cls: 'inline-semantic-search-meta' })
    meta.setText(`${similarity}% • ${result.metadata.folder || '/'}`)

    if (result.metadata.tags.length > 0) {
      const tags = footer.createDiv({ cls: 'inline-semantic-search-tags' })
      tags.setText(result.metadata.tags.slice(0, MAX_TAGS_DISPLAYED).join(' '))
    }
  }

  /**
   * Called when user selects a suggestion
   * Replaces the entire "//query" with "[[note-title]]" link
   */
  selectSuggestion(result: ChunkSearchResult, _evt: MouseEvent | KeyboardEvent): void {
    const { editor } = this.context as any
    if (!editor) {
      Logger.error('[InlineSearch] No editor found in context')
      return
    }

    const { start, end } = this.context as EditorSuggestContext

    const wikiLink = `[[${result.file.basename}]]`

    editor.replaceRange(wikiLink, start, end)

    const cursorPositionAfterLink = {
      line: start.line,
      ch: start.ch + wikiLink.length,
    }
    editor.setCursor(cursorPositionAfterLink)

    Logger.debug(
      `[InlineSearch] Replaced "//..." with link to "${result.file.basename}"`,
    )
  }
}
