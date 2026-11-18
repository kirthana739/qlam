import type { Page } from "playwright";
import type { FormField, FormFieldType } from "./types.js";

/**
 * Inspects all interactive form fields on the page and extracts their
 * label, field type, selector, required status, and options (if any).
 */
export async function readForm(page: Page): Promise<FormField[]> {
  const fields = await page.evaluate(() => {
    const results: Array<{
      id?: string;
      name?: string;
      label: string;
      type: FormFieldType;
      required: boolean;
      options?: string[];
      selector: string;
    }> = [];

    // Find all form controls
    const elements = Array.from(
      document.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input, select, textarea")
    );

    for (const el of elements) {
      const typeAttr = (el.getAttribute("type") || "").toLowerCase();
      // Skip hidden inputs and buttons
      if (
        typeAttr === "hidden" ||
        typeAttr === "submit" ||
        typeAttr === "button" ||
        typeAttr === "reset"
      ) {
        continue;
      }

      const tagName = el.tagName.toLowerCase();
      let fieldType: FormFieldType = "text";

      if (tagName === "textarea") {
        fieldType = "textarea";
      } else if (tagName === "select") {
        fieldType = "select";
      } else if (typeAttr === "file") {
        fieldType = "file";
      } else if (typeAttr === "email") {
        fieldType = "email";
      } else if (typeAttr === "tel") {
        fieldType = "tel";
      } else if (typeAttr === "url") {
        fieldType = "url";
      } else if (typeAttr === "checkbox") {
        fieldType = "checkbox";
      } else if (typeAttr === "radio") {
        fieldType = "radio";
      } else {
        fieldType = "text";
      }

      // Check required
      const hasRequiredAttr =
        el.hasAttribute("required") ||
        el.getAttribute("aria-required") === "true";

      // Resolve label
      let labelText = "";
      if (el.id) {
        const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (labelEl) {
          labelText = labelEl.textContent || "";
        }
      }

      if (!labelText) {
        const parentLabel = el.closest("label");
        if (parentLabel) {
          labelText = parentLabel.textContent || "";
        }
      }

      if (!labelText && el.getAttribute("aria-label")) {
        labelText = el.getAttribute("aria-label") || "";
      }

      if (!labelText) {
        const container = el.closest(".field, .form-group, .form-field, div");
        if (container) {
          const lbl = container.querySelector("label");
          if (lbl) {
            labelText = lbl.textContent || "";
          }
        }
      }

      if (!labelText) {
        labelText = el.getAttribute("placeholder") || el.getAttribute("name") || el.id || "Unknown Field";
      }

      const isAsteriskRequired =
        /\*|\brequired\b/i.test(labelText) ||
        (el.id && !!document.querySelector(`label[for="${CSS.escape(el.id)}"] .asterisk, label[for="${CSS.escape(el.id)}"] .required`));

      const required = Boolean(hasRequiredAttr || isAsteriskRequired);

      // Clean label text: remove trailing asterisks and extra spaces
      const cleanLabel = labelText.replace(/[\*\s]+$/g, "").trim();

      // Collect options for select elements
      let options: string[] | undefined;
      if (tagName === "select") {
        const selectEl = el as HTMLSelectElement;
        options = Array.from(selectEl.options)
          .map((opt) => opt.text.trim())
          .filter((t) => t.length > 0 && !t.startsWith("--"));
      }

      // Generate a unique selector
      let selector = "";
      if (el.id) {
        selector = `#${CSS.escape(el.id)}`;
      } else if (el.name) {
        selector = `${tagName}[name="${CSS.escape(el.name)}"]`;
      } else {
        selector = `${tagName}[type="${typeAttr}"]`;
      }

      results.push({
        id: el.id || undefined,
        name: el.name || undefined,
        label: cleanLabel,
        type: fieldType,
        required,
        options,
        selector,
      });
    }

    return results;
  });

  return fields;
}
