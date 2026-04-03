import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';

const API_PREFIX = '/api/v1';

const unauthorizedGetEndpoints = [
  '/api/v1/customers',
  '/api/v1/admin-cases',
  '/api/v1/tax-contracts',
  '/api/v1/invoices',
  '/api/v1/payments',
  '/api/v1/deposits',
  '/api/v1/files',
  '/api/v1/dashboard/summary',
  '/api/v1/system/users',
  '/api/v1/system/roles',
  '/api/v1/logs/audit',
  '/api/v1/logs/login',
] as const;

const loginFailureCases = [
  {
    scenario: 'with invalid credentials',
    body: { username: 'nonexistent', password: 'wrong' },
  },
  {
    scenario: 'without body',
    body: {},
  },
] as const;

const dictionaryEndpoints = [
  '/api/v1/dictionaries',
  '/api/v1/dictionaries/customer_type',
] as const;

describe('Application E2E', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it(`GET ${API_PREFIX}/health should return ok`, () => {
      return request(app.getHttpServer())
        .get(`${API_PREFIX}/health`)
        .expect(200)
        .expect((res) => {
          const body = res.body as {
            code: number;
            data: {
              status: string;
              timestamp: string;
            };
          };

          expect(body.code).toBe(0);
          expect(body.data.status).toBe('ok');
          expect(body.data.timestamp).toBeDefined();
        });
    });
  });

  describe('Auth', () => {
    it(`GET ${API_PREFIX}/auth/me without token should return 401`, () => {
      return request(app.getHttpServer())
        .get(`${API_PREFIX}/auth/me`)
        .expect(401);
    });

    it.each(loginFailureCases)(
      `POST ${API_PREFIX}/auth/login $scenario should return 401`,
      ({ body }) => {
        return request(app.getHttpServer())
          .post(`${API_PREFIX}/auth/login`)
          .send(body)
          .expect(401);
      },
    );
  });

  describe('Protected endpoints without token', () => {
    it.each(unauthorizedGetEndpoints)('GET %s should return 401', (path) => {
      return request(app.getHttpServer()).get(path).expect(401);
    });
  });

  describe('Dictionary endpoints (require auth)', () => {
    it.each(dictionaryEndpoints)(
      'GET %s should return 401 without token',
      (path) => {
        return request(app.getHttpServer()).get(path).expect(401);
      },
    );
  });
});
