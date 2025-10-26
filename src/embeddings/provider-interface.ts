/**
 * Common interface for all embedding providers
 */
export interface EmbeddingProvider {
  /**
   * Unique identifier for the provider
   */
  readonly name: string;

  /**
   * Check if the provider is available and ready to use
   */
  isAvailable(): Promise<boolean>;

  /**
   * Initialize the provider (download models, connect to services, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Generate embedding for a single text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Get the dimension of the embedding vectors
   */
  getDimension(): number;

  /**
   * Clean up resources
   */
  dispose(): Promise<void>;
}

/**
 * Provider types
 */
export enum ProviderType {
  ONNX = 'onnx',
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  type: ProviderType;
  enabled: boolean;
}

export enum ONNXModelType {
  DEFAULT = 'all-MiniLM-L6-v2',
  NOMIC_V15 = 'nomic-embed-text-v1.5',
}

export interface ONNXProviderConfig extends ProviderConfig {
  type: ProviderType.ONNX;
  modelType: ONNXModelType;
  autoDownload: boolean;
}

/**
 * Provider initialization result
 */
export interface ProviderInitResult {
  success: boolean;
  error?: string;
  downloadProgress?: number;
}
