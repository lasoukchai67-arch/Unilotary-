import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { Ctx } from './lib/context.js';
import { AppError } from './lib/errors.js';
import { authRoutes } from './modules/auth.js';
import { userRoutes } from './modules/users.js';
import { drawRoutes } from './modules/draws.js';
import { ticketRoutes } from './modules/tickets.js';
import { walletRoutes } from './modules/wallet.js';
import { notificationRoutes } from './modules/notifications.js';
import { adminRoutes } from './modules/admin.js';

export async function buildApp(ctx: Ctx) {
  const app = Fastify({
    logger: ctx.config.NODE_ENV === 'test' ? false : { level: 'info', redact: ['req.headers.authorization', 'req.body.pin', 'req.body.code'] },
    trustProxy: true,
    bodyLimit: 1024 * 1024,
    genReqId: () => crypto.randomUUID(),
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: ctx.config.CORS_ORIGINS ? ctx.config.CORS_ORIGINS.split(',').map((s) => s.trim()) : false,
    credentials: false,
  });
  if (ctx.config.RATE_LIMIT_ENABLED) await app.register(rateLimit, {
    global: true,
    max: ctx.config.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    redis: ctx.redis,
    nameSpace: 'rl:',
    skipOnError: true,
    errorResponseBuilder: (_req, c) => ({ statusCode: 429, error: 'RATE_LIMITED', message: `ຄຳຂໍຫຼາຍເກີນໄປ ກະລຸນາລອງໃໝ່ໃນ ${Math.ceil(c.ttl / 1000)} ວິນາທີ` }),
  });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 } });
  await app.register(swagger, {
    openapi: {
      info: { title: 'Lao Development Lottery API', version: '2.0.0' },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
      security: [{ bearer: [] }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.status).send({ error: err.code, message: err.message, details: err.details });
    }
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.status(400).send({ error: 'VALIDATION', message: 'ຂໍ້ມູນບໍ່ຖືກຕ້ອງ', details: err.validation });
    }
    if (err.statusCode === 429) {
      return reply.status(429).send({ error: 'RATE_LIMITED', message: err.message });
    }
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.status(err.statusCode).send({ error: 'VALIDATION', message: err.message });
    }
    req.log.error(err);
    return reply.status(500).send({ error: 'INTERNAL', message: 'ລະບົບຂັດຂ້ອງ ກະລຸນາລອງໃໝ່' });
  });
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: 'NOT_FOUND', message: 'ບໍ່ພົບ' }));

  app.get('/health', { config: { rateLimit: false } }, async () => ({ ok: true }));
  app.get('/ready', { config: { rateLimit: false } }, async (_req, reply) => {
    try {
      await Promise.all([ctx.db.query('SELECT 1'), ctx.redis.ping()]);
      return { ok: true };
    } catch {
      return reply.status(503).send({ ok: false });
    }
  });

  authRoutes(app, ctx);
  userRoutes(app, ctx);
  drawRoutes(app, ctx);
  ticketRoutes(app, ctx);
  walletRoutes(app, ctx);
  notificationRoutes(app, ctx);
  adminRoutes(app, ctx);

  return app;
}
