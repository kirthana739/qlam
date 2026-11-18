import type { Page } from "playwright";

/**
 * Helper to fill an input field if any of the given selectors exist.
 */
export async function fillIfPresent(
  page: Page,
  selectors: string[],
  value: string,
  label: string,
  filledFields: Record<string, string>
): Promise<boolean> {
  if (!value) return false;
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      await el.fill(value);
      filledFields[label] = value;
      return true;
    }
  }
  return false;
}

/**
 * Helper to select an option in a dropdown if selector exists.
 */
export async function selectIfPresent(
  page: Page,
  selector: string,
  targetValue: string,
  label: string,
  filledFields: Record<string, string>
): Promise<boolean> {
  const el = await page.$(selector);
  if (!el) return false;

  const options = await el.$$eval("option", (opts) =>
    opts.map((o) => ({ value: o.value, text: o.text.trim() }))
  );

  const match = options.find(
    (o) =>
      o.text.toLowerCase() === targetValue.toLowerCase() ||
      o.value.toLowerCase() === targetValue.toLowerCase() ||
      o.text.toLowerCase().includes(targetValue.toLowerCase())
  );

  if (match) {
    await page.selectOption(selector, match.value);
    filledFields[label] = match.text;
    return true;
  }
  return false;
}
