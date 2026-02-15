import { test, expect } from '@playwright/test';

test('Full User Flow & Chart Inspection', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Create Test User (Sign Up)
    const uniqueId = Date.now();
    await page.goto('http://localhost:5173/signup');
    await page.fill('input[id="name"]', 'Test Account');
    await page.fill('input[id="email"]', `test${uniqueId}@example.com`); // Test Mail
    await page.fill('input[id="password"]', 'password123'); // Test Pwd
    await page.fill('input[id="age"]', '25');
    await page.click('button[type="submit"]');

    // 2. Verify Dashboard - Wait for DB (Longer wait)
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await page.screenshot({ path: 'screenshots/functional_dashboard_empty.png', fullPage: true });

    // 3. Start Workout to Generate Data
    await page.click('a[href="/training"]');
    await page.click('button:has-text("Start New Session")');

    // Add Exercise
    await page.click('button:has-text("Add Exercise")');
    await page.click('button:has-text("Bench Press")');

    // Complete a Set (Important for Chart)
    const setRows = page.getByTestId('set-row');
    await setRows.nth(0).locator('input').first().fill('100'); // Weight
    await setRows.nth(0).locator('input').last().fill('5'); // Reps
    await setRows.nth(0).locator('button').first().click(); // Check

    // Finish
    await page.click('button:has-text("Finish")');

    // 4. Verify Dashboard & Chart HTML
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Check Chart Container
    const chartContainer = page.locator('[data-testid="chart-container"]');
    await expect(chartContainer).toBeVisible();

    // Inspect HTML for Chart Drawing
    const chartPath = chartContainer.locator('path.recharts-line-curve');
    await expect(chartPath).toBeVisible();

    const dAttribute = await chartPath.getAttribute('d');
    console.log('Chart Path D:', dAttribute);
    expect(dAttribute).toBeTruthy();
    expect(dAttribute?.length).toBeGreaterThan(10);

    // 5. Verify Stats Cards
    await expect(page.locator('text=Current Streak')).toBeVisible();
    await expect(page.locator('text=1 days')).toBeVisible();

    // Final Screenshot
    await page.screenshot({ path: 'screenshots/functional_dashboard_populated.png', fullPage: true });
});
