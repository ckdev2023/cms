import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'
import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter'
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor'

describe('Application E2E', () => {
  let app: INestApplication<App>

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new AllExceptionsFilter())
    app.useGlobalInterceptors(new TransformInterceptor())
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Health Check', () => {
    it('GET /api/v1/health should return ok', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(0)
          expect(res.body.data.status).toBe('ok')
          expect(res.body.data.timestamp).toBeDefined()
        })
    })
  })

  describe('Auth', () => {
    it('GET /api/v1/auth/me without token should return 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401)
    })

    it('POST /api/v1/auth/login with invalid credentials should return 401', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: 'nonexistent', password: 'wrong' })
        .expect(401)
    })

    it('POST /api/v1/auth/login without body should return 401', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(401)
    })
  })

  describe('Protected endpoints without token', () => {
    it('GET /api/v1/customers should return 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/customers')
        .expect(401)
    })

    it('GET /api/v1/admin-cases should return 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin-cases')
        .expect(401)
    })

    it('GET /api/v1/tax-contracts should return 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/tax-contracts')
        .expect(401)
    })

    it('GET /api/v1/invoices should return 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/invoices')
        .expect(401)
    })

    it('GET /api/v1/payments should return 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/payments')
        .expect(401)
    })

    it('GET /api/v1/deposits should return 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/deposits')
        .expect(401)
    })

    it('GET /api/v1/files should return 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/files')
        .expect(401)
    })

    it('GET /api/v1/dashboard/summary should return 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/dashboard/summary')
        .expect(401)
    })

    it('GET /api/v1/system/users should return 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/system/users')
        .expect(401)
    })

    it('GET /api/v1/system/roles should return 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/system/roles')
        .expect(401)
    })

    it('GET /api/v1/logs/audit should return 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/logs/audit')
        .expect(401)
    })

    it('GET /api/v1/logs/login should return 401', () => {
      return request(app.getHttpServer())
        .get('/api/v1/logs/login')
        .expect(401)
    })
  })

  describe('Dictionary endpoints (require auth)', () => {
    it('GET /api/v1/dictionaries should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/dictionaries')
        .expect(401)
    })

    it('GET /api/v1/dictionaries/customer_type should return 401 without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/dictionaries/customer_type')
        .expect(401)
    })
  })
})
