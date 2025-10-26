import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as tar from 'tar'
import { PlatformDetector } from './platform-detector'
import { InstallationStateManager } from './installation-state'
import { Logger } from '../../../utils/logger'

export interface DownloadProgress {
  downloaded: number
  total: number
  percentage: number
}

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

      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true })
      }

      const tempTarball = path.join(this.dataDir, 'onnxruntime-temp.tgz')
      await this.downloadFile(url, tempTarball, onProgress)

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
    if (!fs.existsSync(nodeModulesDir)) {
      fs.mkdirSync(nodeModulesDir, { recursive: true })
    }

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

      await this.downloadFile(tarballUrl, tempTarball)
      await this.extractTarball(tempTarball, dependencyPath)
      fs.unlinkSync(tempTarball)
    }
  }

  private downloadFile(
    url: string,
    dest: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest)

      const request = https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {

          const redirectUrl = response.headers.location
          if (!redirectUrl) {
            file.close()
            fs.unlinkSync(dest)
            reject(new Error('Redirect location header missing'))
            return
          }
          file.close()
          fs.unlinkSync(dest)
          this.downloadFile(redirectUrl, dest, onProgress).then(resolve).catch(reject)
          return
        }

        if (response.statusCode !== 200) {
          file.close()
          fs.unlinkSync(dest)
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
          return
        }

        const total = parseInt(response.headers['content-length'] || '0', 10)
        let downloaded = 0

        response.on('data', (chunk) => {
          downloaded += chunk.length
          if (onProgress && total > 0) {
            onProgress({
              downloaded,
              total,
              percentage: (downloaded / total) * 100
            })
          }
        })

        response.pipe(file)

        file.on('finish', () => {
          file.close()
          resolve()
        })
      })

      request.setTimeout(60000, () => {
        request.destroy()
        file.close()
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest)
        }
        reject(new Error('Request timeout after 60 seconds'))
      })

      request.on('error', (err) => {
        file.close()
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest)
        }
        reject(err)
      })
    })
  }

  private async extractTarball(tarballPath: string, destDir: string): Promise<void> {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }

    await tar.extract({
      file: tarballPath,
      cwd: destDir,
      strip: 1,
    })
  }
}
