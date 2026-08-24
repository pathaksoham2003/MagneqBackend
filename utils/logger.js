import winston from "winston";

// Custom format to display IST time
const timezoned = () => {
    return new Date().toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
    });
};

const logLevel = process.env.LOG_LEVEL || "info";

// Console Log Format
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: timezoned }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaStr =
            Object.keys(meta).length > 0
                ? ` ${JSON.stringify(meta)}`
                : "";

        const stackStr = stack ? `\n${stack}` : "";

        return `[${timestamp}] ${level}: ${message}${metaStr}${stackStr}`;
    })
);

// Main Logger
const logger = winston.createLogger({
    level: logLevel,
    format: consoleFormat,
    transports: [
        new winston.transports.Console(),
    ],
    exceptionHandlers: [
        new winston.transports.Console(),
    ],
    rejectionHandlers: [
        new winston.transports.Console(),
    ],
    exitOnError: false,
});

// HTTP Logger
const httpLogger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: timezoned }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr =
                Object.keys(meta).length > 0
                    ? ` ${JSON.stringify(meta)}`
                    : "";

            return `[${timestamp}] ${level}: ${message}${metaStr}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
    ],
});

export { httpLogger };
export default logger;