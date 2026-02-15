import { test, expect } from '@playwright/test';

test('User can register, log workout, and view progress', async ({ page }) => {
    const timestamp = Date.now();
    const email = `testuser${timestamp}@example.com`;
    const password = 'password123';
    const exerciseName = `Bench Press ${timestamp}`;

    // 1. Register
    await page.goto('http://localhost:5173/signup');
    await page.fill('#name', 'Test User');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#age', '25');
    await page.click('button[type="submit"]');

    // Wait for Dashboard
    await expect(page).toHaveURL(/.*dashboard/);

    // 2. Go to Training
    await page.click('a[href="/training"]');
    await expect(page).toHaveURL(/.*training/);

    // 3. Start Session
    await page.click('button:has-text("Start New Session")');

    // 4. Add Exercise
    await page.click('button:has-text("Add Exercise")');

    // Create Custom Exercise
    await page.fill('input[placeholder="Or create new..."]', exerciseName);
    await page.click('button:has-text("+")');

    // Search and Select
    await page.fill('input[placeholder="Search exercise..."]', exerciseName);
    await page.click(`button:has-text("${exerciseName}")`);

    // 5. Add Set & Complete it
    await expect(page.locator('input[placeholder="0"]').first()).toBeVisible();

    await page.fill('input[placeholder="0"] >> nth=0', '100'); // Weight
    await page.fill('input[placeholder="0"] >> nth=1', '10');  // Reps

    // Click check button (using class .lucide-check inside button)
    await page.locator('button:has(.lucide-check)').click();

    // 6. Finish Session
    await page.click('button:has-text("Finish")');

    // 7. Verify Dashboard & Chart
    await expect(page).toHaveURL(/.*dashboard/);

    // specific wait for chart
    await expect(page.locator('text=Progress')).toBeVisible();

    // Select the exercise we just used
    // The select element should contain our exercise name
    // Wait for select to be populated
    const select = page.locator('select');
    await expect(select).toBeVisible();
    await expect(select).toContainText(exerciseName);

    await select.selectOption({ label: exerciseName });

    // Check if chart has data. 
    // ProgressChart renders "No data yet" if empty.
    // We expect it NOT to be there.
    await expect(page.locator('text=No data yet')).not.toBeVisible();
});
