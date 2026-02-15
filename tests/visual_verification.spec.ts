import { test } from '@playwright/test';

test('Robust Visual Verification', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Signup with unique user
    const uniqueId = Date.now();
    await page.goto('http://localhost:5173/signup');
    await page.fill('input[id="name"]', 'Visual User');
    await page.fill('input[id="email"]', `visual${uniqueId}@example.com`);
    await page.fill('input[id="password"]', 'password123');
    await page.fill('input[id="age"]', '30');
    await page.click('button[type="submit"]');

    // 2. Wait for Dashboard explicitly
    // Wait for the URL to change
    await page.waitForURL(/.*\/dashboard/, { timeout: 15000 });

    // Wait for specific Dashboard content to be visible
    // "Summary" is the h1 on the dashboard
    await page.waitForSelector('h1:has-text("Summary")', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('text=Visual User', { state: 'visible' });

    // Small delay for any animations/transitions to settle
    await page.waitForTimeout(2000);

    // Take Dashboard Screenshot
    await page.screenshot({ path: 'screenshots/FINAL_dashboard_empty.png', fullPage: true });

    // 3. Add Data
    await page.click('a[href="/training"]');
    await page.waitForSelector('text=Recent Sessions', { state: 'visible' }); // Wait for training page
    await page.click('button:has-text("Start New Session")');

    await page.waitForSelector('text=00:00', { state: 'visible' }); // Timer
    await page.screenshot({ path: 'screenshots/FINAL_active_session.png', fullPage: true });

    // Add Exercise
    await page.click('button:has-text("Add Exercise")');
    await page.waitForSelector('text=Select Exercise', { state: 'visible' }); // Modal
    await page.waitForTimeout(1000); // Wait for modal animation
    await page.screenshot({ path: 'screenshots/FINAL_exercise_selector.png', fullPage: true });

    await page.click('button:has-text("Bench Press")');
    await page.click('button:has-text("Add Set")');
    await page.click('button:has-text("Finish")');

    // 4. Populated Dashboard
    await page.waitForURL(/.*\/dashboard/);
    await page.waitForSelector('h1:has-text("Summary")', { state: 'visible' });
    await page.waitForTimeout(2000); // Wait for chart animation
    await page.screenshot({ path: 'screenshots/FINAL_dashboard_populated.png', fullPage: true });

    // 5. Workout Details Modal
    await page.click('button:has-text("Details >")');
    await page.waitForSelector('h2:has-text("Workout Details")', { state: 'visible' });
    await page.waitForTimeout(1000); // Modal animation
    await page.screenshot({ path: 'screenshots/FINAL_workout_details.png', fullPage: true });
});
