import { test, expect } from '@playwright/test';

test('Coach Integration & Dashboard Motivation', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Create Test User
    const uniqueId = Date.now();
    await page.goto('http://localhost:5173/signup');
    await page.fill('input[id="name"]', 'Coach Test User');
    await page.fill('input[id="email"]', `coach${uniqueId}@example.com`);
    await page.fill('input[id="password"]', 'password123');
    await page.fill('input[id="age"]', '30');
    await page.click('button[type="submit"]');

    // 2. Verify Dashboard Motivation
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    // Check for the motivation banner text
    await expect(page.locator('text=You are better than')).toBeVisible();
    await expect(page.locator('text=Performance Insight')).toBeVisible();

    // 3. Navigate to AI Coach
    await page.click('a[href="/health-coach"]');
    await expect(page).toHaveURL(/.*\/health-coach/);

    // 4. Verify Coach UI
    // Check for suggestions
    await expect(page.locator('text=Create a 30-minute HIIT workout')).toBeVisible();
    await expect(page.locator('text=Analyze my last week\'s training load')).toBeVisible();

    // Check for full height container (approximate check via class or structure)
    // We expect the chat container to be visible and hopefully take space
    const chatCard = page.locator('.flex-1.h-full'); // The class we added to CoachChat in HealthCoach.tsx
    // Wait, we added `className="flex-1 h-full"` to CoachChat in HealthCoach.tsx
    // And CoachChat uses it in GlassCard.
    await expect(chatCard).toBeVisible();

    // 5. Test Suggestion Click
    await page.click('text=Create a 30-minute HIIT workout');
    // It should populate the textarea
    const textarea = page.locator('textarea');
    await expect(textarea).toHaveValue('Create a 30-minute HIIT workout');

    // 6. Test Sending Message (Mocking response or just sending)
    // We can't easily mock the backend response here without intercepting, 
    // but we can try to send and see if it adds a user message.
    await page.click('button[aria-label="Send message"]');
    // Actually the button has <Send size={18} />.
    // Let's click the button that is not disabled (assuming text is there)
    // Or just press Enter in textarea
    await textarea.press('Enter');

    // Expect user message to appear
    await expect(page.locator('div.bg-primary.text-white').locator('text=Create a 30-minute HIIT workout')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/coach_integration.png' });
});
