import * as fs from 'fs'
import * as path from 'path'

import type { Chunk } from '../chunking/types'
import { ContentUtils } from '../utils/content-utils'
import { ensureDirectoryExists } from '../utils/file-utils'
import { Logger } from '../utils/logger'

export interface ChunkEmbedding {
  chunkId: string;
  vector: number[];
  chunk: Chunk;
}

export interface ChunkedEmbeddingEntry {
  /** Hash of entire file content */
  fileHash: string;
  /** Timestamp of when this was cached */
  timestamp: number;
  /** File-level metadata */
  metadata: {
    wordCount: number;
    tags: string[];
    folder: string;
  };
  /** Array of chunk embeddings */
  chunks: ChunkEmbedding[];
}

export interface CacheData {
  version: string;
  model: string;
  created: number;
  embeddings: Record<string, ChunkedEmbeddingEntry>;
}

export class EmbeddingCache {
  private cacheDir: string
  private cacheFilePath: string
  private cache: CacheData
  private isDirty = false

  constructor(pluginDataDir: string) {
    this.cacheDir = path.join(pluginDataDir, 'cache')
    this.cacheFilePath = path.join(this.cacheDir, 'embeddings.json')
    this.cache = this.createEmptyCache()
  }

  /**
   * Initialize cache - load from disk if exists
   */
  async initialize(): Promise<void> {
    ensureDirectoryExists(this.cacheDir)

    if (fs.existsSync(this.cacheFilePath)) {
      try {
        const data = fs.readFileSync(this.cacheFilePath, 'utf-8')
        this.cache = JSON.parse(data)

        const totalChunks = Object.values(this.cache.embeddings).reduce(
          (sum, entry) => sum + entry.chunks.length,
          0,
        )

        Logger.info(
          `Loaded cache with ${Object.keys(this.cache.embeddings).length} files, ${totalChunks} chunks`,
        )
      } catch (error) {
        Logger.error('Failed to load cache:', error)
        this.cache = this.createEmptyCache()
      }
    }
  }

  /**
   * Get cached chunks for a file
   */
  get(filePath: string, contentHash: string): ChunkEmbedding[] | null {
    const entry = this.cache.embeddings[filePath]
    if (!entry) {
      return null
    }

    if (entry.fileHash !== contentHash) {
      return null
    }

    return entry.chunks
  }

  /**
   * Store chunk embeddings for a file
   */
  set(
    filePath: string,
    chunks: ChunkEmbedding[],
    contentHash: string,
    metadata: ChunkedEmbeddingEntry['metadata'],
  ): void {
    this.cache.embeddings[filePath] = {
      fileHash: contentHash,
      timestamp: Date.now(),
      metadata,
      chunks,
    }
    this.isDirty = true
  }

  /**
   * Remove entry from cache
   */
  remove(filePath: string): void {
    if (this.cache.embeddings[filePath]) {
      delete this.cache.embeddings[filePath]
      this.isDirty = true
    }
  }

  /**
   * Get all cached chunk embeddings (flattened)
   */
  getAll(): Record<string, ChunkedEmbeddingEntry> {
    return this.cache.embeddings
  }

  /**
   * Get all cached chunks as a flat array with file path information
   */
  getAllChunksFlattened(): Array<{
    filePath: string;
    chunkId: string;
    vector: number[];
    chunk: Chunk;
    metadata: ChunkedEmbeddingEntry['metadata'];
  }> {
    const result: Array<{
      filePath: string;
      chunkId: string;
      vector: number[];
      chunk: Chunk;
      metadata: ChunkedEmbeddingEntry['metadata'];
    }> = []

    for (const [filePath, entry] of Object.entries(this.cache.embeddings)) {
      for (const chunkEmbedding of entry.chunks) {
        result.push({
          filePath,
          chunkId: chunkEmbedding.chunkId,
          vector: chunkEmbedding.vector,
          chunk: chunkEmbedding.chunk,
          metadata: entry.metadata,
        })
      }
    }

    return result
  }

  /**
   * Get all file paths with cached embeddings
   */
  getFilePaths(): string[] {
    return Object.keys(this.cache.embeddings)
  }

  /**
   * Check if file has valid cached embedding
   */
  has(filePath: string, contentHash: string): boolean {
    const entry = this.cache.embeddings[filePath]
    return entry !== undefined && entry.fileHash === contentHash
  }

  /**
   * Compute content hash for a file
   */
  static computeHash(content: string): string {
    return ContentUtils.computeHash(content)
  }

  /**
   * Save cache to disk
   */
  async save(): Promise<void> {
    if (!this.isDirty) {
      return
    }

    try {
      const data = JSON.stringify(this.cache, null, 2)
      fs.writeFileSync(this.cacheFilePath, data, 'utf-8')
      this.isDirty = false

      const totalChunks = Object.values(this.cache.embeddings).reduce(
        (sum, entry) => sum + entry.chunks.length,
        0,
      )

      Logger.debug(
        `Saved cache with ${Object.keys(this.cache.embeddings).length} files, ${totalChunks} chunks`,
      )
    } catch (error) {
      Logger.error('Failed to save cache:', error)
      throw error
    }
  }

  /**
   * Clear all cached embeddings
   */
  clear(): void {
    this.cache.embeddings = {}
    this.isDirty = true
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    count: number;
    chunkCount: number;
    size: number;
    oldestTimestamp: number;
    newestTimestamp: number;
    } {
    const entries = Object.values(this.cache.embeddings)
    const count = entries.length
    const chunkCount = entries.reduce((sum, entry) => sum + entry.chunks.length, 0)
    const size = JSON.stringify(this.cache).length
    const timestamps = entries.map((e) => e.timestamp)

    return {
      count,
      chunkCount,
      size,
      oldestTimestamp: Math.min(...timestamps, Date.now()),
      newestTimestamp: Math.max(...timestamps, 0),
    }
  }

  private createEmptyCache(): CacheData {
    return {
      version: '1.0.0',
      model: 'multilingual-e5-small',
      created: Date.now(),
      embeddings: {},
    }
  }
}
