import * as fs from 'fs'
import * as path from 'path'

import { Notice } from 'obsidian'

import { DownloadProgressNotifier } from '../../../utils/download-progress-notifier'
import { ensureDirectoryExists } from '../../../utils/file-utils'
import { Logger } from '../../../utils/logger'
import { ONNXModelType } from '../../provider-interface'

/**
 * Model information and download URLs
 */
interface ModelInfo {
  name: string;
  dimension: number;
  urls: {
    model: string;
    vocab?: string;
    config?: string;
  };
  description: string;
}

/**
 * Model registry with download URLs from HuggingFace
 */
const MODEL_REGISTRY: Partial<Record<ONNXModelType, ModelInfo>> = {
  [ONNXModelType.DEFAULT]: {
    name: 'all-MiniLM-L6-v2',
    dimension: 384,
    urls: {
      model:
        'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx',
      vocab:
        'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/vocab.txt',
      config:
        'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/config.json',
    },
    description: 'Fast and efficient English embeddings (~90MB)',
  },
  [ONNXModelType.NOMIC_V15]: {
    name: 'nomic-embed-text-v1.5',
    dimension: 768,
    urls: {
      model:
        'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5/resolve/main/onnx/model.onnx',
      vocab:
        'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5/resolve/main/vocab.txt',
      config:
        'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5/resolve/main/config.json',
    },
    description: 'Multilingual model supporting 70+ languages (~540MB)',
  },
}
/**
 * Download progress callback
 */
export type DownloadProgressCallback = (
  downloaded: number,
  total: number,
  file: string,
) => void

const BYTES_IN_MB = 1024 * 1024

/**
 * Model downloader with progress tracking
 */
export class ModelDownloader {
  private modelDir: string

  constructor(modelDir: string) {
    this.modelDir = modelDir
  }

  /**
   * Get model directory for a specific model type
   */
  getModelDir(modelType: ONNXModelType): string {
    return path.join(this.modelDir, modelType)
  }

  /**
   * Check if a model is downloaded
   */
  isModelDownloaded(modelType: ONNXModelType): boolean {
    const modelDir = this.getModelDir(modelType)
    const modelPath = path.join(modelDir, 'model.onnx')
    const vocabPath = path.join(modelDir, 'vocab.txt')

    return fs.existsSync(modelPath) && fs.existsSync(vocabPath)
  }

  /**
   * Get information about a model
   */
  getModelInfo(modelType: ONNXModelType): ModelInfo {
    return MODEL_REGISTRY[modelType] as ModelInfo
  }

