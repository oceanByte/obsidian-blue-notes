import { Logger } from '../../utils/logger'
import { TFile } from 'obsidian'

import type SemanticNotesPlugin from '../../main'

export interface NoteContext {
  path: string;
  title: string;
  content: string;
  similarity?: number;
}

/**
 * Manages loading context from manually selected notes
 */
export class ContextLoader {
  private selectedPaths: string[] = []

  constructor(private plugin: SemanticNotesPlugin) {}

  setSelectedPaths(paths: string[]): void {
    this.selectedPaths = paths
  }

  async getContext(): Promise<NoteContext[]> {
    const contexts: NoteContext[] = []

    for (const path of this.selectedPaths) {
      const file = this.plugin.app.vault.getAbstractFileByPath(path)

      if (file instanceof TFile && file.extension === 'md') {
        try {
          const content = await this.plugin.fileProcessor.extractText(file)

          contexts.push({
            path: file.path,
            title: file.basename,
            content,
          })
        } catch (error) {
          Logger.error(`Error reading file ${path}:`, error)
        }
      }
    }

    Logger.debug(`Loaded ${contexts.length} selected notes for context`)
    return contexts
  }
}
