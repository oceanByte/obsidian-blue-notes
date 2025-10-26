export class TokenEstimator {
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  static estimateMessagesTokens(messages: { role: string; content: string }[]): number {
    let total = 0

    for (const message of messages) {
      total += this.estimateTokens(message.content)
      total += 4
    }

    return total
  }

  static truncateToTokenLimit(text: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(text)

    if (estimatedTokens <= maxTokens) {
      return text
    }

    const maxChars = maxTokens * 4
    return text.slice(0, maxChars) + '\n\n[Content truncated due to length...]'
  }

  static truncateTextsToFit(
    texts: string[],
    maxTotalTokens: number,
  ): string[] {
    const results: string[] = []
    let remainingTokens = maxTotalTokens

    for (const text of texts) {
      const tokens = this.estimateTokens(text)

      if (tokens <= remainingTokens) {
        results.push(text)
        remainingTokens -= tokens
      } else if (remainingTokens > 100) {
        results.push(this.truncateToTokenLimit(text, remainingTokens))
        break
      } else {
        break
      }
    }

    return results
  }
}
