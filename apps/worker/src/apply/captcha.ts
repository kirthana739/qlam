import type { Page } from "playwright";

/**
 * Checks for known CAPTCHA or bot check elements on the page.
 * Per rules: NEVER attempt to solve or bypass.
 */
export async function detectCaptcha(page: Page): Promise<boolean> {
  const captchaSelectors = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="challenges.cloudflare.com"]',
    ".g-recaptcha",
    ".h-captcha",
    "#hcaptcha",
    "#recaptcha",
    ".cf-turnstile",
    "[data-sitekey]",
  ];

  for (const selector of captchaSelectors) {
    const el = await page.$(selector);
    if (el) {
      const isVisible = await el.isVisible().catch(() => true);
      if (isVisible) return true;
    }
  }

  return false;
}
