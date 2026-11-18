import type { Page } from "playwright";

/**
 * Returns true unless BOTH DRY_RUN is explicitly "false"
 * AND ALLOW_LIVE_SUBMIT is explicitly "true".
 */
export function isDryRun(): boolean {
  return !(
    process.env.DRY_RUN === "false" &&
    process.env.ALLOW_LIVE_SUBMIT === "true"
  );
}

/**
 * Checks whether a field is demographic / voluntary self-identification.
 */
export function isDemographicField(label: string, name?: string): boolean {
  const combined = `${label} ${name || ""}`.toLowerCase();
  return (
    /\b(gender|sex|race|ethnicity|hispanic|latino|veteran|disability|handicap|orientation)\b/i.test(
      combined
    )
  );
}

/**
 * Finds an option matching "Decline to self-identify", "Prefer not to say", etc.
 */
export function findDeclineOption(options: string[]): string | undefined {
  return options.find((opt) =>
    /\b(decline|prefer not|choose not|don't wish|do not wish|not to self-identify|not disclosed)\b/i.test(
      opt
    )
  );
}

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

/**
 * Helper to click radio button or checkbox if matching value or label exists.
 */
export async function selectRadioOrCheckbox(
  page: Page,
  selector: string,
  targetValue: string,
  label: string,
  filledFields: Record<string, string>
): Promise<boolean> {
  const el = await page.$(selector);
  if (el) {
    await el.click().catch(() => {});
    filledFields[label] = targetValue;
    return true;
  }
  return false;
}
