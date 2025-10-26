import { ContextLoader, NoteContext } from './context-strategies'

import { Logger } from '../../utils/logger'
import { TokenEstimator } from '../utils/token-estimator'

import type SemanticNotesPlugin from '../../main'

/**
 * Manages context building for AI chat from manually selected notes
 */
export class ContextManager {
  private contextLoader: ContextLoader

  constructor(plugin: SemanticNotesPlugin) {
    this.contextLoader = new ContextLoader(plugin)
  }

  async buildContextMessage(maxTokens = 4000): Promise<string> {
    try {
      const contexts = await this.contextLoader.getContext()

      if (contexts.length === 0) {
        Logger.debug('No context notes selected')
        return ''
      }

      const contextTexts = contexts.map((ctx) => this.formatNoteContext(ctx))

      const fittedTexts = TokenEstimator.truncateTextsToFit(
        contextTexts,
        maxTokens,
      )

      if (fittedTexts.length === 0) {
        return ''
      }

      const contextMessage = this.buildContextString(fittedTexts)

      Logger.debug(
        `Built context with ${fittedTexts.length} notes, ~${TokenEstimator.estimateTokens(contextMessage)} tokens`,
      )

      return contextMessage
    } catch (error) {
      Logger.error('Error building context:', error)
      return ''
    }
  }

  async getContextNotePaths(): Promise<string[]> {
    try {
      const contexts = await this.contextLoader.getContext()
      return contexts.map((ctx) => ctx.path)
    } catch (error) {
      Logger.error('Error getting context paths:', error)
      return []
    }
  }

  private formatNoteContext(context: NoteContext): string {
    const parts: string[] = []

    parts.push(`## Note: ${context.title}`)

    if (context.path) {
      parts.push(`Path: ${context.path}`)
    }

    if (context.similarity !== undefined) {
      parts.push(`Similarity: ${(context.similarity * 100).toFixed(1)}%`)
    }

    parts.push('')
    parts.push(context.content)
    parts.push('')

    return parts.join('\n')
  }

  private buildContextString(texts: string[]): string {
    const parts: string[] = []

    parts.push('# Context Notes')
    parts.push('')
    parts.push(
      `The following ${texts.length} note${texts.length === 1 ? '' : 's'} from your vault:`,
    )
    parts.push('')

    texts.forEach((text) => {
      parts.push(text)
      parts.push('---')
      parts.push('')
    })

    parts.push(
      'Use the above notes as context to provide accurate and helpful answers. Reference specific notes when relevant.',
    )

    return parts.join('\n')
  }

  setSelectedNotes(paths: string[]): void {
    this.contextLoader.setSelectedPaths(paths)
  }
}