  /**
   * Download a model with progress tracking
   */
  async downloadModel(
    modelType: ONNXModelType,
    onProgress?: DownloadProgressCallback,
    notifier?: DownloadProgressNotifier,
  ): Promise<void> {
    const modelInfo = MODEL_REGISTRY[modelType]
    const modelDir = this.getModelDir(modelType)

    ensureDirectoryExists(modelDir)

    const taskLabel = `${modelInfo.name} model`
    const useInternalNotice = !notifier
    const notice = useInternalNotice
      ? new Notice(`Downloading ${modelInfo.name}...\nPreparing download...`, 0)
      : null

    try {
      const filesToDownload: { url: string; name: string; size: number }[] = [
        {
          url: modelInfo.urls.model,
          name: 'model.onnx',
          size: this.estimateFileSize(modelInfo, 'model'),
        },
      ]
      if (modelInfo.urls.vocab) {
        const vocabFile = modelInfo.urls.vocab.split('/').pop() || 'vocab.txt'
        filesToDownload.push({
          url: modelInfo.urls.vocab,
          name: vocabFile,
          size: this.estimateFileSize(modelInfo, 'vocab'),
        })
      }
      if (modelInfo.urls.config) {
        filesToDownload.push({
          url: modelInfo.urls.config,
          name: 'config.json',
          size: 0.001,
        })
      }

      const estimatedTotalBytes = Math.max(
        filesToDownload.reduce((sum, file) => sum + file.size * BYTES_IN_MB, 0),
        1,
      )

      if (notifier) {
        notifier.beginTask(taskLabel, estimatedTotalBytes)
      }

      let dynamicTotalBytes = estimatedTotalBytes
      let completedBytes = 0

      let completedFiles = 0
      const totalFiles = filesToDownload.length

      for (const file of filesToDownload) {
        const fileSizeMB = file.size.toFixed(1)
        const estimatedSeconds = this.estimateDownloadTime(file.size)
        const eta =
          estimatedSeconds > 60
            ? `~${Math.round(estimatedSeconds / 60)}m`
            : `~${estimatedSeconds}s`

        notice?.setMessage(
          `Downloading ${modelInfo.name}...\n` +
            `File ${completedFiles + 1}/${totalFiles}: ${file.name} (${fileSizeMB} MB)\n` +
            `Estimated time: ${eta}`,
        )

        const fileStartTime = Date.now()
        let lastTotalFromServer = 0
        let currentFileTotalBytes = Math.max(file.size * BYTES_IN_MB, 1)
        let currentFileDownloaded = 0

        await this.downloadFile(
          file.url,
          path.join(modelDir, file.name),
          file.name,
          (downloaded, total, fileName) => {
            if (onProgress) {
              onProgress(downloaded, total, fileName)
            }

            if (notifier) {
              if (total > 0) {
                lastTotalFromServer = total
              }

              if (total > 0 && total !== currentFileTotalBytes) {
                dynamicTotalBytes += total - currentFileTotalBytes
                currentFileTotalBytes = total
                notifier.updateTaskWeight(taskLabel, dynamicTotalBytes)
              }

              currentFileDownloaded = downloaded
              const aggregateDownloaded = completedBytes + currentFileDownloaded
              const percent = dynamicTotalBytes > 0
                ? (aggregateDownloaded / dynamicTotalBytes) * 100
                : 0
              notifier.reportProgress(taskLabel, percent)
            }
          },
        )
        const fileTime = (Date.now() - fileStartTime) / 1000
        Logger.debug(`Downloaded ${file.name} in ${fileTime.toFixed(1)}s`)

        if (notifier) {
          if (lastTotalFromServer === 0 && currentFileDownloaded > 0) {
            dynamicTotalBytes += currentFileDownloaded - currentFileTotalBytes
            currentFileTotalBytes = currentFileDownloaded
            notifier.updateTaskWeight(taskLabel, dynamicTotalBytes)
          }

          completedBytes += currentFileTotalBytes
          const percent = dynamicTotalBytes > 0
            ? (completedBytes / dynamicTotalBytes) * 100
            : 100
          notifier.reportProgress(taskLabel, percent)
        }

        completedFiles++
      }

      notice?.hide()
      if (notifier) {
        notifier.completeTask(taskLabel)
      } else {
        new Notice(`✓ ${modelInfo.name} downloaded successfully!`, 5000)
      }
    } catch (error) {
      notice?.hide()
      notifier?.cancel()
      new Notice(
        `Failed to download ${modelInfo.name}: ${error.message}`,
        8000,
      )

      if (fs.existsSync(modelDir)) {
        try {
          fs.rmSync(modelDir, { recursive: true })
        } catch (e) {
          Logger.error('Failed to clean up partial download:', e)
        }
      }
      throw error
    }
  }

  /**
   * Get actual file size in MB from model info
   */
  private estimateFileSize(
    modelInfo: ModelInfo,
    fileType: 'model' | 'vocab',
  ): number {
    if (fileType === 'vocab') {
      return 0.5 // vocab.txt is typically ~0.5 MB
    }

    const sizeMap: Record<string, number> = {
      'all-MiniLM-L6-v2': 90,
      'nomic-embed-text-v1.5': 547,
    }

    return sizeMap[modelInfo.name] || 100
  }

