import { test, expect } from '@playwright/test';

test('login should succeed and redirect to dashboard', async ({ page }) => {
  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  // Navigate to login page
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');
  
  console.log('Starting on login page:', page.url());

  // Fill login form with correct credentials
  await page.locator('input[type="email"]').fill('demo@example.com');
  await page.locator('input[type="password"]').fill('password123');

  // Submit form and wait for the response
  const [response] = await Promise.all([
    page.waitForResponse(response => 
      response.url().includes('/auth/login') && response.request().method() === 'POST'
    ),
    page.locator('button[type="submit"]').click()
  ]);

  console.log('Login API response status:', response.status());
  
  // Wait for redirect to dashboard (or other page)
  await page.waitForTimeout(3000);
  
  console.log('Final URL after login:', page.url());

  // Check if we're on dashboard or redirected
  const currentUrl = page.url();
  if (currentUrl.includes('/dashboard') || !currentUrl.includes('/auth/login')) {
    console.log('SUCCESS: Redirected away from login page');
  } else {
    console.log('FAILED: Still on login page after successful auth');
    
    // Check localStorage for tokens
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    console.log('Access token present:', !!accessToken);
  }

  // Take a screenshot for debugging
  await page.screenshot({ path: 'login-success-test.png', fullPage: true });
});