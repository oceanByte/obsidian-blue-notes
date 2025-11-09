/**
 * Utilities for parsing markdown structure
 */

import { Heading, Section } from './types'

/**
 * Parse all headings from markdown content
 */
export function parseHeadings(content: string): Heading[] {
  const lines = content.split('\n')
  const headings: Heading[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^(#{1,6})\s+(.+)$/)

    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i,
        raw: line,
      })
    }
  }

  return headings
}

/**
 * Build flat section list from headings (simplified approach)
 * Each section is the content between one heading and the next
 */
export function buildSectionTree(
  lines: string[],
  headings: Heading[],
  maxHeadingLevel: number,
): Section[] {
  if (headings.length === 0) {
    return [
      {
        heading: null,
        contentLines: lines,
        startLine: 0,
        endLine: lines.length - 1,
        subsections: [],
      },
    ]
  }

  const filteredHeadings = headings.filter((h) => h.level <= maxHeadingLevel)

  const sections: Section[] = []

  if (filteredHeadings.length > 0 && filteredHeadings[0].line > 0) {
    const preamble: Section = {
      heading: null,
      contentLines: lines.slice(0, filteredHeadings[0].line),
      startLine: 0,
      endLine: filteredHeadings[0].line - 1,
      subsections: [],
    }
    sections.push(preamble)
  }

  for (let i = 0; i < filteredHeadings.length; i++) {
    const heading = filteredHeadings[i]
    const nextHeading = filteredHeadings[i + 1]

    const startLine = heading.line
    const endLine = nextHeading ? nextHeading.line - 1 : lines.length - 1

    const contentLines: string[] = []
    for (let lineIdx = startLine + 1; lineIdx <= endLine; lineIdx++) {
      const line = lines[lineIdx]
      if (line && line.match(/^#{1,6}\s+/)) {
        break
      }
      contentLines.push(line)
    }

    const section: Section = {
      heading,
      contentLines,
      startLine,
      endLine,
      subsections: [],
    }

    sections.push(section)
  }

  return sections
}

/**
 * Split content into paragraphs
 */
export function splitIntoParagraphs(content: string): string[] {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  return paragraphs
}

/**
 * Split content into sentences
 */
export function splitIntoSentences(content: string): string[] {
  const sentences = content
    .split(/[.!?]+\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return sentences
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((w) => w.length > 0).length
}

/**
 * Create a preview (first N characters)
 */
export function createPreview(text: string, maxLength: number = 150): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()

  if (cleaned.length <= maxLength) {
    return cleaned
  }

  const truncated = cleaned.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...'
  }

  return truncated + '...'
}

/**
 * Build heading hierarchy array (e.g., ["# Main", "## Sub"])
 */
export function buildHeadingHierarchy(
  headings: Heading[],
  currentHeading: Heading,
): string[] {
  const hierarchy: string[] = []
  const currentIndex = headings.indexOf(currentHeading)

  if (currentIndex === -1) {
    return [currentHeading.raw]
  }

  let currentLevel = currentHeading.level

  for (let i = currentIndex; i >= 0; i--) {
    const h = headings[i]
    if (h.level < currentLevel) {
      hierarchy.unshift(h.raw)
      currentLevel = h.level
    }
  }

  hierarchy.push(currentHeading.raw)

  return hierarchy
}
