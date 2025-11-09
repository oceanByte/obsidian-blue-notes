/**
 * Core types for document chunking
 */

export interface Chunk {
  /** Unique identifier for this chunk within the file */
  chunkId: string;
  /** The text content of this chunk */
  content: string;
  /** Heading hierarchy for this chunk (e.g., ["# Main", "## Subsection"]) */
  headings: string[];
  /** Starting line number in the original file (0-indexed) */
  startLine: number;
  /** Ending line number in the original file (0-indexed) */
  endLine: number;
  /** Word count of this chunk */
  wordCount: number;
  /** Preview text for display (first ~150 chars) */
  preview: string;
}

export interface ChunkingOptions {
  /** Maximum words per chunk before forced split (default: 800) */
  maxWords: number;
  /** Minimum words per chunk before attempting merge (default: 100) */
  minWords: number;
  /** Whether to split at heading boundaries (default: true) */
  splitAtHeadings: boolean;
  /** Maximum heading level to split at (1=H1, 2=H2, etc. default: 3) */
  maxHeadingLevel: number;
}

export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  maxWords: 800,
  minWords: 100,
  splitAtHeadings: true,
  maxHeadingLevel: 3,
}

/**
 * Internal representation of a heading in the document
 */
export interface Heading {
  /** Heading level (1-6) */
  level: number;
  /** Heading text without the # markers */
  text: string;
  /** Line number where this heading appears (0-indexed) */
  line: number;
  /** Raw markdown line including # markers */
  raw: string;
}

/**
 * A section is a contiguous block of content, potentially containing subsections
 */
export interface Section {
  /** The heading for this section (if any) */
  heading: Heading | null;
  /** Content lines (not including the heading line) */
  contentLines: string[];
  /** Starting line number (0-indexed) */
  startLine: number;
  /** Ending line number (0-indexed) */
  endLine: number;
  /** Nested subsections */
  subsections: Section[];
}
