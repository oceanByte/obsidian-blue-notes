import { Notice, type TFile } from 'obsidian'

import { type ChunkEmbedding, EmbeddingCache } from './cache'
import { BatchProcessor } from './batch-processor'
import { ContentUtils } from '../utils/content-utils'
import { FileProcessor } from '../utils/file-processor'
import { Logger } from '../utils/logger'
import { MESSAGES } from '../constants/messages'
import { NoteChunker } from '../chunking/note-chunker'
import { ProcessingQueue } from './processing-queue'
import { ProcessingStats } from './processing-stats'

import type SemanticNotesPlugin from '../main'

export class EmbeddingProcessor {
  private plugin: SemanticNotesPlugin
  private cache: EmbeddingCache
  private fileProcessor: FileProcessor
  private chunker: NoteChunker
  private stats: ProcessingStats
  private batchProcessor: BatchProcessor
  private queue: ProcessingQueue

  constructor(plugin: SemanticNotesPlugin, cache: EmbeddingCache) {
    this.plugin = plugin
    this.cache = cache
    this.fileProcessor = new FileProcessor(plugin.app.vault, plugin.app)
    this.chunker = new NoteChunker()
    this.stats = new ProcessingStats()
    this.batchProcessor = new BatchProcessor({
      batchSize: plugin.settings.processing.batchSize,
      adaptiveBatching: plugin.settings.processing.adaptiveBatching,
    })
    this.queue = new ProcessingQueue()
  }

