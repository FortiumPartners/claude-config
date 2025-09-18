import { test, expect } from '@playwright/test';

test('debug dashboard redirect after login', async ({ page }) => {
  // Listen for console logs to catch any errors
  page.on('console', msg => {
    console.log('BROWSER CONSOLE:', msg.type(), msg.text());
  });

  // Listen for page errors
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  // Listen for network requests and responses
  page.on('request', request => {
    if (request.url().includes('auth') || request.url().includes('dashboard')) {
      console.log('REQUEST:', request.method(), request.url());
    }
  });

  page.on('response', response => {
    if (response.url().includes('auth') || response.url().includes('dashboard')) {
      console.log('RESPONSE:', response.status(), response.url());
    }
  });

  // Navigate to login page
  await page.goto('http://localhost:3000/auth/login');
  
  // Wait for page to load completely
  await page.waitForLoadState('networkidle');
  
  console.log('Initial URL:', page.url());

  // Fill login form
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');

  await emailInput.fill('test@example.com');
  await passwordInput.fill('password123');

  console.log('Form filled, about to submit...');

  // Submit the form and wait for navigation or response
  const [response] = await Promise.all([
    page.waitForResponse(response => 
      response.url().includes('/auth/login') && response.request().method() === 'POST'
    ),
    submitButton.click()
  ]);

  console.log('Login response status:', response.status());
  const responseBody = await response.text();
  console.log('Login response body:', responseBody);

  // Wait a bit to see if redirect happens
  await page.waitForTimeout(3000);

  console.log('URL after login attempt:', page.url());

  // Check if we're still on login page or redirected
  if (page.url().includes('/auth/login')) {
    console.log('STILL ON LOGIN PAGE - checking for errors...');
    
    // Check for any error messages
    const errorElements = page.locator('[role="alert"], .error, .text-red-500, .text-danger, .alert-danger');
    const errorCount = await errorElements.count();
    console.log('Error message count:', errorCount);
    
    if (errorCount > 0) {
      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorElements.nth(i).textContent();
        console.log('Error message:', errorText);
      }
    }

    // Check if user is authenticated in local storage
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token'));
    console.log('Access token in localStorage:', accessToken ? 'Present' : 'Missing');
    console.log('Refresh token in localStorage:', refreshToken ? 'Present' : 'Missing');

    // Try to manually navigate to dashboard
    console.log('Attempting manual navigation to dashboard...');
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForTimeout(2000);
    console.log('URL after manual dashboard navigation:', page.url());
  } else {
    console.log('SUCCESSFULLY REDIRECTED to:', page.url());
  }

  // Take final screenshot
  await page.screenshot({ path: 'dashboard-redirect-debug.png', fullPage: true });
});