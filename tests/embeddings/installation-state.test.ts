import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { InstallationStateManager } from '../../src/embeddings/providers/onnx/installation-state'

describe('InstallationStateManager', () => {
  const testDir = path.join(__dirname, '__test_state__')
  let manager: InstallationStateManager

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true })
    }
    fs.mkdirSync(testDir, { recursive: true })
    manager = new InstallationStateManager(testDir)
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true })
    }
  })

  it('should report not installed initially', () => {
    expect(manager.isInstalled()).toBe(false)
  })

  it('should save installation state', () => {
    manager.markInstalled('1.23.0', 'darwin')
    expect(manager.isInstalled()).toBe(true)
    expect(manager.getVersion()).toBe('1.23.0')
    expect(manager.getPlatform()).toBe('darwin')
  })

  it('should persist state across instances', () => {
    manager.markInstalled('1.23.0', 'darwin')

    const newManager = new InstallationStateManager(testDir)
    expect(newManager.isInstalled()).toBe(true)
    expect(newManager.getVersion()).toBe('1.23.0')
  })

  it('should mark installation as failed', () => {
    manager.markFailed('Network error')
    expect(manager.isInstalled()).toBe(false)
    expect(manager.hasFailed()).toBe(true)
    expect(manager.getError()).toBe('Network error')
  })

  it('should clear failed state on retry', () => {
    manager.markFailed('Network error')
    manager.clearError()
    expect(manager.hasFailed()).toBe(false)
    expect(manager.getError()).toBeUndefined()
  })

  it('should handle corrupted state file gracefully', () => {
    const stateFile = path.join(testDir, '.onnx-runtime-state.json')
    fs.writeFileSync(stateFile, 'invalid json{}}', 'utf-8')

    const corruptedManager = new InstallationStateManager(testDir)
    expect(corruptedManager.isInstalled()).toBe(false)
    expect(corruptedManager.hasFailed()).toBe(false)
  })
})
