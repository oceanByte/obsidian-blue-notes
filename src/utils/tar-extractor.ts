import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'

/**
 * Options for tar extraction
 */
export interface ExtractOptions {
  /**
   * Directory to extract files into
   */
  cwd: string
  /**
   * Number of leading path segments to strip from file names
   * (e.g., strip: 1 removes "package/" from "package/index.js")
   */
  strip?: number
}

/**
 * Parse a tar header (512 bytes) and extract metadata
 */
function parseTarHeader(buffer: Buffer, offset: number): {
  name: string
  size: number
  type: string
} | null {
  // Check if this is an empty block (end of archive)
  let isEmpty = true
  for (let i = 0; i < 512; i++) {
    if (buffer[offset + i] !== 0) {
      isEmpty = false
      break
    }
  }
  if (isEmpty) {
    return null
  }

  // Extract filename (first 100 bytes, null-terminated)
  const nameBuffer = buffer.subarray(offset, offset + 100)
  const nameEnd = nameBuffer.indexOf(0)
  const name = nameBuffer.toString('utf-8', 0, nameEnd > 0 ? nameEnd : 100).trim()

  // Extract file size (bytes 124-135, octal string)
  const sizeStr = buffer.toString('utf-8', offset + 124, offset + 136).trim().replace(/\0/g, '')
  const size = parseInt(sizeStr, 8) || 0

  // Extract file type (byte 156)
  const typeCode = buffer.toString('utf-8', offset + 156, offset + 157)

  return { name, size, type: typeCode }
}

/**
 * Extract a .tar.gz (tgz) file using native Node.js modules only
 *
 * @param tarballPath - Path to the .tar.gz file
 * @param options - Extraction options
 */
export async function extractTarball(
  tarballPath: string,
  options: ExtractOptions
): Promise<void> {
  const { cwd, strip = 0 } = options

  // Ensure destination directory exists
  if (!fs.existsSync(cwd)) {
    fs.mkdirSync(cwd, { recursive: true })
  }

  // Read and gunzip the tarball
  const compressedData = fs.readFileSync(tarballPath)
  const tarData = zlib.gunzipSync(compressedData)

  let offset = 0
  const BLOCK_SIZE = 512

  while (offset < tarData.length) {
    // Parse tar header
    const header = parseTarHeader(tarData, offset)
    offset += BLOCK_SIZE

    // End of archive (two consecutive empty blocks)
    if (!header || !header.name) {
      break
    }

    const { name, size, type } = header

    // Skip if this is a directory or other special type
    // Type '0' or '\0' = regular file, '5' = directory
    if (type === '5' || type === 'x' || type === 'g') {
      // PAX extended headers or global headers - skip
      const paddedSize = Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE
      offset += paddedSize
      continue
    }

    // Apply strip option to remove leading path components
    const pathParts = name.split('/')
    if (strip > 0) {
      if (pathParts.length <= strip) {
        // Skip this file if stripping would remove the entire path
        const paddedSize = Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE
        offset += paddedSize
        continue
      }
      pathParts.splice(0, strip)
    }

    const destPath = path.join(cwd, ...pathParts)

    // Create parent directory if it doesn't exist
    const destDir = path.dirname(destPath)
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }

    // Extract file data
    if (size > 0 && type !== '5') {
      const fileData = tarData.subarray(offset, offset + size)
      fs.writeFileSync(destPath, fileData)
    }

    // Move to next header (file data is padded to BLOCK_SIZE boundary)
    const paddedSize = Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE
    offset += paddedSize
  }
}
