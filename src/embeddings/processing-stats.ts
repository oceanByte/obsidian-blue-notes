export class ProcessingStats {
  private avgProcessingTime = 0
  private avgWordCount = 0
  private samplesCount = 0
  private readonly alpha: number = 0.2

  update(processingTime: number, wordCount: number): void {
    if (this.samplesCount === 0) {
      this.avgProcessingTime = processingTime
      this.avgWordCount = wordCount
    } else {
      this.avgProcessingTime =
        this.alpha * processingTime +
				(1 - this.alpha) * this.avgProcessingTime
      this.avgWordCount =
        this.alpha * wordCount + (1 - this.alpha) * this.avgWordCount
    }
    this.samplesCount++
  }

  getAverageProcessingTime(): number {
    return this.avgProcessingTime
  }

  getAverageWordCount(): number {
    return this.avgWordCount
  }

  getSampleCount(): number {
    return this.samplesCount
  }

  hasEnoughSamples(minSamples = 5): boolean {
    return this.samplesCount >= minSamples
  }

  reset(): void {
    this.avgProcessingTime = 0
    this.avgWordCount = 0
    this.samplesCount = 0
  }
}
