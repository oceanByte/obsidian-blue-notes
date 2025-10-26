import * as path from 'path'

/**
 * Utility functions for constructing plugin-specific paths
 */

/**
 * Get the base path of the vault
 */
export function getVaultBasePath(app: any): string {
  const adapter = app.vault.adapter as { basePath?: string }
  return adapter.basePath || ''
}

/**
 * Get the plugin's data directory
 * Returns: <vault>/.obsidian/plugins/blue-notes
 */
export function getPluginDataDir(app: any): string {
  const basePath = getVaultBasePath(app)
  return path.join(basePath, '.obsidian', 'plugins', 'blue-notes')
}

/**
 * Get the plugin's models directory
 * Returns: <vault>/.obsidian/plugins/blue-notes/models
 */
export function getPluginModelsDir(app: any): string {
  return path.join(getPluginDataDir(app), 'models')
}
