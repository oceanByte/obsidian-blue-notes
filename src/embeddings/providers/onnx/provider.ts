import * as path from 'path'

import { Notice } from 'obsidian'

import {
  type EmbeddingProvider,
  ONNXModelType,
} from '../../provider-interface'
import { getPluginDataDir, getPluginModelsDir } from '../../../utils/plugin-paths'
import { meanPooling, normalize } from './inference'
import { ensureDirectoryExists } from '../../../utils/file-utils'
import { Logger } from '../../../utils/logger'
import { MESSAGES } from '../../../constants/messages'
import { ModelDownloader } from './downloader'
import { SimpleTokenizer } from './tokenizer'
import { RuntimeBinaryDownloader } from './runtime-downloader'
import { PlatformDetector } from './platform-detector'

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
  private tokenizer: SimpleTokenizer | null = null
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
      this.plugin.settings?.provider?.modelType || ONNXModelType.DEFAULT

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

      // Check if binaries are installed
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
      await this.ensureRuntimeInstalled()

      if (!this.ort) {
        const available = await this.isAvailable()
        if (!available) {
          throw new Error('ONNX runtime not available after installation')
        }
      }

      ensureDirectoryExists(this.modelDir)

      Logger.debug('ONNX provider initialized (model will be loaded on first use)')
    } catch (error) {
      Logger.error('Failed to initialize ONNX provider:', error)
      new Notice(MESSAGES.MODEL_LOAD_FAILED(error.message))
      throw error
    }
  }

  async ensureRuntimeInstalled(): Promise<void> {
    if (this.binaryDownloader.isInstalled()) {
      return
    }

    const stateManager = this.binaryDownloader.getStateManager()

    if (stateManager.hasFailed()) {
      const error = stateManager.getError()
      throw new Error(`Previous installation failed: ${error}. Please retry from settings.`)
    }

    try {
      new Notice('Downloading ONNX Runtime (this may take a minute)...')

      await this.binaryDownloader.download((progress) => {
        Logger.debug(
          `Download progress: ${progress.percentage.toFixed(1)}% (${(progress.downloaded / 1024 / 1024).toFixed(1)}MB / ${(progress.total / 1024 / 1024).toFixed(1)}MB)`
        )
      })

      new Notice('ONNX Runtime installed successfully')
    } catch (error) {
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
        new Notice(MESSAGES.MODEL_DOWNLOADING(this.currentModelType))
        await this.downloader.downloadModel(
          this.currentModelType,
          this.getDownloadProgressCallback(),
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

    Logger.info('Loading tokenizer from:', paths.vocabPath)
    this.tokenizer = new SimpleTokenizer(paths.vocabPath)

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
   */
  async switchModel(modelType: ONNXModelType): Promise<void> {
    if (modelType === this.currentModelType) {
      return
    }

    if (!this.downloader.isModelDownloaded(modelType)) {
      await this.downloader.downloadModel(
        modelType,
        this.getDownloadProgressCallback(),
      )
    }

    if (this.session) {
      this.session = null
    }

    await this.loadModel(modelType)

    new Notice(MESSAGES.MODEL_SWITCHED(modelType))
  }

  /**
   * Get the model downloader
   */
  getDownloader(): ModelDownloader {
    return this.downloader
  }

  async embed(text: string): Promise<number[]> {
    await this.ensureModelLoaded()

    if (!this.session || !this.tokenizer) {
      throw new Error('ONNX provider not initialized')
    }

    const inputs = this.tokenizer.createInputs(text)

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

  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []
    for (const text of texts) {
      embeddings.push(await this.embed(text))
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
