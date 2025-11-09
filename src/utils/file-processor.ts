import type { App, TFile, Vault } from 'obsidian'

import { ContentUtils } from './content-utils'

/**
 * Extract clean text content from a markdown file
 */
export class FileProcessor {
  private vault: Vault
  private app: App

  constructor(vault: Vault, app?: App) {
    this.vault = vault
    this.app = app!
  }

  /**
   * Get all markdown files in a specific folder
   */
  async getFilesInFolder(folderPath: string): Promise<TFile[]> {
    const files = this.vault.getMarkdownFiles()
    return files.filter((file) => file.path.startsWith(folderPath))
  }

  /**
   * Extract text content from a file
   */
  async extractText(file: TFile): Promise<string> {
    const content = await this.vault.cachedRead(file)
    return this.cleanMarkdown(content)
  }

  /**
   * Extract metadata from a file
   */
  async extractMetadata(file: TFile): Promise<{
    wordCount: number;
    tags: string[];
    folder: string;
  }> {
    const content = await this.vault.cachedRead(file)

    const cache = this.app?.metadataCache?.getFileCache(file)

    const cleanText = this.cleanMarkdown(content)
    const wordCount = ContentUtils.countWords(cleanText)

    const tags: string[] = []
    if (cache?.tags) {
      tags.push(...cache.tags.map((t: { tag: string }) => t.tag))
    }
    if (cache?.frontmatter?.tags) {
      const frontmatterTags = cache.frontmatter.tags
      if (Array.isArray(frontmatterTags)) {
        tags.push(...frontmatterTags.map((t: string) => `#${t}`))
      }
    }

    const folder = file.parent?.path || ''

    return {
      wordCount,
      tags: [...new Set(tags)],
      folder,
    }
  }

  /**
   * Clean markdown content for embedding
   */
  private cleanMarkdown(content: string): string {
    let cleaned = content

    cleaned = cleaned.replace(/^---\n[\s\S]*?\n---\n/, '')

    cleaned = cleaned.replace(/```[\s\S]*?```/g, '')

    cleaned = cleaned.replace(/`[^`]+`/g, '')

    cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')

    cleaned = cleaned.replace(/[*_~#]/g, '')

    cleaned = cleaned.replace(/\s+/g, ' ').trim()

    return cleaned
  }
}
