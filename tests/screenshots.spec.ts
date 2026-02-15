import { test } from '@playwright/test';

test('Capture All Screens', async ({ page }) => {
    // Clear DB to ensure clean state
    await page.goto('http://localhost:5173/');
    await page.evaluate(() => {
        window.indexedDB.deleteDatabase('FitnessDB');
    });
    await page.reload();

    // 1. Signup Screen
    await page.goto('http://localhost:5173/signup');
    await page.waitForSelector('input[id="name"]');
    await page.screenshot({ path: 'screenshots/01_signup.png', fullPage: true });

    // 2. Login Screen
    await page.goto('http://localhost:5173/login');
    await page.waitForSelector('input[id="email"]');
    await page.screenshot({ path: 'screenshots/02_login.png', fullPage: true });

    // Perform Signup (Fresh)
    const uniqueId = Date.now();
    await page.goto('http://localhost:5173/signup');
    await page.fill('input[id="name"]', 'Visual Test');
    await page.fill('input[id="email"]', `visual${uniqueId}@example.com`);
    await page.fill('input[id="password"]', 'password123');
    await page.fill('input[id="age"]', '28');
    await page.click('button[type="submit"]');

    // 3. Dashboard (Empty)
    await page.waitForURL(/.*\/dashboard/, { timeout: 15000 });
    // Wait for name to appear to ensure loading finished
    await page.waitForSelector('text=Visual Test');
    await page.screenshot({ path: 'screenshots/03_dashboard_empty.png', fullPage: true });

    // 4. Active Session (Empty)
    await page.click('a[href="/training"]');
    await page.click('button:has-text("Start New Session")');
    await page.waitForSelector('text=00:00'); // Wait for timer
    await page.screenshot({ path: 'screenshots/04_active_session_empty.png', fullPage: true });

    // 5. Exercise Selector
    await page.click('button:has-text("Add Exercise")');
    await page.waitForSelector('text=Select Exercise');
    await page.screenshot({ path: 'screenshots/05_exercise_selector.png', fullPage: true });

    // Select and Populated Session
    await page.click('button:has-text("Bench Press")');
    await page.waitForSelector('text=Bench Press'); // Wait for exercise card
    await page.click('button:has-text("Add Set")');
    await page.screenshot({ path: 'screenshots/06_active_session_populated.png', fullPage: true });

    // Finish
    await page.click('button:has-text("Finish")');

    // 6. Dashboard (Populated)
    await page.waitForURL(/.*\/dashboard/);
    await page.click('text=Progress'); // Click meaningful element to ensure interactivity? No need.
    await page.screenshot({ path: 'screenshots/07_dashboard_populated.png', fullPage: true });

    // 7. Workout Details Modal
    await page.click('button:has-text("Details >")');
    await page.waitForSelector('h2:has-text("Workout Details")');
    await page.screenshot({ path: 'screenshots/08_workout_details_modal.png', fullPage: true });
    await page.locator('.fixed button').first().click(); // Close

    // 8. Profile
    await page.click('a[href="/profile"]');
    await page.waitForSelector('text=Profile');
    await page.screenshot({ path: 'screenshots/09_profile.png', fullPage: true });
});
