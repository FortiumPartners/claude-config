import { test, expect } from '@playwright/test';

test('debug login page', async ({ page }) => {
  // Navigate to login page
  await page.goto('http://localhost:3000/auth/login');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Take a screenshot to see the current state
  await page.screenshot({ path: 'login-page-debug.png', fullPage: true });
  
  // Check if login form exists
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
  const passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]');
  const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Submit")');
  
  console.log('Email input exists:', await emailInput.count());
  console.log('Password input exists:', await passwordInput.count());
  console.log('Submit button exists:', await submitButton.count());
  
  // Check for any errors or messages on the page
  const errorMessages = page.locator('[role="alert"], .error, .text-red-500, .text-danger, .alert-danger');
  console.log('Error messages:', await errorMessages.count());
  
  if (await errorMessages.count() > 0) {
    console.log('Error text:', await errorMessages.first().textContent());
  }
  
  // Try to fill and submit if form exists
  if (await emailInput.count() > 0 && await passwordInput.count() > 0 && await submitButton.count() > 0) {
    await emailInput.first().fill('test@example.com');
    await passwordInput.first().fill('password123');
    
    // Take screenshot before submitting
    await page.screenshot({ path: 'before-submit.png', fullPage: true });
    
    // Monitor network requests
    page.on('request', request => {
      if (request.url().includes('/auth/')) {
        console.log('AUTH REQUEST:', request.method(), request.url());
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/auth/')) {
        console.log('AUTH RESPONSE:', response.status(), response.url());
      }
    });
    
    await submitButton.first().click();
    
    // Wait a bit to see what happens
    await page.waitForTimeout(2000);
    
    // Take screenshot after submitting
    await page.screenshot({ path: 'after-submit.png', fullPage: true });
    
    console.log('Current URL after submit:', page.url());
  } else {
    console.log('Login form not found!');
  }
});