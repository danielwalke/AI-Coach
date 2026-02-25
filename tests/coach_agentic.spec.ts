import { test, expect } from '@playwright/test';

test('Coach Agentic Loop & Best Practices', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for multiple LLM turns

    // 1. Create Test User
    const uniqueId = Date.now();
    await page.goto('http://localhost:5173/signup');
    await page.fill('input[id="name"]', 'Agentic Test User');
    await page.fill('input[id="email"]', `agent${uniqueId}@example.com`);
    await page.fill('input[id="password"]', 'password123');
    await page.fill('input[id="age"]', '28');
    await page.click('button[type="submit"]');

    // 2. Navigate to AI Coach
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
    await page.click('a[href="/health-coach"]');
    await expect(page).toHaveURL(/.*\/health-coach/);

    // 3. Send Agentic Request
    // This request requires:
    // a) Listing exercises (Tool 1)
    // b) Creating a template (Tool 2)
    // The agent must loop to do both.
    const complexPrompt = "Please list 3 best chest exercises first, and then create a workout template named 'Agentic Chest' using those exercises.";

    // Find textarea and send
    const textarea = page.locator('textarea');
    await textarea.fill(complexPrompt);
    await textarea.press('Enter');

    // 4. Verification Steps

    // A. Verify Response Appears
    // Wait for the final link or specific text indicating completion
    // The agent usually says "I've created..." or "View Agentic Chest"
    const responseLocator = page.locator('.markdown-body'); // Markdown content class

    // Check for "Bench Press" (Best Practice / Tool Output)
    // We expect "Bench Press" to be listed as a chest exercise
    // Debug: Print the response content
    const texts = await responseLocator.allInnerTexts();
    console.log("Agent Response:", texts.join('\n'));

    await expect(responseLocator.first()).toContainText('Bench Press', { timeout: 60000 });

    // B. Verify Template Creation (Agentic Action)
    // Look for the link to the new template
    await expect(page.locator('a[href*="/templates/"]')).toContainText('Agentic Chest', { timeout: 60000 });

    // C. Verify Sport Science Best Practices (Negative Assertions)
    // Ensure no excessive warmup spam if not requested
    const fullText = await responseLocator.allInnerTexts();
    const joinedText = fullText.join(' ');

    // "Burpee" is often a junk filler exercise in bad AI plans. 
    // "Jumping Jacks" is another.
    expect(joinedText).not.toContain('Burpee');
    expect(joinedText).not.toContain('Jumping Jack');

    // Verify focus on Compound movements
    // "Bench Press" was already checked. Let's check for "Dips" or "Incline" if possible, 
    // but just ensuring "Bench Press" is there constitutes a "Best Practice" for chest.

    // 5. Verify Persistence (Optional mult-turn check)
    // Send another message to verify context is kept or at least chat continues
    await textarea.fill("Thanks! Now explain why Bench Press is good.");
    await textarea.press('Enter');

    // Wait for response
    await expect(responseLocator.last()).toContainText('compound', { timeout: 30000 });
    await expect(responseLocator.last()).toContainText('activation', { timeout: 30000 });
});
