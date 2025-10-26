import * as path from 'path'

export class PlatformDetector {
  private static SUPPORTED_PLATFORMS = ['darwin', 'linux', 'win32']
  private static SUPPORTED_ARCHITECTURES = ['x64', 'arm64']

  static getPlatform(): string {
    return process.platform
  }

  static getArch(): string {
    return process.arch
  }

  static isSupported(): boolean {
    return (
      this.SUPPORTED_PLATFORMS.includes(this.getPlatform()) &&
      this.SUPPORTED_ARCHITECTURES.includes(this.getArch())
    )
  }

  static getBinaryPath(): string {
    const platform = this.getPlatform()
    const arch = this.getArch()
    const ext = platform === 'win32' ? 'dll' : 'node'

    return path.join('bin', 'napi-v6', platform, arch, `onnxruntime_binding.${ext}`)
  }

  static getLibraryPath(): string {
    const platform = this.getPlatform()
    const arch = this.getArch()

    return path.join('bin', 'napi-v6', platform, arch)
  }
}
