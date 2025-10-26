import { describe, it, expect } from 'vitest'
import { PlatformDetector } from '../../src/embeddings/providers/onnx/platform-detector'

describe('PlatformDetector', () => {
  it('should detect platform', () => {
    const platform = PlatformDetector.getPlatform()
    expect(['darwin', 'linux', 'win32']).toContain(platform)
  })

  it('should detect architecture', () => {
    const arch = PlatformDetector.getArch()
    expect(['x64', 'arm64']).toContain(arch)
  })

  it('should generate binary path', () => {
    const binaryPath = PlatformDetector.getBinaryPath()
    expect(binaryPath).toContain('bin/napi-v6/')
    expect(binaryPath).toMatch(/\.(node|dll)$/)
  })

  it('should check platform support', () => {
    const isSupported = PlatformDetector.isSupported()
    expect(isSupported).toBe(true)
  })
})
