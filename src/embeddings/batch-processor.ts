import { ContentUtils } from '../utils/content-utils'
import { Logger } from '../utils/logger'

export interface BatchConfig {
  batchSize: number;
  adaptiveBatching: boolean;
  targetBatchTimeMs?: number;
}

export class BatchProcessor {
  private config: BatchConfig

  constructor(config: BatchConfig) {
    this.config = {
      targetBatchTimeMs: 10000,
      ...config,
    }
  }

  createBatches<T>(items: T[], avgProcessingTime?: number): T[][] {
    if (!this.config.adaptiveBatching || !avgProcessingTime) {
      return this.createFixedBatches(items)
    }

    return this.createAdaptiveBatches(items, avgProcessingTime)
  }

  private createFixedBatches<T>(items: T[]): T[][] {
    const batches: T[][] = []
    const batchSize = this.config.batchSize

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    return batches
  }

  private createAdaptiveBatches<T>(
    items: T[],
    avgProcessingTime: number,
  ): T[][] {
    const batches: T[][] = []
    const targetTime = this.config.targetBatchTimeMs!

    const currentBatchSize = Math.max(
      5,
      Math.min(50, Math.floor(targetTime / avgProcessingTime)),
    )

    for (let i = 0; i < items.length; i += currentBatchSize) {
      batches.push(items.slice(i, i + currentBatchSize))
    }

    Logger.debug(
      `Created ${batches.length} adaptive batches (avg size: ${currentBatchSize})`,
    )

    return batches
  }

  estimateTimeRemaining(
    startTime: number,
    processed: number,
    total: number,
  ): string {
    if (processed === 0) return 'calculating...'

    const elapsed = Date.now() - startTime
    const rate = processed / elapsed
    const remaining = (total - processed) / rate
    const seconds = Math.floor(remaining / 1000)

    return ContentUtils.formatTime(seconds)
  }
}