  /**
   * Process all markdown files in the vault
   */
  async processVault(showProgress = true): Promise<void> {
    if (this.queue.isCurrentlyProcessing()) {
      new Notice(MESSAGES.ALREADY_PROCESSING_VAULT)
      return
    }

    const provider = this.plugin.providerManager.getProvider()
    if (!provider) {
      new Notice(MESSAGES.NO_EMBEDDING_PROVIDER)
      return
    }

    try {
      this.queue.setProcessing(true)
      const allFiles = this.plugin.app.vault.getMarkdownFiles()

      const files = await this.filterFilesByWordCount(allFiles)

      if (showProgress) {
        new Notice(
          MESSAGES.PROCESSING_FILES(
            files.length,
            allFiles.length - files.length,
          ),
        )
      }

      let processed = 0
      let cached = 0
      let failed = 0
      const startTime = Date.now()

      const avgTime = this.stats.hasEnoughSamples()
        ? this.stats.getAverageProcessingTime()
        : undefined
      const batches = this.batchProcessor.createBatches(files, avgTime)

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const batchStartTime = Date.now()

        for (const file of batch) {
          try {
            const wasProcessed = await this.processFile(file)
            if (wasProcessed) {
              processed++
            } else {
              cached++
            }
          } catch (error) {
            Logger.error(`Failed to process ${file.path}:`, error)
            failed++
          }
        }

        await this.cache.save()

        const batchTime = Date.now() - batchStartTime
        const totalProcessed = processed + cached

        if (showProgress && (i % 5 === 0 || i === batches.length - 1)) {
          const eta = this.batchProcessor.estimateTimeRemaining(
            startTime,
            totalProcessed,
            files.length,
          )
          new Notice(
            `Progress: ${totalProcessed}/${files.length} • ${processed} new, ${cached} cached • ETA: ${eta}`,
          )
        }

        Logger.debug(
          `Batch ${i + 1}/${batches.length}: ${batch.length} files in ${batchTime}ms`,
        )
      }

      await this.cache.save()

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
      const stats = this.cache.getStats()
      const message = `✓ Vault processed in ${totalTime}s: ${processed} new, ${cached} cached, ${allFiles.length - files.length} skipped, ${failed} failed (${stats.chunkCount} total chunks)`
      new Notice(message)
      Logger.info(message)
    } finally {
      this.queue.setProcessing(false)
    }
  }

  /**
   * Pre-filter files by minimum word count to avoid processing overhead
   */
  private async filterFilesByWordCount(files: TFile[]): Promise<TFile[]> {
    const minWordCount = this.plugin.settings.processing.minWordCount
    if (minWordCount <= 0) {
      return files
    }

    const filtered: TFile[] = []
    for (const file of files) {
      try {
        const content = await this.fileProcessor.extractText(file)
        const wordCount = ContentUtils.countWords(content)

        if (wordCount >= minWordCount) {
          filtered.push(file)
        }
      } catch {
        filtered.push(file)
      }
    }

    return filtered
  }

  /**
   * Process a single file with chunking
   * @returns true if embedding was generated, false if cached/skipped
   */
  async processFile(file: TFile, skipMinWordCheck = false): Promise<boolean> {
    const provider = this.plugin.providerManager.getProvider()
    if (!provider) {
      throw new Error('No embedding provider available')
    }

    const content = await this.fileProcessor.extractText(file)
    const contentHash = EmbeddingCache.computeHash(content)

    const cached = this.cache.get(file.path, contentHash)
    if (cached) {
      return false
    }

    const wordCount = ContentUtils.countWords(content)
    const minWordCount = this.plugin.settings.processing.minWordCount

    if (!skipMinWordCheck && wordCount < minWordCount) {
      Logger.debug(
        `Skipping ${file.path}: too short (${wordCount} < ${minWordCount} words)`,
      )
      throw new Error(
        `File has only ${wordCount} words (minimum: ${minWordCount}).`,
      )
    }

    Logger.debug(`[Processor] Chunking file: ${file.path}`)
    const chunks = this.chunker.chunk(content)
    Logger.debug(`[Processor] Created ${chunks.length} chunks for ${file.path}`)

    const startTime = Date.now()
    const chunkEmbeddings: ChunkEmbedding[] = []

    for (const chunk of chunks) {
      const embedding = await provider.embed(chunk.content)
      chunkEmbeddings.push({
        chunkId: chunk.chunkId,
        vector: embedding,
        chunk: chunk,
      })
    }

    const processingTime = Date.now() - startTime

    this.stats.update(processingTime, wordCount)

    const metadata = await this.fileProcessor.extractMetadata(file)

    this.cache.set(file.path, chunkEmbeddings, contentHash, metadata)

    Logger.debug(
      `[Processor] Processed ${file.path}: ${chunks.length} chunks in ${processingTime}ms`,
    )

    return true
  }

  /**
   * Process multiple files in batch
   */
  async processBatch(files: TFile[]): Promise<void> {
    const provider = this.plugin.providerManager.getProvider()
    if (!provider) {
      new Notice(MESSAGES.NO_EMBEDDING_PROVIDER)
      return
    }

    let processed = 0
    let cached = 0

    for (const file of files) {
      try {
        const wasProcessed = await this.processFile(file)
        if (wasProcessed) {
          processed++
        } else {
          cached++
        }
      } catch (error) {
        Logger.error(`Failed to process ${file.path}:`, error)
      }
    }

    await this.cache.save()
    new Notice(MESSAGES.PROCESSING_COMPLETE(processed, cached))
  }

  /**
   * Invalidate cache entry for a file
   */
  invalidate(file: TFile): void {
    this.cache.remove(file.path)
  }

  /**
   * Queue a file for processing
   */
  queueFile(file: TFile): void {
    this.queue.add(file)
    this.processQueue()
  }

  /**
   * Process queued files
   */
  private async processQueue(): Promise<void> {
    if (this.queue.isCurrentlyProcessing() || this.queue.isEmpty()) {
      return
    }

    this.queue.setProcessing(true)
    try {
      const batchSize = this.plugin.settings.processing.batchSize
      const batch = this.queue.remove(batchSize)
      await this.processBatch(batch)
    } finally {
      this.queue.setProcessing(false)
      if (!this.queue.isEmpty()) {
        setTimeout(() => this.processQueue(), 100)
      }
    }
  }

  /**
   * Check if currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.queue.isCurrentlyProcessing()
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.size()
  }

  /**
   * Check all markdown files for modifications and queue them
   */
  checkAndQueueModified(): void {
    const allFiles = this.plugin.app.vault.getMarkdownFiles()
    const modifiedFiles = this.queue.checkForModifications(allFiles)

    for (const file of modifiedFiles) {
      this.queueFile(file)
    }

    if (modifiedFiles.length > 0) {
      Logger.info(
        `Periodic check: found ${modifiedFiles.length} modified files`,
      )
    }
  }
}
