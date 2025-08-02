import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('WorkflowController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/v1/workflows (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/workflows')
      .expect(200)
      .expect((res) => {
        expect(res.body.workflows).toBeDefined();
        expect(Array.isArray(res.body.workflows)).toBe(true);
      });
  });

  it('/api/v1/workflows/execute (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/workflows/execute')
      .send({
        workflowId: 'sample-workflow',
        data: {
          test: true,
          message: 'Test workflow execution',
        },
      })
      .expect(202)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.instanceId).toBeDefined();
        expect(res.body.message).toBe('Workflow iniciado exitosamente');
      });
  });

  it('/api/v1/workflows/execute (POST) - invalid workflow', () => {
    return request(app.getHttpServer())
      .post('/api/v1/workflows/execute')
      .send({
        workflowId: 'invalid-workflow',
        data: {},
      })
      .expect(400);
  });

  it('/api/v1/workflows/execute (POST) - validation error', () => {
    return request(app.getHttpServer())
      .post('/api/v1/workflows/execute')
      .send({
        // workflowId faltante
        data: {},
      })
      .expect(400);
  });
});
