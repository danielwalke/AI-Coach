import { test } from '@playwright/test';

test('Dashboard Screenshot After Login', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes

    console.log('Navigating to signup...');
    await page.goto('http://localhost:5173/signup');
    await page.waitForLoadState('networkidle');

    console.log('Filling form...');
    const uniqueId = Date.now();
    await page.fill('#name', 'Screenshot User');
    await page.fill('#email', `screen${uniqueId}@example.com`);
    await page.fill('#password', 'password123');
    await page.fill('#age', '30');

    console.log('Submitting form...');
    await page.click('button[type="submit"]');

    console.log('Waiting for dashboard...');
    // Wait for URL change
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });

    // Wait for content
    await page.waitForSelector('h1:has-text("Summary")', { state: 'visible', timeout: 30000 });

    const headerText = await page.textContent('h1');
    console.log('Header found:', headerText);

    // Wait for animations to finish
    await page.waitForTimeout(3000);

    console.log('Taking screenshot...');
    await page.screenshot({ path: 'dashboard_after_login.png', fullPage: true });
    console.log('Screenshot saved.');
});
