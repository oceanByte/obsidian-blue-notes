import * as fs from 'fs'
import * as https from 'https'
import { Logger } from './logger'

/**
 * Progress information for file downloads
 */
export interface DownloadProgress {
  downloaded: number
  total: number
  percentage: number
}

export type DownloadProgressCallback = (progress: DownloadProgress) => void

/**
 * @deprecated Use DownloadProgress instead
 */
export type HttpDownloadProgress = DownloadProgress

/**
 * @deprecated Use DownloadProgressCallback instead
 */
export type HttpDownloadProgressCallback = DownloadProgressCallback

/**
 * Options for downloading files via HTTP/HTTPS
 */
export interface HttpDownloadOptions {
  /**
   * Progress callback
   */
  onProgress?: DownloadProgressCallback

  /**
   * Request timeout in milliseconds (default: 60000)
   */
  timeout?: number

  /**
   * Maximum number of redirects to follow (default: 10)
   */
  maxRedirects?: number
}

/**
 * Download a file from a URL to a destination path with automatic redirect following
 * and progress tracking. Uses a temporary file during download and atomically renames
 * on completion.
 *
 * @param url - The URL to download from
 * @param destPath - The destination file path
 * @param options - Download options including progress callback and timeout
 */
export async function downloadFile(
  url: string,
  destPath: string,
  options: HttpDownloadOptions = {}
): Promise<void> {
  const { onProgress, timeout = 60000, maxRedirects = 10 } = options
  const tmpPath = destPath + '.tmp'

  await new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(tmpPath)
    let redirectCount = 0

    const cleanup = () => {
      try {
        file.close()
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath)
        }
      } catch {
        // Ignore cleanup errors
      }
    }

    const follow = (targetUrl: string, baseUrl?: string) => {
      let resolvedUrl: string
      try {
        resolvedUrl = new URL(targetUrl, baseUrl ?? url).toString()
      } catch {
        cleanup()
        reject(new Error(`Invalid URL: ${targetUrl}`))
        return
      }

      const request = https.get(resolvedUrl, (response) => {

        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          redirectCount++
          if (redirectCount > maxRedirects) {
            cleanup()
            reject(new Error(`Too many redirects (>${maxRedirects})`))
            return
          }
          follow(response.headers.location, resolvedUrl)
          return
        }

        if (response.statusCode !== 200) {
          cleanup()
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage || 'Unknown error'}`))
          return
        }

        const total = parseInt(response.headers['content-length'] || '0', 10)
        let downloaded = 0

        response.on('data', (chunk: Buffer) => {
          downloaded += chunk.length
          if (onProgress && total > 0) {
            onProgress({
              downloaded,
              total,
              percentage: (downloaded / total) * 100
            })
          }
        })

        response.pipe(file)

        file.on('finish', () => {
          file.close(() => {
            try {
              fs.renameSync(tmpPath, destPath)
              const sizeMB = (downloaded / 1024 / 1024).toFixed(2)
              Logger.info(`✓ Downloaded ${destPath.split('/').pop()} (${sizeMB} MB)`)
              resolve()
            } catch (error) {
              cleanup()
              reject(error)
            }
          })
        })

        response.on('error', (err) => {
          cleanup()
          reject(err)
        })
      })

      request.setTimeout(timeout, () => {
        request.destroy()
        cleanup()
        reject(new Error(`Request timeout after ${timeout}ms`))
      })

      request.on('error', (err) => {
        cleanup()
        reject(err)
      })
    }

    follow(url)
  })
}
