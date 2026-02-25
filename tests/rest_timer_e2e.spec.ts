import { test, expect } from '@playwright/test';

test('complete workout flow with rest timer', async ({ page }) => {
    // 1. Register/Login
    console.log('Navigating to root...');
    try {
        await page.goto('http://localhost:5173/', { timeout: 10000 });
    } catch (e) {
        console.log('Root nav failed');
    }

    // Handle potential redirect to login/signup
    await page.waitForLoadState('networkidle');
    console.log('Current URL:', page.url());

    if (page.url().includes('login') || (await page.isVisible('text=Sign In'))) {
        console.log('On Login page');
        // Try to login first, if fails, go to signup
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');

        // Wait to see if we go to dashboard or stay (failed login)
        try {
            await expect(page).toHaveURL('http://localhost:5173/dashboard', { timeout: 5000 });
        } catch {
            console.log('Login failed (likely user does not exist), switching to Signup');
            await page.goto('http://localhost:5173/signup');
            await page.fill('input[type="text"]', 'Test User');
            await page.fill('input[type="email"]', 'test@example.com');
            await page.fill('input[type="password"]', 'password123');
            await page.click('button[type="submit"]');
        }
    } else if (page.url().includes('signup') || (await page.isVisible('text=Create an Account'))) {
        console.log('On Signup page');
        await page.fill('input[type="text"]', 'Test User');
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
    } else if (page.url().includes('dashboard')) {
        console.log('Already on Dashboard');
    }

    // Wait for dashboard
    console.log('Waiting for dashboard...');
    try {
        await expect(page).toHaveURL('http://localhost:5173/dashboard', { timeout: 15000 });
    } catch (e) {
        console.log('Dashboard navigation failed. Current URL:', page.url());
        await page.screenshot({ path: 'dashboard_fail.png' });
        throw e;
    }

    // 2. Start Workout
    console.log('Starting workout...');
    await page.click('text=Start New'); // Link to /training
    await expect(page).toHaveURL('http://localhost:5173/training');

    // Start empty session
    await page.click('button:has-text("Start New Session")');
    // Wait for modal
    await expect(page.locator('text=Start Workout')).toBeVisible();
    // Click "Empty Workout" 
    await page.click('text=Empty Workout');

    // 3. Add Exercise
    console.log('Adding exercise...');
    await page.click('button:has-text("Add Exercise")');

    // Check if there are exercises, or create one
    if (await page.isVisible('text=No exercises found')) {
        console.log('Creating new exercise...');
        await page.fill('input[placeholder="Or create new..."]', 'Bench Press');
        await page.click('button:has(:text-is("Plus"))'); // This selector might be tricky for Lucide icon. 
        // The button has <Plus /> icon. It is the button next to input.
        await page.locator('input[placeholder="Or create new..."] + button').click();

        // Select it (it should appear in list?)
        // The code says "re-fetch or rely on live query". Assuming it appears.
        await page.click('text=Bench Press');
    } else {
        console.log('Selecting first exercise...');
        // Select first button in the list. The list items are buttons.
        // Use a more robust selector.
        await page.locator('.overflow-y-auto button').first().click();
    }

    // 4. Perform Set 1
    console.log('Performing set 1...');
    // Fill weight and reps
    await page.fill('input[placeholder="0"] >> nth=0', '50'); // Weight
    await page.fill('input[placeholder="0"] >> nth=1', '10'); // Reps

    // We are already in "Set" mode by default.
    // The button shows "Start Rest →" which means "Click to start rest".

    // 5. Start Rest Timer
    console.log('Starting rest timer...');

    // 5. Start Rest Timer
    console.log('Starting rest timer...');

    // Use getByRole which is more robust
    const startRestBtn = page.getByRole('button', { name: /Start Rest/i });
    if (await startRestBtn.isVisible()) {
        await startRestBtn.click();
    } else {
        console.log('Start Rest button not visible via getByRole. Trying locator.');
        await page.locator('button').filter({ hasText: 'Start Rest' }).first().click();
    }

    // Wait for rest to accumulate (e.g., 3 seconds)
    await page.waitForTimeout(3000);

    // 6. Start Set 2 (this commits the rest for Set 1)
    console.log('Starting set 2...');

    const startSetBtn = page.getByRole('button', { name: /Start Set/i });
    if (await startSetBtn.isVisible()) {
        await startSetBtn.click();
    } else {
        console.log('Start Set button not visible via getByRole. Trying locator.');
        await page.locator('button').filter({ hasText: 'Start Set' }).first().click();
    }

    // Wait a bit to ensure UI updates
    await page.waitForTimeout(1000);

    // Verify Rest Display
    console.log('Verifying rest display...');

    // Debug rest display
    if (await page.isVisible('text=Rest:')) {
        console.log('Rest text found!');
    } else {
        console.log('Rest text NOT found. Dumping page text...');
        console.log(await page.textContent('body'));
        await page.screenshot({ path: 'rest_fail.png' });
    }

    await expect(page.locator('text=Rest:')).toBeVisible();

    // 7. Finish Workout
    console.log('Finishing workout...');
    await page.click('button:has-text("Finish")');

    // Verify Summary Modal
    await expect(page.locator('text=Workout Complete!')).toBeVisible();
    await page.click('button:has-text("Continue")');

    // 8. Verify Dashboard History
    console.log('Verifying dashboard history...');
    // Click the top item in Recent Workouts (first GlassCard in list)
    // Use a robust selector: Find the section with "Recent Workouts", then find the first card inside it.
    // .card is used for GlassCard often, or just check the container.
    // In Dashboard.tsx: <div className="flex flex-col gap-3 max-h-[500px] ..."> ... <GlassCard ...>

    // We can target the section by heading content
    const recentWorkoutsSection = page.locator('section').filter({ hasText: 'Recent Workouts' });
    await recentWorkoutsSection.locator('div[class*="gap-3"] > div').first().click();

    // Check for Rest time in details
    console.log('Checking details modal for Rest time...');
    // The modal details has "Rest: X:XX"
    await expect(page.locator('text=Rest:')).toBeVisible();
    console.log('Test completed successfully!');
});
