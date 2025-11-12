import { TFile } from 'obsidian'

import type { Chunk } from '../chunking/types'
import { cosineSimilarity } from '../utils/vector-math'
import { EmbeddingCache } from '../embeddings/cache'
import { EmbeddingContext } from '../embeddings/provider-interface'
import { Logger } from '../utils/logger'

import type SemanticNotesPlugin from '../main'


export interface ChunkSearchResult {
  file: TFile;
  chunk: Chunk;
  chunkId: string;
  similarity: number;
  path: string;
  metadata: {
    wordCount: number;
    tags: string[];
    folder: string;
  };
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  folder?: string;
  tags?: string[];
}

export class SemanticSearch {
  private plugin: SemanticNotesPlugin
  private cache: EmbeddingCache

  constructor(plugin: SemanticNotesPlugin, cache: EmbeddingCache) {
    this.plugin = plugin
    this.cache = cache
  }

  /**
   * Search for similar chunks based on query text
   */
  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<ChunkSearchResult[]> {
    const {
      limit = 10,
      threshold = 0.5,
      folder = undefined,
      tags = undefined,
    } = options

    const normalizedQuery = query.trim()

    Logger.debug(
      `[Search] Query: "${normalizedQuery}", threshold: ${threshold}, limit: ${limit}`,
    )

    const provider = this.plugin.providerManager.getProvider()
    if (!provider) {
      throw new Error('No embedding provider available')
    }

    Logger.debug('[Search] Generating query embedding...')
    const queryEmbedding = await provider.embed(normalizedQuery, EmbeddingContext.QUERY)
    Logger.debug(
      `[Search] Query embedding dimension: ${queryEmbedding.length}`,
    )

    const allChunks = this.cache.getAllChunksFlattened()
    Logger.debug(`[Search] Cached chunks: ${allChunks.length}`)

    if (allChunks.length === 0) {
      Logger.warn(
        "[Search] No cached chunks found! Run 'Process entire vault' first.",
      )
      return []
    }

    const results: ChunkSearchResult[] = []
    let checkedCount = 0
    let belowThreshold = 0
    const allSimilarities: { path: string; chunkId: string; similarity: number }[] = []

    for (const item of allChunks) {
      checkedCount++

      if (folder && !item.filePath.startsWith(folder)) {
        continue
      }

      if (tags && tags.length > 0) {
        const hasTag = tags.some((tag) => item.metadata.tags.includes(tag))
        if (!hasTag) {
          continue
        }
      }

      const similarity = cosineSimilarity(queryEmbedding, item.vector)
      allSimilarities.push({
        path: item.filePath,
        chunkId: item.chunkId,
        similarity,
      })

      if (similarity < threshold) {
        belowThreshold++
        continue
      }

      Logger.debug(
        `[Search] Match: ${item.filePath} › ${item.chunkId} (${(similarity * 100).toFixed(1)}%)`,
      )

      const file = this.plugin.app.vault.getAbstractFileByPath(item.filePath)
      if (file instanceof TFile) {
        results.push({
          file,
          chunk: item.chunk,
          chunkId: item.chunkId,
          similarity,
          path: item.filePath,
          metadata: item.metadata,
        })
      }
    }

    results.sort((a, b) => b.similarity - a.similarity)

    allSimilarities.sort((a, b) => b.similarity - a.similarity)
    Logger.debug('[Search] Top similarity scores:')
    allSimilarities.slice(0, 20).forEach(({ path, chunkId, similarity }) => {
      const basename = path.split('/').pop()?.replace('.md', '') || path
      Logger.debug(`  ${basename} › ${chunkId}: ${(similarity * 100).toFixed(2)}%`)
    })

    Logger.debug(
      `[Search] Results: ${results.length} (checked: ${checkedCount}, below threshold: ${belowThreshold})`,
    )

    if (results.length === 0 && checkedCount > 0) {
      Logger.warn(
        `[Search] No results above threshold ${threshold}. Try lowering the threshold or processing more notes.`,
      )
    }

    return results.slice(0, limit)
  }

  /**
   * Find similar chunks to a given file
   */
  async findSimilar(
    file: TFile,
    options: SearchOptions = {},
  ): Promise<ChunkSearchResult[]> {
    const { limit = 10, threshold = 0.3 } = options

    const content = await this.plugin.fileProcessor.extractText(file)
    const contentHash = EmbeddingCache.computeHash(content)
    let fileChunks = this.cache.get(file.path, contentHash)

    if (!fileChunks || fileChunks.length === 0) {
      Logger.debug(
        `[Search] File "${file.path}" not in cache, processing now...`,
      )
      try {
        await this.plugin.processor.processFile(file, true)
        await this.cache.save()
        fileChunks = this.cache.get(file.path, contentHash)

        if (!fileChunks || fileChunks.length === 0) {
          throw new Error(
            'Failed to generate embeddings. The provider may not be initialized.',
          )
        }
      } catch (error) {
        Logger.error(`[Search] Failed to process file "${file.path}":`, error)
        throw error
      }
    }

    const queryEmbedding = fileChunks[0].vector

    const allChunks = this.cache.getAllChunksFlattened()

    const results: ChunkSearchResult[] = []

    for (const item of allChunks) {
      if (item.filePath === file.path) {
        continue
      }

      const similarity = cosineSimilarity(queryEmbedding, item.vector)

      if (similarity < threshold) {
        continue
      }

      const otherFile = this.plugin.app.vault.getAbstractFileByPath(item.filePath)
      if (otherFile instanceof TFile) {
        results.push({
          file: otherFile,
          chunk: item.chunk,
          chunkId: item.chunkId,
          similarity,
          path: item.filePath,
          metadata: item.metadata,
        })
      }
    }

    results.sort((a, b) => b.similarity - a.similarity)
    return results.slice(0, limit)
  }

  /**
   * Get statistics about the search index
   */
  getIndexStats(): {
    totalNotes: number;
    cachedNotes: number;
    totalChunks: number;
    cacheSize: number;
    } {
    const stats = this.cache.getStats()
    const totalNotes = this.plugin.app.vault.getMarkdownFiles().length

    return {
      totalNotes,
      cachedNotes: stats.count,
      totalChunks: stats.chunkCount,
      cacheSize: stats.size,
    }
  }
}
