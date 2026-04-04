import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Custom format to display in IST
const timezoned = () => {
    return new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
    });
};

const logDir = process.env.LOG_DIR || './logs';
const logLevel = process.env.LOG_LEVEL || 'info';
const logRetentionDays = process.env.LOG_RETENTION_DAYS || '7d';
const logMaxSize = process.env.LOG_MAX_SIZE || '10m';

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// --- Formats ---
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: timezoned }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        const stackStr = stack ? `\n${stack}` : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}${stackStr}`;
    })
);

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: timezoned }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        const stackStr = stack ? `\n${stack}` : '';
        return `[${timestamp}] ${level}: ${message}${metaStr}${stackStr}`;
    })
);

// --- Transports ---

// Combined application log (all levels)
const applicationTransport = new DailyRotateFile({
    dirname: logDir,
    filename: 'application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: logMaxSize,
    maxFiles: logRetentionDays,
});

// Error-only log
const errorTransport = new DailyRotateFile({
    dirname: logDir,
    filename: 'error-%DATE%.log',
    level: 'error',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: logMaxSize,
    maxFiles: logRetentionDays,
});

// HTTP request access log
const httpTransport = new DailyRotateFile({
    dirname: logDir,
    filename: 'access-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: logMaxSize,
    maxFiles: logRetentionDays,
});

// --- Rotation event listeners (for monitoring) ---
applicationTransport.on('rotate', (oldFilename, newFilename) => {
    logger.info(`Application log rotated: ${path.basename(oldFilename)} → ${path.basename(newFilename)}`);
});

errorTransport.on('rotate', (oldFilename, newFilename) => {
    logger.info(`Error log rotated: ${path.basename(oldFilename)} → ${path.basename(newFilename)}`);
});

httpTransport.on('rotate', (oldFilename, newFilename) => {
    logger.info(`Access log rotated: ${path.basename(oldFilename)} → ${path.basename(newFilename)}`);
});

// --- Main Logger ---
const logger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    transports: [
        new winston.transports.Console({ format: consoleFormat }),
        applicationTransport,
        errorTransport,
    ],
    // Catch uncaught exceptions and unhandled rejections
    exceptionHandlers: [
        new DailyRotateFile({
            dirname: logDir,
            filename: 'exceptions-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: logMaxSize,
            maxFiles: logRetentionDays,
        }),
    ],
    rejectionHandlers: [
        new DailyRotateFile({
            dirname: logDir,
            filename: 'rejections-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: logMaxSize,
            maxFiles: logRetentionDays,
        }),
    ],
    exitOnError: false,
});

// --- HTTP Request Logger (separate for access logs) ---
const httpLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: timezoned }),
        winston.format.printf(({ timestamp, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `[${timestamp}] HTTP: ${message}${metaStr}`;
        })
    ),
    transports: [httpTransport],
});

export { httpLogger };
export default logger;
