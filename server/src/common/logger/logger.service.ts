import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const customFormat = printf(({ level, message, timestamp, stack, context }) => {
  const ctx = context ? `[${context}]` : '';
  const logStack = stack ? `\n${stack}` : '';
  return `${timestamp} [${level}]${ctx} ${message}${logStack}`;
});

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;
  private context?: string;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'debug',
      format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        colorize({ all: false }),
        customFormat,
      ),
      transports: [
        new winston.transports.Console({
          format: combine(
            colorize(),
            timestamp({ format: 'HH:mm:ss.SSS' }),
            customFormat,
          ),
        }),
        new winston.transports.File({
          filename: './logs/lifehub-deepsea.log',
          maxsize: 50 * 1024 * 1024,
          maxFiles: 10,
          tailable: true,
        }),
      ],
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, {
      context: context || this.context,
      stack: trace,
    });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context: context || this.context });
  }
}
