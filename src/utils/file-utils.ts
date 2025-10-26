import * as fs from 'fs'

/**
 * Utility functions for file system operations
 */

/**
 * Ensure a directory exists, creating it if necessary
 * @param dirPath - The directory path to ensure exists
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}
