import { Injectable, LoggerService, LogLevel } from '@nestjs/common'

@Injectable()
export class JsonLogger implements LoggerService {
  private globalContext?: string
  private logLevels: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose']

  constructor(globalContext?: string) {
    this.globalContext = globalContext
  }

  private formatMessage(level: string, message: any, context?: string, extra?: any) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      context: context || this.globalContext || null,
      message,
      ...extra,
    })
  }

  log(message: any, context?: string) {
    if (this.logLevels.includes('log')) {
      console.log(this.formatMessage('log', message, context))
    }
  }

  error(message: any, trace?: string, context?: string) {
    if (this.logLevels.includes('error')) {
      console.error(this.formatMessage('error', message, context, trace ? { trace } : {}))
    }
  }

  warn(message: any, context?: string) {
    if (this.logLevels.includes('warn')) {
      console.warn(this.formatMessage('warn', message, context))
    }
  }

  debug(message: any, context?: string) {
    if (this.logLevels.includes('debug')) {
      console.debug(this.formatMessage('debug', message, context))
    }
  }

  verbose(message: any, context?: string) {
    if (this.logLevels.includes('verbose')) {
      console.info(this.formatMessage('verbose', message, context))
    }
  }

  fatal(message: any, ...optionalParams: any[]) {
    console.error(this.formatMessage('fatal', message, this.globalContext, { optionalParams }))
  }

  setLogLevels(levels: LogLevel[]) {
    this.logLevels = levels
  }
}
