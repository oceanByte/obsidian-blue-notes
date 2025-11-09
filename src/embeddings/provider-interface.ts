/**
 * Embedding context type
 */
export enum EmbeddingContext {
  QUERY = 'query',
  PASSAGE = 'passage',
}

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
   * @param text - The text to embed
   * @param context - Whether this is a query or passage (document) embedding
   */
  embed(text: string, context?: EmbeddingContext): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batch processing)
   * @param texts - The texts to embed
   * @param context - Whether these are query or passage (document) embeddings
   */
  embedBatch(texts: string[], context?: EmbeddingContext): Promise<number[][]>;

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
  E5_SMALL = 'multilingual-e5-small',
  MINI_LM = 'all-MiniLM-L6-v2',
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
