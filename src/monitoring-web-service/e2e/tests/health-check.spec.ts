import { test, expect } from '@playwright/test';

test.describe('Health Check Tests', () => {
  test('backend health endpoint should return OK', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('frontend should load successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/External Metrics/i);
  });

  test('API should be accessible', async ({ request }) => {
    const response = await request.get('/api/v1/auth/sso/providers/demo-org');
    expect(response.status()).toBe(200);
  });
});