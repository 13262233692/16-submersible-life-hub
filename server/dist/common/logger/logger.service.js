"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
const common_1 = require("@nestjs/common");
const winston = require("winston");
const { combine, timestamp, printf, colorize, errors } = winston.format;
const customFormat = printf(({ level, message, timestamp, stack, context }) => {
    const ctx = context ? `[${context}]` : '';
    const logStack = stack ? `\n${stack}` : '';
    return `${timestamp} [${level}]${ctx} ${message}${logStack}`;
});
let LoggerService = class LoggerService {
    logger;
    context;
    constructor() {
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'debug',
            format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), colorize({ all: false }), customFormat),
            transports: [
                new winston.transports.Console({
                    format: combine(colorize(), timestamp({ format: 'HH:mm:ss.SSS' }), customFormat),
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
    setContext(context) {
        this.context = context;
    }
    log(message, context) {
        this.logger.info(message, { context: context || this.context });
    }
    error(message, trace, context) {
        this.logger.error(message, {
            context: context || this.context,
            stack: trace,
        });
    }
    warn(message, context) {
        this.logger.warn(message, { context: context || this.context });
    }
    debug(message, context) {
        this.logger.debug(message, { context: context || this.context });
    }
    verbose(message, context) {
        this.logger.verbose(message, { context: context || this.context });
    }
};
exports.LoggerService = LoggerService;
exports.LoggerService = LoggerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], LoggerService);
//# sourceMappingURL=logger.service.js.map