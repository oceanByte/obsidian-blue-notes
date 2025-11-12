import * as fs from 'fs'
import * as path from 'path'
import { Tokenizer } from '@huggingface/tokenizers'

interface TokenizerInputs {
  input_ids: number[];
  attention_mask: number[];
  token_type_ids: number[];
}

const TOKENIZER_FILE = 'tokenizer.json'
const CONFIG_FILES = ['tokenizer_config.json', 'config.json']

/**
 * Tokenizer wrapper backed by @huggingface/tokenizers.
 * Provides padding/truncation configuration compatible with transformer models (e.g., E5).
 */
export class HuggingFaceTokenizer {
  private tokenizer: any
  private maxLength: number
  private padTokenId: number

  private constructor(tokenizer: any, maxLength: number = 512) {
    this.tokenizer = tokenizer
    this.maxLength = maxLength
    this.padTokenId = this.tokenizer.token_to_id('[PAD]') ?? 0
  }

  static async fromPretrained(modelDir: string): Promise<HuggingFaceTokenizer> {
    const tokenizerPath = path.join(modelDir, TOKENIZER_FILE)

    if (!fs.existsSync(tokenizerPath)) {
      throw new Error(`Tokenizer file not found at ${tokenizerPath}`)
    }

    const tokenizerJson = JSON.parse(fs.readFileSync(tokenizerPath, 'utf-8'))
    const tokenizerConfig = HuggingFaceTokenizer.loadConfig(modelDir)

    const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig)
    return new HuggingFaceTokenizer(tokenizer)
  }

  private static loadConfig(modelDir: string): Record<string, unknown> {
    for (const configFile of CONFIG_FILES) {
      const candidate = path.join(modelDir, configFile)
      if (fs.existsSync(candidate)) {
        return JSON.parse(fs.readFileSync(candidate, 'utf-8'))
      }
    }
    return {}
  }

  private padArray(values: number[], padValue: number): number[] {
    if (values.length > this.maxLength) {
      return values.slice(0, this.maxLength)
    }

    if (values.length < this.maxLength) {
      return values.concat(new Array(this.maxLength - values.length).fill(padValue))
    }

    return values
  }

  async createInputs(text: string): Promise<TokenizerInputs> {
    const encoding = this.tokenizer.encode(text, {
      add_special_tokens: true,
      return_token_type_ids: true,
    })

    const inputIds = this.padArray([...encoding.ids], this.padTokenId)
    const attentionMask = this.padArray([...encoding.attention_mask], 0)
    const tokenTypeIdsSource = encoding.token_type_ids ?? new Array(encoding.ids.length).fill(0)
    const tokenTypeIds = this.padArray([...tokenTypeIdsSource], 0)

    return {
      input_ids: inputIds,
      attention_mask: attentionMask,
      token_type_ids: tokenTypeIds,
    }
  }
}
