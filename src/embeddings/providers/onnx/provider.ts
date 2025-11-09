import * as path from 'path'

import { Notice } from 'obsidian'

import {
  type EmbeddingProvider,
  EmbeddingContext,
  ONNXModelType,
} from '../../provider-interface'
import { getPluginDataDir, getPluginModelsDir } from '../../../utils/plugin-paths'
import { meanPooling, normalize } from './inference'
import { DownloadProgressNotifier } from '../../../utils/download-progress-notifier'
import { ensureDirectoryExists } from '../../../utils/file-utils'
import { Logger } from '../../../utils/logger'
import { MESSAGES } from '../../../constants/messages'
import { ModelDownloader } from './downloader'
import { PlatformDetector } from './platform-detector'
import { RuntimeBinaryDownloader } from './runtime-downloader'

import type SemanticNotesPlugin from '../../../main'

type OrtModule = typeof import('onnxruntime-node')

interface OnnxSession {
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export class ONNXProvider implements EmbeddingProvider {
  readonly name = 'onnx'
  private plugin: SemanticNotesPlugin
  private session: OnnxSession | null = null
  private tokenizer: any = null
  private modelDir: string
  private ort: OrtModule | null = null
  private downloader: ModelDownloader
  private currentModelType: ONNXModelType
  private binaryDownloader: RuntimeBinaryDownloader
  private readonly ONNX_VERSION = '1.23.0'

  constructor(plugin: SemanticNotesPlugin) {
    this.plugin = plugin

    this.modelDir = getPluginModelsDir(this.plugin.app)
    this.downloader = new ModelDownloader(this.modelDir)

    this.currentModelType =
      this.plugin.settings?.provider?.modelType || ONNXModelType.E5_SMALL

    const pluginDataDir = getPluginDataDir(this.plugin.app)
    this.binaryDownloader = new RuntimeBinaryDownloader(pluginDataDir, this.ONNX_VERSION)
  }

  async isAvailable(): Promise<boolean> {
    try {

      if (!PlatformDetector.isSupported()) {
        Logger.warn(
          `Platform ${PlatformDetector.getPlatform()} ${PlatformDetector.getArch()} is not supported by ONNX Runtime`
        )
        return false
      }

      if (!this.binaryDownloader.isInstalled()) {
        Logger.info('ONNX Runtime binaries not installed, will download on plugin load')
        return false
      }

      const pluginDir = getPluginDataDir(this.plugin.app)

      const modulePath = path.join(pluginDir, 'onnxruntime-node')
      Logger.debug('Loading ONNX Runtime from:', modulePath)

      // eslint-disable-next-line
      const Module = require('module')
      const originalPaths = Module._nodeModulePaths
      Module._nodeModulePaths = function (from: string) {
        const paths = originalPaths.call(this, from)
        if (!paths.includes(pluginDir)) {
          paths.unshift(pluginDir)
        }
        return paths
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        this.ort = require(modulePath)
        Logger.debug('✓ Successfully loaded onnxruntime-node')
        return true
      } finally {
        Module._nodeModulePaths = originalPaths
      }
    } catch (error) {
      Logger.error('onnxruntime-node not available:', error.message)
      return false
    }
  }

  async initialize(): Promise<void> {
    try {
      ensureDirectoryExists(this.modelDir)

      const pendingItems: string[] = []
      if (!this.binaryDownloader.isInstalled()) {
        pendingItems.push('ONNX Runtime')
      }
      if (!this.downloader.isModelDownloaded(this.currentModelType)) {
        const modelInfo = this.downloader.getModelInfo(this.currentModelType)
        pendingItems.push(`${modelInfo.name} model`)
      }

      const notifier =
        pendingItems.length > 0
          ? new DownloadProgressNotifier({ items: pendingItems })
          : undefined

      const results = await Promise.allSettled([
        this.ensureRuntimeInstalled(notifier),
        this.downloadModelIfNeeded(notifier),
      ])

      const runtimeResult = results[0]
      const modelResult = results[1]

      if (runtimeResult.status === 'rejected') {
        Logger.error('Runtime installation failed:', runtimeResult.reason)
        throw runtimeResult.reason
      }

      if (modelResult.status === 'rejected') {
        Logger.warn('Model download failed:', modelResult.reason)
      }

      if (!this.ort) {
        const available = await this.isAvailable()
        if (!available) {
          throw new Error('ONNX runtime not available after installation')
        }
      }

      Logger.debug('ONNX provider initialized (model will be loaded on first use)')
    } catch (error) {
      Logger.error('Failed to initialize ONNX provider:', error)
      new Notice(MESSAGES.MODEL_LOAD_FAILED(error.message))
      throw error
    }
  }

  /**
   * Download model if not already present (without loading into memory)
   */
  private async downloadModelIfNeeded(
    notifier?: DownloadProgressNotifier,
  ): Promise<void> {
    if (!this.downloader.isModelDownloaded(this.currentModelType)) {
      if (!notifier) {
        new Notice(MESSAGES.MODEL_DOWNLOADING(this.currentModelType))
      }

      await this.downloader.downloadModel(
        this.currentModelType,
        this.getDownloadProgressCallback(),
        notifier,
      )
      if (!notifier) {
        new Notice('Embedding model downloaded successfully')
      }
    }
  }

  async ensureRuntimeInstalled(
    notifier?: DownloadProgressNotifier,
  ): Promise<void> {
    if (this.binaryDownloader.isInstalled()) {
      return
    }

    const stateManager = this.binaryDownloader.getStateManager()

    if (stateManager.hasFailed()) {
      const error = stateManager.getError()
      throw new Error(`Previous installation failed: ${error}. Please retry from settings.`)
    }

    try {
      const taskId = 'ONNX Runtime'

      if (notifier) {
        notifier.beginTask(taskId)
      } else {
        new Notice('Downloading ONNX Runtime (this may take a minute)...')
      }

      await this.binaryDownloader.download((progress) => {
        if (notifier && progress.total > 0) {
          notifier.updateTaskWeight(taskId, progress.total)
          notifier.reportProgress(taskId, progress.percentage)
        }
        Logger.debug(
          `Download progress: ${progress.percentage.toFixed(1)}% (${(progress.downloaded / 1024 / 1024).toFixed(1)}MB / ${(progress.total / 1024 / 1024).toFixed(1)}MB)`
        )
      })

      if (notifier) {
        notifier.completeTask(taskId)
      } else {
        new Notice('ONNX Runtime installed successfully')
      }
    } catch (error) {
      notifier?.cancel()
      const errorMsg = error instanceof Error ? error.message : String(error)
      new Notice(`Failed to install ONNX Runtime: ${errorMsg}`)
      throw error
    }
  }

  getBinaryDownloader(): RuntimeBinaryDownloader {
    return this.binaryDownloader
  }

  /**
   * Create a progress callback for model downloads
   */
  private getDownloadProgressCallback() {
    return (downloaded: number, total: number, file: string) => {
      Logger.debug(
        `Downloading ${file}: ${((downloaded / total) * 100).toFixed(1)}%`,
      )
    }
  }

  /**
   * Ensure the model is downloaded and loaded before use
   * This is called lazily on first embedding request
   */
  private async ensureModelLoaded(): Promise<void> {
    if (this.session && this.tokenizer) {
      return
    }

    try {
      if (!this.downloader.isModelDownloaded(this.currentModelType)) {
        const modelInfo = this.downloader.getModelInfo(this.currentModelType)
        const notifier = new DownloadProgressNotifier({
          items: [`${modelInfo.name} model`],
        })
        await this.downloader.downloadModel(
          this.currentModelType,
          this.getDownloadProgressCallback(),
          notifier,
        )
      }

      await this.loadModel(this.currentModelType)
    } catch (error) {
      Logger.error('Failed to load ONNX model:', error)
      new Notice(MESSAGES.MODEL_LOAD_FAILED(error.message))
      throw error
    }
  }

  /**
   * Load a specific model
   */
  private async loadModel(modelType: ONNXModelType): Promise<void> {
    const paths = this.downloader.getModelPaths(modelType)

    Logger.info('Loading Hugging Face tokenizer from:', this.downloader.getModelDir(modelType))

    const { HuggingFaceTokenizer } = await import('./huggingface-tokenizer')
    this.tokenizer = await HuggingFaceTokenizer.fromPretrained(
      this.downloader.getModelDir(modelType)
    )

    Logger.info('Loading ONNX model from:', paths.modelPath)
    this.session = await this.ort!.InferenceSession.create(paths.modelPath, {
      executionProviders: ['cpu'],
    })

    this.currentModelType = modelType

    Logger.info('✓ ONNX provider initialized')
    Logger.info('Model type:', modelType)
    Logger.debug('Input names:', this.session.inputNames)
    Logger.debug('Output names:', this.session.outputNames)
  }

  /**
   * Switch to a different model
   * @param modelType - The model type to switch to
   * @param silent - If true, suppress the success notice (default: false)
   */
  async switchModel(modelType: ONNXModelType, silent = false): Promise<void> {
    if (modelType === this.currentModelType) {
      return
    }

    if (!this.downloader.isModelDownloaded(modelType)) {
      const modelInfo = this.downloader.getModelInfo(modelType)
      const notifier = new DownloadProgressNotifier({
        items: [`${modelInfo.name} model`],
      })
      await this.downloader.downloadModel(
        modelType,
        this.getDownloadProgressCallback(),
        notifier,
      )
    }

    if (this.session) {
      this.session = null
    }

    await this.loadModel(modelType)

    if (!silent) {
      new Notice(MESSAGES.MODEL_SWITCHED(modelType))
    }
  }

  /**
   * Get the model downloader
   */
  getDownloader(): ModelDownloader {
    return this.downloader
  }

  /**
   * Preprocess text based on model requirements
   * E5 models require "query: " or "passage: " prefixes
   */
  private preprocessText(text: string, context: EmbeddingContext = EmbeddingContext.PASSAGE): string {

    if (this.currentModelType === ONNXModelType.E5_SMALL) {
      if (context === EmbeddingContext.QUERY) {
        return `query: ${text}`
      } else {
        return `passage: ${text}`
      }
    }

    return text
  }

  async embed(text: string, context: EmbeddingContext = EmbeddingContext.PASSAGE): Promise<number[]> {
    await this.ensureModelLoaded()

    if (!this.session || !this.tokenizer) {
      throw new Error('ONNX provider not initialized')
    }

    const processedText = this.preprocessText(text, context)
    const inputs = await this.tokenizer.createInputs(processedText)

    if (!this.ort) {
      throw new Error('ONNX runtime not loaded')
    }

    const feeds = {
      input_ids: new this.ort.Tensor(
        'int64',
        BigInt64Array.from(inputs.input_ids.map(BigInt)),
        [1, inputs.input_ids.length],
      ),
      attention_mask: new this.ort.Tensor(
        'int64',
        BigInt64Array.from(inputs.attention_mask.map(BigInt)),
        [1, inputs.attention_mask.length],
      ),
      token_type_ids: new this.ort.Tensor(
        'int64',
        BigInt64Array.from(inputs.token_type_ids.map(BigInt)),
        [1, inputs.token_type_ids.length],
      ),
    }

    const results = await this.session.run(feeds)
    const outputName = this.session.outputNames[0]
    const output = results[outputName] as {
      dims: number[];
      data: Float32Array;
    }

    const embedding = meanPooling(
      output,
      feeds.attention_mask as unknown as { data: Float32Array | number[] },
    )
    const normalizedEmbedding = normalize(embedding)

    return normalizedEmbedding
  }

  async embedBatch(texts: string[], context: EmbeddingContext = EmbeddingContext.PASSAGE): Promise<number[][]> {
    const embeddings: number[][] = []
    for (const text of texts) {
      embeddings.push(await this.embed(text, context))
    }
    return embeddings
  }

  getDimension(): number {
    const modelInfo = this.downloader.getModelInfo(this.currentModelType)
    return modelInfo.dimension
  }

  async dispose(): Promise<void> {
    this.session = null
    this.tokenizer = null
  }
}
