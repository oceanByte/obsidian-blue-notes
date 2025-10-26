import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { RuntimeBinaryDownloader } from '../../src/embeddings/providers/onnx/runtime-downloader'

describe('RuntimeBinaryDownloader', () => {
  const testDir = path.join(__dirname, '__test_runtime__')
  let downloader: RuntimeBinaryDownloader

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true })
    }
    fs.mkdirSync(testDir, { recursive: true })
    downloader = new RuntimeBinaryDownloader(testDir, '1.23.0')
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true })
    }
  })

  it('should check if binaries are installed', () => {
    expect(downloader.isInstalled()).toBe(false)
  })

  it('should generate correct NPM registry URL', () => {
    const url = downloader.getDownloadUrl()
    expect(url).toBe('https://registry.npmjs.org/onnxruntime-node/-/onnxruntime-node-1.23.0.tgz')
  })

  it('should get installation path', () => {
    const installPath = downloader.getInstallPath()
    expect(installPath).toContain(testDir)
    expect(installPath).toContain('onnxruntime-node')
  })

  it('should download and extract binaries', async () => {
    // This is an integration test that requires network
    // Skip in CI environments
    if (process.env.CI) {
      return
    }

    const onProgress = vi.fn()

    await downloader.download(onProgress)

    expect(downloader.isInstalled()).toBe(true)
    expect(onProgress).toHaveBeenCalled()
  }, 60000)

  it('should handle download failures gracefully', async () => {
    const invalidDownloader = new RuntimeBinaryDownloader(testDir, '999.999.999')

    await expect(invalidDownloader.download()).rejects.toThrow()
    expect(invalidDownloader.isInstalled()).toBe(false)
  })
})
