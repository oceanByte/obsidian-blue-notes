import * as fs from 'fs'
import * as path from 'path'
import { PlatformDetector } from './platform-detector'
import { InstallationStateManager } from './installation-state'
import { Logger } from '../../../utils/logger'
import { downloadFile, DownloadProgress } from '../../../utils/http-downloader'
import { ensureDirectoryExists } from '../../../utils/file-utils'
import { extractTarball } from '../../../utils/tar-extractor'

export class RuntimeBinaryDownloader {
  private dataDir: string
  private version: string
  private stateManager: InstallationStateManager

  constructor(dataDir: string, version: string) {
    this.dataDir = dataDir
    this.version = version
    this.stateManager = new InstallationStateManager(dataDir)
  }

  getDownloadUrl(): string {
    return `https://registry.npmjs.org/onnxruntime-node/-/onnxruntime-node-${this.version}.tgz`
  }

  getInstallPath(): string {
    return path.join(this.dataDir, 'onnxruntime-node')
  }

  isInstalled(): boolean {
    const installPath = this.getInstallPath()
    const binaryPath = path.join(installPath, PlatformDetector.getBinaryPath())
    if (!fs.existsSync(binaryPath) || !this.stateManager.isInstalled()) {
      return false
    }

    const packageJsonPath = path.join(installPath, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      return false
    }

    try {
      const { dependencies } = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      if (!dependencies) {
        return true
      }

      for (const depName of Object.keys(dependencies)) {
        const dependencyPath = path.join(installPath, 'node_modules', depName, 'package.json')
        if (!fs.existsSync(dependencyPath)) {
          return false
        }
      }
      return true
    } catch (error) {
      Logger.warn('Failed to verify ONNX Runtime dependencies:', error)
      return false
    }
  }

  getStateManager(): InstallationStateManager {
    return this.stateManager
  }

  async download(
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    if (!PlatformDetector.isSupported()) {
      throw new Error(
        `Platform ${PlatformDetector.getPlatform()} ${PlatformDetector.getArch()} is not supported`
      )
    }

    try {
      this.stateManager.clearError()

      const url = this.getDownloadUrl()
      const installPath = this.getInstallPath()

      Logger.info(`Downloading ONNX Runtime from ${url}`)

      ensureDirectoryExists(this.dataDir)

      const tempTarball = path.join(this.dataDir, 'onnxruntime-temp.tgz')
      await downloadFile(url, tempTarball, {
        onProgress
      })

      Logger.info('Extracting tarball...')

      if (fs.existsSync(installPath)) {
        fs.rmSync(installPath, { recursive: true, force: true })
      }

      await this.extractTarball(tempTarball, installPath)

      fs.unlinkSync(tempTarball)

      await this.installDependencies(installPath)

      const binaryPath = path.join(installPath, PlatformDetector.getBinaryPath())
      if (!fs.existsSync(binaryPath)) {
        throw new Error(`Binary not found at ${binaryPath} after extraction`)
      }

      this.stateManager.markInstalled(this.version, PlatformDetector.getPlatform())

      Logger.info('✓ ONNX Runtime binaries installed successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.stateManager.markFailed(errorMessage)
      Logger.error('Failed to download ONNX Runtime:', errorMessage)
      throw error
    }
  }

  private resolveVersion(versionRange: string): string | null {
    if (!versionRange) {
      return null
    }

    const trimmed = versionRange.trim()
    if (trimmed.startsWith('^') || trimmed.startsWith('~')) {
      return trimmed.slice(1)
    }

    if (trimmed.startsWith('>') || trimmed.startsWith('<')) {
      Logger.warn(`Unsupported semver range ${versionRange}, skipping dependency download`)
      return null
    }

    return trimmed
  }

  private getTarballUrlForDependency(name: string, version: string): string {
    const safeName = name
    const tarballFile = name.startsWith('@')
      ? `${name.split('/')[1]}-${version}.tgz`
      : `${name}-${version}.tgz`

    return `https://registry.npmjs.org/${safeName}/-/${tarballFile}`
  }

  private async installDependencies(installPath: string): Promise<void> {
    const packageJsonPath = path.join(installPath, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      return
    }

    let dependencies: Record<string, string> | undefined
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      dependencies = packageJson.dependencies
    } catch (error) {
      Logger.warn('Failed to read ONNX Runtime package.json for dependencies:', error)
      return
    }

    if (!dependencies || Object.keys(dependencies).length === 0) {
      return
    }

    const nodeModulesDir = path.join(installPath, 'node_modules')
    ensureDirectoryExists(nodeModulesDir)

    for (const [depName, versionRange] of Object.entries(dependencies)) {
      const resolvedVersion = this.resolveVersion(versionRange)
      if (!resolvedVersion) {
        continue
      }

      const dependencyPath = path.join(nodeModulesDir, depName)
      if (fs.existsSync(path.join(dependencyPath, 'package.json'))) {
        continue
      }

      const tarballUrl = this.getTarballUrlForDependency(depName, resolvedVersion)
      const tempTarball = path.join(
        this.dataDir,
        `${depName.replace(/[\\/]/g, '-')}-${resolvedVersion}.tgz`,
      )

      Logger.info(`Downloading dependency ${depName}@${resolvedVersion} from ${tarballUrl}`)

      await downloadFile(tarballUrl, tempTarball)
      await this.extractTarball(tempTarball, dependencyPath)
      fs.unlinkSync(tempTarball)
    }
  }

  private async extractTarball(tarballPath: string, destDir: string): Promise<void> {
    ensureDirectoryExists(destDir)

    await extractTarball(tarballPath, {
      cwd: destDir,
      strip: 1,
    })
  }
}
