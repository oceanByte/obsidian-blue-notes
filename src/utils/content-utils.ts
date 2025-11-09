import * as crypto from 'crypto'

export class ContentUtils {
  static computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  static countWords(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length
  }

  static formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${seconds}s`
  }
}
