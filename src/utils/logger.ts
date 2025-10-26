export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

export class Logger {
  private static level: LogLevel = LogLevel.ERROR

  static setLevel(level: LogLevel): void {
    this.level = level
  }

  static getLevel(): LogLevel {
    return this.level
  }

  static error(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.ERROR && this.level !== LogLevel.NONE) {
      console.error(message, ...args)
    }
  }

  static warn(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(message, ...args)
    }
  }

  static info(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.INFO) {
      console.log(message, ...args)
    }
  }

  static debug(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(message, ...args)
    }
  }
}
