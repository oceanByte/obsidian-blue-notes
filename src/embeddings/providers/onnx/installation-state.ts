import * as fs from 'fs'
import * as path from 'path'
import { ensureDirectoryExists } from '../../../utils/file-utils'

interface InstallationState {
  installed: boolean
  version?: string
  platform?: string
  lastAttempt?: number
  error?: string
}

export class InstallationStateManager {
  private stateFile: string
  private state: InstallationState

  constructor(dataDir: string) {
    this.stateFile = path.join(dataDir, '.onnx-runtime-state.json')
    this.state = this.loadState()
  }

  private loadState(): InstallationState {
    if (!fs.existsSync(this.stateFile)) {
      return { installed: false }
    }

    try {
      const content = fs.readFileSync(this.stateFile, 'utf-8')
      return JSON.parse(content)
    } catch {
      return { installed: false }
    }
  }

  private saveState(): void {
    const dir = path.dirname(this.stateFile)
    ensureDirectoryExists(dir)
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf-8')
  }

  isInstalled(): boolean {
    return this.state.installed === true
  }

  getVersion(): string | undefined {
    return this.state.version
  }

  getPlatform(): string | undefined {
    return this.state.platform
  }

  markInstalled(version: string, platform: string): void {
    this.state = {
      installed: true,
      version,
      platform,
      lastAttempt: Date.now(),
    }
    this.saveState()
  }

  markFailed(error: string): void {
    this.state = {
      ...this.state,
      installed: false,
      error,
      lastAttempt: Date.now(),
    }
    this.saveState()
  }

  hasFailed(): boolean {
    return this.state.error !== undefined
  }

  getError(): string | undefined {
    return this.state.error
  }

  clearError(): void {
    this.state = {
      ...this.state,
      error: undefined,
    }
    this.saveState()
  }
}
