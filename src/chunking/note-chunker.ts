/**
 * Main chunking logic for splitting notes into semantic chunks
 */

import {
  buildHeadingHierarchy,
  buildSectionTree,
  countWords,
  createPreview,
  parseHeadings,
  splitIntoParagraphs,
  splitIntoSentences,
} from './markdown-parser'
import {
  Chunk,
  ChunkingOptions,
  DEFAULT_CHUNKING_OPTIONS,
  Heading,
  Section,
} from './types'
import { Logger } from '../utils/logger'

export class NoteChunker {
  private options: ChunkingOptions

  constructor(options: Partial<ChunkingOptions> = {}) {
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options }
  }

  /**
   * Main entry point - chunk a note's content
   */
  chunk(content: string): Chunk[] {
    const lines = content.split('\n')
    const wordCount = countWords(content)

    Logger.debug(`[Chunker] Processing note: ${wordCount} words, ${lines.length} lines`)

    if (wordCount < this.options.minWords) {
      Logger.debug('[Chunker] Note below minimum words, using single chunk')
      return this.createSingleChunk(content, lines)
    }

    if (this.options.splitAtHeadings) {
      const headings = parseHeadings(content)

      if (headings.length > 0) {
        Logger.debug(`[Chunker] Found ${headings.length} headings, using heading-based chunking`)
        return this.chunkByHeadings(lines, headings)
      }
    }

    const paragraphs = splitIntoParagraphs(content)

    if (paragraphs.length >= 3) {
      Logger.debug(`[Chunker] Found ${paragraphs.length} paragraphs, using paragraph-based chunking`)
      return this.chunkByParagraphs(content, paragraphs)
    }

    const sentences = splitIntoSentences(content)

    if (sentences.length >= 3) {
      Logger.debug(`[Chunker] Found ${sentences.length} sentences, using sentence-based chunking`)
      return this.chunkBySentences(content, sentences)
    }

    Logger.debug('[Chunker] No clear structure, using single chunk')
    return this.createSingleChunk(content, lines)
  }

  /**
   * Create a single chunk from entire content
   */
  private createSingleChunk(content: string, lines: string[]): Chunk[] {
    return [
      {
        chunkId: 'chunk-0',
        content: content.trim(),
        headings: [],
        startLine: 0,
        endLine: lines.length - 1,
        wordCount: countWords(content),
        preview: createPreview(content),
      },
    ]
  }

  /**
   * Chunk by heading structure
   */
  private chunkByHeadings(lines: string[], headings: Heading[]): Chunk[] {
    const sections = buildSectionTree(lines, headings, this.options.maxHeadingLevel)
    const chunks: Chunk[] = []

    for (const section of sections) {
      const sectionChunks = this.processSectionRecursive(section, headings, lines)
      chunks.push(...sectionChunks)
    }

    return this.validateAndAdjustChunks(chunks)
  }

  /**
   * Recursively process sections and their subsections
   */
  private processSectionRecursive(
    section: Section,
    allHeadings: Heading[],
    allLines: string[],
    chunkCounter: { value: number } = { value: 0 },
  ): Chunk[] {
    const chunks: Chunk[] = []

    const sectionContent = section.contentLines.join('\n').trim()
    const sectionWords = countWords(sectionContent)

    const headingHierarchy = section.heading
      ? buildHeadingHierarchy(allHeadings, section.heading)
      : []

    if (section.subsections.length > 0) {
      if (sectionWords > 0) {
        if (sectionWords > this.options.maxWords) {
          const subChunks = this.splitLargeSection(section, headingHierarchy)
          chunks.push(...subChunks)
        } else {
          const chunkId = section.heading
            ? this.createChunkId(section.heading.text)
            : `chunk-${chunkCounter.value++}`

          chunks.push({
            chunkId,
            content: sectionContent,
            headings: headingHierarchy,
            startLine: section.startLine,
            endLine: section.endLine,
            wordCount: sectionWords,
            preview: createPreview(sectionContent),
          })
        }
      }

      for (const subsection of section.subsections) {
        const subChunks = this.processSectionRecursive(subsection, allHeadings, allLines, chunkCounter)
        chunks.push(...subChunks)
      }
    } else {
      if (sectionWords === 0) {
        return chunks
      }

      if (sectionWords > this.options.maxWords) {
        Logger.debug(
          `[Chunker] Section "${section.heading?.text || 'untitled'}" too large (${sectionWords} words), splitting`,
        )
        const subChunks = this.splitLargeSection(section, headingHierarchy)
        chunks.push(...subChunks)
      } else {
        const chunkId = section.heading
          ? this.createChunkId(section.heading.text)
          : `chunk-${chunkCounter.value++}`

        chunks.push({
          chunkId,
          content: sectionContent,
          headings: headingHierarchy,
          startLine: section.startLine,
          endLine: section.endLine,
          wordCount: sectionWords,
          preview: createPreview(sectionContent),
        })
      }
    }

    return chunks
  }

  /**
   * Split a large section into smaller chunks
   */
  private splitLargeSection(section: Section, headingHierarchy: string[]): Chunk[] {
    const content = section.contentLines.join('\n')
    const paragraphs = splitIntoParagraphs(content)

    if (paragraphs.length > 1) {
      return this.chunkByParagraphs(content, paragraphs, headingHierarchy, section.startLine)
    } else {
      const sentences = splitIntoSentences(content)
      return this.chunkBySentences(content, sentences, headingHierarchy, section.startLine)
    }
  }

  /**
   * Chunk by grouping paragraphs
   */
  private chunkByParagraphs(
    _content: string,
    paragraphs: string[],
    headings: string[] = [],
    _startLineOffset: number = 0,
  ): Chunk[] {
    const chunks: Chunk[] = []
    let currentChunk: string[] = []
    let currentWords = 0

    for (const paragraph of paragraphs) {
      const paragraphWords = countWords(paragraph)

      if (currentWords + paragraphWords > this.options.maxWords && currentChunk.length > 0) {
        chunks.push(this.createChunkFromParts(currentChunk, headings, chunks.length))
        currentChunk = []
        currentWords = 0
      }

      currentChunk.push(paragraph)
      currentWords += paragraphWords
    }

    if (currentChunk.length > 0) {
      chunks.push(this.createChunkFromParts(currentChunk, headings, chunks.length))
    }

    return chunks
  }

  /**
   * Chunk by grouping sentences with overlap
   */
  private chunkBySentences(
    _content: string,
    sentences: string[],
    headings: string[] = [],
    _startLineOffset: number = 0,
  ): Chunk[] {
    const chunks: Chunk[] = []
    const overlapWords = 50

    let currentChunk: string[] = []
    let currentWords = 0
    let previousChunkEnd: string[] = []

    for (const sentence of sentences) {
      const sentenceWords = countWords(sentence)

      if (currentWords + sentenceWords > this.options.maxWords && currentChunk.length > 0) {
        chunks.push(this.createChunkFromParts(currentChunk, headings, chunks.length))

        previousChunkEnd = this.getLastNWords(currentChunk, overlapWords)
        currentChunk = [...previousChunkEnd]
        currentWords = countWords(currentChunk.join(' '))
      }

      currentChunk.push(sentence)
      currentWords += sentenceWords
    }

    if (currentChunk.length > previousChunkEnd.length) {
      chunks.push(this.createChunkFromParts(currentChunk, headings, chunks.length))
    }

    return chunks
  }

  /**
   * Get last N words from text parts
   */
  private getLastNWords(parts: string[], n: number): string[] {
    const allText = parts.join(' ')
    const words = allText.split(/\s+/)

    if (words.length <= n) {
      return parts
    }

    const lastWords = words.slice(-n).join(' ')
    return [lastWords]
  }

  /**
   * Create a chunk from text parts
   */
  private createChunkFromParts(
    parts: string[],
    headings: string[],
    chunkIndex: number,
  ): Chunk {
    const content = parts.join('\n\n').trim()

    return {
      chunkId: `chunk-${chunkIndex}`,
      content,
      headings,
      startLine: 0,
      endLine: 0,
      wordCount: countWords(content),
      preview: createPreview(content),
    }
  }

  /**
   * Create a URL-safe chunk ID from heading text
   */
  private createChunkId(headingText: string): string {
    return headingText
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50)
  }

  /**
   * Validate and adjust chunk sizes
   */
  private validateAndAdjustChunks(chunks: Chunk[]): Chunk[] {
    Logger.debug(`[Chunker] Created ${chunks.length} chunks`)

    for (let i = 0; i < chunks.length; i++) {
      Logger.debug(`  Chunk ${i}: ${chunks[i].wordCount} words, "${chunks[i].preview}"`)
    }

    return chunks
  }
}