  /**
   * Estimate download time in seconds based on file size
   * Assumes average download speed of 5 MB/s (conservative estimate)
   */
  private estimateDownloadTime(fileSizeMB: number): number {
    const avgSpeedMBps = 5
    return Math.ceil(fileSizeMB / avgSpeedMBps)
  }

  /**
   * Download a single file using Obsidian's requestUrl
   */
  private async downloadFile(
    url: string,
    destPath: string,
    fileName: string,
    onProgress?: DownloadProgressCallback,
  ): Promise<void> {
    Logger.info(`Downloading ${fileName} from ${url}`)

    // eslint-disable-next-line
    const https = require('https')
    const tmpPath = destPath + '.tmp'

    await new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(tmpPath)
      const follow = (link: string, base?: string) => {
        let targetUrl: string
        try {
          targetUrl = new URL(link, base ?? url).toString()
        } catch (error) {
          try { file.close(); fs.unlinkSync(tmpPath) } catch {}
          reject(new Error(`Invalid URL: ${link}`))
          return
        }

        https
          .get(targetUrl, (res: any) => {
            if (
              res.statusCode &&
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              res.headers.location
            ) {
              follow(res.headers.location, targetUrl)
              return
            }
            this.handleStream(res, file, onProgress, fileName, resolve, reject, tmpPath, destPath)
          })
          .on('error', (err: any) => {
            try { file.close(); fs.unlinkSync(tmpPath) } catch {}
            reject(err)
          })
      }
      follow(url)
    })
  }

  private handleStream(
    res: any,
    file: any,
    onProgress: DownloadProgressCallback | undefined,
    fileName: string,
    resolve: () => void,
    reject: (e: any) => void,
    tmpPath: string,
    destPath: string,
  ) {
    if (res.statusCode !== 200) {
      reject(new Error(`HTTP ${res.statusCode}`))
      return
    }
    const total = parseInt(res.headers['content-length'] || '0', 10)
    let downloaded = 0
    res.on('data', (chunk: Buffer) => {
      downloaded += chunk.length
      if (onProgress) onProgress(downloaded, total, fileName)
    })
    res.pipe(file)
    file.on('finish', () => {
      file.close(() => {
        try {
          fs.renameSync(tmpPath, destPath)
          Logger.info(`✓ Downloaded ${fileName} (${(downloaded / 1024 / 1024).toFixed(2)} MB)`)
          resolve()
        } catch (e) {
          reject(e)
        }
      })
    })
    res.on('error', (err: any) => {
      try { fs.unlinkSync(tmpPath) } catch {}
      reject(err)
    })
  }

  /**
   * Delete a downloaded model
   */
  deleteModel(modelType: ONNXModelType): boolean {
    const modelDir = this.getModelDir(modelType)

    if (!fs.existsSync(modelDir)) {
      return false
    }

    try {
      fs.rmSync(modelDir, { recursive: true })
      return true
    } catch (error) {
      Logger.error(`Failed to delete model ${modelType}:`, error)
      return false
    }
  }

  /**
   * Get model file paths for a specific model type
   */
  getModelPaths(modelType: ONNXModelType): {
    modelPath: string;
    vocabPath?: string;
    configPath?: string;
  } {
    const modelDir = this.getModelDir(modelType)

    const vocabTxt = path.join(modelDir, 'vocab.txt')
    const vocabJson = path.join(modelDir, 'vocab.json')

    return {
      modelPath: path.join(modelDir, 'model.onnx'),
      vocabPath: fs.existsSync(vocabTxt)
        ? vocabTxt
        : fs.existsSync(vocabJson)
          ? vocabJson
          : undefined,
      configPath: path.join(modelDir, 'config.json'),
    }
  }

  /**
   * Get all available models
   */
  getAllModels(): ONNXModelType[] {
    return Object.values(ONNXModelType)
  }

  /**
   * Get downloaded models
   */
  getDownloadedModels(): ONNXModelType[] {
    return this.getAllModels().filter((modelType) =>
      this.isModelDownloaded(modelType),
    )
  }
}
