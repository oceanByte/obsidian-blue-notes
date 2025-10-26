import * as fs from 'fs'

/**
 * Simple tokenizer for sentence transformers
 */
export class SimpleTokenizer {
  private vocabToId: Map<string, number>
  private clsTokenId: number
  private sepTokenId: number
  private padTokenId: number
  private unkTokenId: number

  constructor(vocabPath: string) {
    const vocab = fs
      .readFileSync(vocabPath, 'utf-8')
      .split('\n')
      .filter(Boolean)
    this.vocabToId = new Map()
    vocab.forEach((token, idx) => {
      this.vocabToId.set(token, idx)
    })

    this.clsTokenId = this.vocabToId.get('[CLS]') || 101
    this.sepTokenId = this.vocabToId.get('[SEP]') || 102
    this.padTokenId = this.vocabToId.get('[PAD]') || 0
    this.unkTokenId = this.vocabToId.get('[UNK]') || 100
  }

  tokenize(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/)
    const tokens = [this.clsTokenId]

    for (const word of words) {
      const tokenId = this.vocabToId.get(word) || this.unkTokenId
      tokens.push(tokenId)
    }

    tokens.push(this.sepTokenId)

    const maxLength = 128
    while (tokens.length < maxLength) {
      tokens.push(this.padTokenId)
    }

    return tokens.slice(0, maxLength)
  }

  createInputs(text: string): {
    input_ids: number[];
    attention_mask: number[];
    token_type_ids: number[];
  } {
    const inputIds = this.tokenize(text)
    const attentionMask = inputIds.map((id) =>
      id !== this.padTokenId ? 1 : 0,
    )
    const tokenTypeIds = new Array(inputIds.length).fill(0)

    return {
      input_ids: inputIds,
      attention_mask: attentionMask,
      token_type_ids: tokenTypeIds,
    }
  }
}
