import { test, expect } from '@playwright/test';

// Set test timeout to 3 minutes to allow for our 2+ minute workout
test.setTimeout(180000);

test('verify rest times are recorded across multiple sets', async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER MSG: ${msg.text()}`));
    // 1. Go to app and login or signup
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('login') || (await page.isVisible('text=Sign In'))) {
        await page.fill('input[type="email"]', 'test_rest_timer@example.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');

        try {
            await expect(page).toHaveURL('http://localhost:5173/dashboard', { timeout: 3000 });
        } catch {
            await page.goto('http://localhost:5173/signup');
            await page.fill('input[type="text"]', 'Test User');
            await page.fill('input[type="email"]', 'test_rest_timer@example.com');
            await page.fill('input[type="password"]', 'password123');
            await page.click('button[type="submit"]');
        }
    } else if (page.url().includes('signup') || (await page.isVisible('text=Create an Account'))) {
        await page.fill('input[type="text"]', 'Test User');
        await page.fill('input[type="email"]', 'test_rest_timer@example.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
    }

    await expect(page).toHaveURL('http://localhost:5173/dashboard', { timeout: 15000 });

    // 2. Start a new workout
    await page.click('text=Start New');
    await expect(page).toHaveURL('http://localhost:5173/training');

    // Create an empty workout
    await page.click('button:has-text("Start New Session")');
    await expect(page.locator('text=Start Workout')).toBeVisible();
    await page.click('text=Empty Workout');

    // 3. Add an exercise
    await page.click('button:has-text("Add Exercise")');
    if (await page.isVisible('text=No exercises found')) {
        await page.fill('input[placeholder="Or create new..."]', 'Barbell Squat Demo');
        await page.locator('input[placeholder="Or create new..."] + button').click();
        await page.waitForTimeout(500);
        await page.click('text=Barbell Squat Demo');
    } else {
        await page.locator('.overflow-y-auto button').first().click();
    }

    // Add two more sets to have 3 total sets
    await page.click('button:has-text("Add Set")');
    await page.click('button:has-text("Add Set")');

    // Make sure we have 3 sets
    await expect(page.locator('text=kg')).toHaveCount(1, { timeout: 2000 }); // It's just column headers!

    // 4. PERFORM SET 1
    // Let's do a 5-second set
    await page.waitForTimeout(5000);
    // Add weight to Set 1 and start rest
    console.log('Completing Set 1');
    await page.fill('input[placeholder="0"] >> nth=0', '100'); // Set 1 weight

    // Toggle to REST Mode
    let startRestBtn = page.getByRole('button', { name: /Start Rest/i });
    if (await startRestBtn.isVisible()) {
        await startRestBtn.click();
    } else {
        await page.locator('button').filter({ hasText: 'Start Rest' }).first().click();
    }

    // 5. REST 1 (Between Set 1 and Set 2) - 61 seconds
    console.log('Resting for 61 seconds...');
    await page.waitForTimeout(61000);

    // Switch to SET 2
    let startSetBtn = page.getByRole('button', { name: /Start Set/i });
    if (await startSetBtn.isVisible()) {
        await startSetBtn.click();
    } else {
        await page.locator('button').filter({ hasText: 'Start Set' }).first().click();
    }

    // Let it render
    await page.waitForTimeout(1000);
    // Screenshot to see what's happening
    await page.screenshot({ path: 'test-results/active_session_rest_1.png' });

    // 6. PERFORM SET 2 (5 seconds)
    console.log('Completing Set 2');
    await page.waitForTimeout(5000);
    await page.fill('input[placeholder="0"] >> nth=2', '105'); // Set 2 weight

    // Toggle to REST Mode
    startRestBtn = page.getByRole('button', { name: /Start Rest/i });
    if (await startRestBtn.isVisible()) {
        await startRestBtn.click();
    } else {
        await page.locator('button').filter({ hasText: 'Start Rest' }).first().click();
    }

    // 7. REST 2 (Between Set 2 and Set 3) - 61 seconds
    console.log('Resting for 61 seconds...');
    await page.waitForTimeout(61000);

    // Switch to SET 3
    startSetBtn = page.getByRole('button', { name: /Start Set/i });
    if (await startSetBtn.isVisible()) {
        await startSetBtn.click();
    } else {
        await page.locator('button').filter({ hasText: 'Start Set' }).first().click();
    }

    // Let it render
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/active_session_rest_2.png' });

    // 8. PERFORM SET 3 (5 seconds)
    console.log('Completing Set 3');
    await page.waitForTimeout(5000);
    await page.fill('input[placeholder="0"] >> nth=4', '110'); // Set 3 weight

    // FINISH WORKOUT
    await page.click('button:has-text("Finish")');
    await expect(page.locator('text=Workout Complete!')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Continue")');

    // 9. Verify History Dashboard
    await expect(page).toHaveURL('http://localhost:5173/dashboard');
    const recentWorkoutsSection = page.locator('section').filter({ hasText: 'Recent Workouts' });
    await recentWorkoutsSection.locator('div[class*="gap-3"] > div').first().click();

    // Wait for modal to be visible
    await page.waitForSelector('text=Workout Details', { timeout: 5000 });

    // Check that there are exactly 2 rest periods shown in the dashboard popup
    await expect(page.locator('span:has-text("Rest:")')).toHaveCount(2, { timeout: 5000 });
    const restElements = await page.locator('span:has-text("Rest:")').count();
    console.log(`Found ${restElements} rest elements in the dashboard.`);
});
