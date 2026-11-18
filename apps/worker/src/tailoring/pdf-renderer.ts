import { chromium } from "playwright";
import { resumeToHtml, type ResumeData } from "@qlam/core";

/**
 * Renders a ResumeData object to a PDF buffer using Playwright + Chromium.
 * No network calls are made – the HTML is rendered locally.
 */
export async function renderResumePdf(resume: ResumeData): Promise<Buffer> {
  const html = resumeToHtml(resume);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}
