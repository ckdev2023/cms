import { Test, type TestingModule } from '@nestjs/testing';

import {
  type HealthCheckResponse,
  HealthController,
} from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status with ISO timestamp', () => {
    const result: HealthCheckResponse = controller.check();

    expect(result.status).toBe('ok');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
