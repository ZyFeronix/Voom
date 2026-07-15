/**
 * VSocial Structured Logger
 * Uses Pino for production-grade logging
 */
import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
	level: process.env.LOG_LEVEL || 'info',
	transport: isDev
		? {
				target: 'pino-pretty',
				options: {
					colorize: true,
					translateTime: 'HH:MM:ss Z',
					ignore: 'pid,hostname'
				}
			}
		: undefined,
	formatters: {
		level(label) {
			return { level: label };
		}
	}
});
