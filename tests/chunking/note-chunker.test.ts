import { describe, it, expect } from 'vitest'
import { NoteChunker } from '../../src/chunking/note-chunker'

describe('NoteChunker', () => {
  describe('heading-based chunking', () => {
    it('should split by headings', () => {
      const chunker = new NoteChunker({ minWords: 0 })
      const content = `# Introduction
This is the intro section with some content.

## Background
This section has background information that explains context.

## Implementation
Here we describe the implementation details.`

      const chunks = chunker.chunk(content)

      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.some(c => c.headings.length > 0)).toBe(true)
    })

    it('should handle nested headings', () => {
      const chunker = new NoteChunker({ minWords: 0 })
      const content = `# Main Topic
Introduction text.

## Subsection A
Some content here.

### Detail 1
More details.

### Detail 2
Even more details.

## Subsection B
Different content.`

      const chunks = chunker.chunk(content)

      expect(chunks.length).toBeGreaterThan(0)
      const hasHierarchy = chunks.some(c => c.headings.length > 1)
      expect(hasHierarchy).toBe(true)
    })
  })

  describe('paragraph-based chunking', () => {
    it('should chunk by paragraphs when no headings', () => {
      const chunker = new NoteChunker({ maxWords: 50, minWords: 0 })
      const content = `This is the first paragraph with enough content to make it meaningful.

This is the second paragraph that also has substantial content in it.

This is the third paragraph which continues the pattern.

And a fourth paragraph to ensure we have enough content for multiple chunks.

Finally a fifth paragraph to round things out nicely.`

      const chunks = chunker.chunk(content)

      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.every(c => c.wordCount <= 50 + 20)).toBe(true)
    })
  })

  describe('sentence-based chunking', () => {
    it('should chunk by sentences for dense text', () => {
      const chunker = new NoteChunker({ maxWords: 30, minWords: 0 })
      const content = 'This is sentence one. This is sentence two. This is sentence three. This is sentence four. This is sentence five. This is sentence six. This is sentence seven. This is sentence eight.'

      const chunks = chunker.chunk(content)

      expect(chunks.length).toBeGreaterThan(1)
    })
  })

  describe('single chunk for short notes', () => {
    it('should not chunk notes below minimum', () => {
      const chunker = new NoteChunker({ minWords: 100 })
      const content = 'This is a short note with very little content.'

      const chunks = chunker.chunk(content)

      expect(chunks.length).toBe(1)
      expect(chunks[0].chunkId).toBe('chunk-0')
    })
  })

  describe('size constraints', () => {
    it('should respect maxWords limit', () => {
      const chunker = new NoteChunker({ maxWords: 100, minWords: 0 })
      const sentences = Array(50).fill('This is a sentence with ten words in it here now.').join(' ')
      const content = `# Section\n${sentences}`

      const chunks = chunker.chunk(content)

      expect(chunks.length).toBeGreaterThan(1)
      chunks.forEach(chunk => {
        expect(chunk.wordCount).toBeLessThan(150)
      })
    })
  })

  describe('chunk metadata', () => {
    it('should generate correct chunk metadata', () => {
      const chunker = new NoteChunker()
      const content = `# Test
This is test content.`

      const chunks = chunker.chunk(content)

      expect(chunks.length).toBeGreaterThan(0)
      const chunk = chunks[0]

      expect(chunk).toHaveProperty('chunkId')
      expect(chunk).toHaveProperty('content')
      expect(chunk).toHaveProperty('headings')
      expect(chunk).toHaveProperty('startLine')
      expect(chunk).toHaveProperty('endLine')
      expect(chunk).toHaveProperty('wordCount')
      expect(chunk).toHaveProperty('preview')

      expect(chunk.wordCount).toBeGreaterThan(0)
      expect(chunk.preview.length).toBeGreaterThan(0)
    })

    it('should create readable chunk IDs from headings', () => {
      const chunker = new NoteChunker({ minWords: 0 })
      const content = `# Introduction Section
Content here.`

      const chunks = chunker.chunk(content)

      const headingChunk = chunks.find(c => c.headings.length > 0)
      expect(headingChunk).toBeDefined()
      if (headingChunk) {
        expect(headingChunk.chunkId).toMatch(/introduction/)
      }
    })
  })

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const chunker = new NoteChunker()
      const content = ''

      const chunks = chunker.chunk(content)

      expect(chunks.length).toBe(1)
      expect(chunks[0].wordCount).toBe(0)
    })

    it('should handle content with only whitespace', () => {
      const chunker = new NoteChunker()
      const content = '   \n\n   \n'

      const chunks = chunker.chunk(content)

      expect(chunks.length).toBe(1)
    })

    it('should handle mixed heading levels', () => {
      const chunker = new NoteChunker({ maxHeadingLevel: 2 })
      const content = `# H1
Content.

#### H4
This should be part of H1 chunk.

## H2
New chunk.`

      const chunks = chunker.chunk(content)

      expect(chunks.length).toBeGreaterThan(0)
    })
  })
})
