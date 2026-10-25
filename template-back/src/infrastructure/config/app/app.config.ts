import { FastifyCorsOptions } from '@fastify/cors'
import { boolEnv, intEnv, isProduction } from '@infrastructure/config/env.util'
import { registerAs } from '@nestjs/config'

function parseOrigins(origins?: string): string[] {
  return (origins ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

function buildCorsOptions(allowedOrigins: string[]): FastifyCorsOptions {
  return {
    // Requests without an Origin (curl, server-to-server) get no CORS headers; browsers must match the allow-list exactly.
    origin: (origin, callback) => {
      callback(null, !!origin && allowedOrigins.includes(origin))
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }
}

export const appConfig = registerAs('AppConfig', () => {
  const allowedOrigins = parseOrigins(process.env.CORS_ORIGINS)
  if (isProduction() && allowedOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must list the allowed frontend origin(s) in production')
  }
  if (allowedOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS must not contain "*": credentials are enabled, list explicit origins')
  }
  return {
    environment: process.env.NODE_ENV || 'production',
    port: process.env.APP_PORT ? Number(process.env.APP_PORT) : undefined,
    allowedOrigins,
    buildCorsOptions,
    /** Only enable behind a reverse proxy you control: it makes X-Forwarded-For (the rate-limit key) trusted. */
    trustProxy: boolEnv('TRUST_PROXY', false),
    bodyLimitBytes: intEnv('BODY_LIMIT_BYTES', 102400, 1024),
  }
})
