import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Mock PrismaClient before it's used in uploadRoutes to prevent DB connection errors.
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    client: {
      findMany: jest.fn().mockRejectedValue(new Error('Simulated DB Error')),
    },
  })),
}));

import uploadRoutes from '../src/routes/upload';

let app: express.Application;

// Before all tests, set up a test express app
beforeAll(() => {
  app = express();
  app.use(express.json());
  // Mount the upload routes. We assume they are at '/api/upload' in the real app.
  // If this prefix is different, this path needs to be updated.
  app.use('/api/upload', uploadRoutes); 
  
  // Set a dummy secret for testing. This must match what the auth middleware expects.
  process.env.ADMIN_AUTH_SECRET = 'test-secret';
});

describe('Authentication on protected routes', () => {
  // We use '/api/upload/clients' as an example of a protected route.
  const protectedRoute = '/api/upload/clients';

  it('should return 401 Unauthorized if no token is provided', async () => {
    const res = await request(app).get(protectedRoute);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ status: 'error', message: 'Authentication required' });
  });

  it('should return 403 Forbidden if an invalid token is provided', async () => {
    const res = await request(app)
      .get(protectedRoute)
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ status: 'error', message: 'Invalid or expired token' });
  });

  it('should return 403 Forbidden if token is expired', async () => {
    const expiredToken = jwt.sign({ userId: '123', type: 'admin' }, process.env.ADMIN_AUTH_SECRET!, { expiresIn: '-1s' });
    const res = await request(app)
      .get(protectedRoute)
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ status: 'error', message: 'Invalid or expired token' });
  });

  // This test checks if authentication passes.
  // The underlying route handler will likely fail because it depends on a database connection
  // which is not available in this test setup. A 500 error from the route handler
  // indicates that the request successfully passed the authentication middleware.
  it('should pass authentication with a valid token and proceed to the route handler', async () => {
    // Suppress console.error for this test since we expect an error to be logged.
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const token = jwt.sign({ userId: '12alicesmith', type: 'admin' }, process.env.ADMIN_AUTH_SECRET!, { expiresIn: '1h' });
    const res = await request(app)
      .get(protectedRoute)
      .set('Authorization', `Bearer ${token}`);
    
    // We expect a 500 error because the Prisma client is mocked to throw an error.
    // This proves authentication was successful and the request was passed to the handler.
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Failed to fetch clients');

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });
});
