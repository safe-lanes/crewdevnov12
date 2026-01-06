// API test helper utilities
import request from 'supertest';

// Base URL for API requests
const BASE_URL = 'http://localhost:5000';

/**
 * Create a supertest request wrapper for API testing
 */
export function createApiClient() {
  return request(BASE_URL);
}

/**
 * Helper to make GET requests
 */
export async function apiGet(endpoint: string, token?: string) {
  const req = createApiClient().get(endpoint);
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req;
}

/**
 * Helper to make POST requests
 */
export async function apiPost(endpoint: string, data: any, token?: string) {
  const req = createApiClient()
    .post(endpoint)
    .send(data)
    .set('Content-Type', 'application/json');
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req;
}

/**
 * Helper to make PUT requests
 */
export async function apiPut(endpoint: string, data: any, token?: string) {
  const req = createApiClient()
    .put(endpoint)
    .send(data)
    .set('Content-Type', 'application/json');
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req;
}

/**
 * Helper to make DELETE requests
 */
export async function apiDelete(endpoint: string, token?: string) {
  const req = createApiClient().delete(endpoint);
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req;
}

/**
 * Helper to make PATCH requests
 */
export async function apiPatch(endpoint: string, data: any, token?: string) {
  const req = createApiClient()
    .patch(endpoint)
    .send(data)
    .set('Content-Type', 'application/json');
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req;
}

/**
 * Assert successful response with data
 */
export function expectSuccess(response: request.Response) {
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);
}

/**
 * Assert error response
 */
export function expectError(response: request.Response, status: number) {
  expect(response.status).toBe(status);
}
