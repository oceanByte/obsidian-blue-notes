import { describe, it, expect, beforeAll } from 'vitest'
import * as path from 'path'
import { RuntimeBinaryDownloader } from '../../src/embeddings/providers/onnx/runtime-downloader'
import { PlatformDetector } from '../../src/embeddings/providers/onnx/platform-detector'

describe('Runtime Binary Download Integration', () => {
  const testDir = path.join(__dirname, '__test_integration__')

  const describeIf = process.env.CI ? describe.skip : describe

  describeIf('full download flow', () => {
    let downloader: RuntimeBinaryDownloader

    beforeAll(async () => {
      downloader = new RuntimeBinaryDownloader(testDir, '1.23.0')
    }, 10000)

    it('should download, extract, and verify binaries', async () => {
      let progressCalled = false

      await downloader.download((progress) => {
        progressCalled = true
        expect(progress.percentage).toBeGreaterThanOrEqual(0)
        expect(progress.percentage).toBeLessThanOrEqual(100)
      })

      expect(progressCalled).toBe(true)
      expect(downloader.isInstalled()).toBe(true)

      const installPath = downloader.getInstallPath()
      const binaryPath = path.join(installPath, PlatformDetector.getBinaryPath())
      const fs = await import('fs')
      expect(fs.existsSync(binaryPath)).toBe(true)
    }, 120000) // 2 minute timeout

    it('should load the runtime successfully', async () => {
      const installPath = downloader.getInstallPath()

      const ort = require(installPath)
      expect(ort).toBeDefined()
      expect(ort.InferenceSession).toBeDefined()
    })
  })
})
