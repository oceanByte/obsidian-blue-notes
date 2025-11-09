export const MESSAGES = {
  NO_ACTIVE_FILE: 'No active file',
  NO_EMBEDDING_PROVIDER: 'No embedding provider available',
  NO_EMBEDDING_PROVIDER_AVAILABLE: 'No embedding provider available.',
  PROCESSING_CURRENT_FILE: 'Processing current file...',
  NO_SIMILAR_NOTES: 'No similar notes found',
  FILE_PROCESSED: '✓ File processed',
  USING_CACHED_EMBEDDING: '✓ Using cached embedding',
  CACHE_CLEARED: 'Cache cleared',
  ALREADY_PROCESSING_VAULT: 'Already processing vault',
  SEARCH_FAILED: (error: string) => `Search failed: ${error}`,
  ERROR: (error: string) => `Error: ${error}`,
  PROCESSING_FILES: (total: number, skipped: number) =>
    `Processing ${total} notes (${skipped} skipped)...`,
  FAILED_TO_PROCESS: (failed: number, total: number, reason: string) =>
    `Failed to process ${failed}/${total} files: ${reason}`,
  PROCESSING_COMPLETE: (processed: number, cached: number) =>
    `Processed ${processed} files (${cached} cached)`,
  DOWNLOADING_MODEL: (name: string) => `Downloading ${name}...`,
  MODEL_DOWNLOADED: (name: string) => `✓ ${name} downloaded successfully!`,
  MODEL_LOAD_FAILED: (error: string) =>
    `Failed to load ONNX model: ${error}`,
  MODEL_DOWNLOAD_FAILED: (name: string, error: string) =>
    `Failed to download ${name}: ${error}`,
  MODEL_INIT_FAILED: (error: string) =>
    `Failed to initialize ONNX model: ${error}`,
  MODEL_SWITCHED: (modelType: string) => `Switched to ${modelType} model`,
  MODEL_CHANGED_REPROCESS: 'Model changed! Cache cleared. Please run "Process entire vault" to reprocess your notes with the new model.',
  PROVIDER_SWITCHED: (provider: string) => `Switched to ${provider} provider`,
  PROVIDER_SWITCH_FAILED: (provider: string) =>
    `Failed to switch to ${provider} provider`,
  MODEL_DOWNLOADING: (model: string) => `Downloading ${model} model...`,
} as const
