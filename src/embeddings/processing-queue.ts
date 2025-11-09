import type { TFile } from 'obsidian'

import { Logger } from '../utils/logger'



export class ProcessingQueue {
  private queue: TFile[] = []
  private lastCheckedModTimes = new Map<string, number>()
  private isProcessing = false

  add(file: TFile): void {
    if (!this.queue.includes(file)) {
      this.queue.push(file)
    }
  }

  remove(count: number): TFile[] {
    return this.queue.splice(0, count)
  }

  size(): number {
    return this.queue.length
  }

  isEmpty(): boolean {
    return this.queue.length === 0
  }

  clear(): void {
    this.queue = []
  }

  setProcessing(processing: boolean): void {
    this.isProcessing = processing
  }

  isCurrentlyProcessing(): boolean {
    return this.isProcessing
  }

  checkForModifications(allFiles: TFile[]): TFile[] {
    const modifiedFiles: TFile[] = []

    for (const file of allFiles) {
      const currentModTime = file.stat.mtime
      const lastChecked = this.lastCheckedModTimes.get(file.path)

      if (!lastChecked || currentModTime > lastChecked) {
        this.lastCheckedModTimes.set(file.path, currentModTime)

        if (lastChecked) {
          modifiedFiles.push(file)
        }
      }
    }

    if (modifiedFiles.length > 0) {
      Logger.info(`Found ${modifiedFiles.length} modified files`)
    }

    return modifiedFiles
  }
}
