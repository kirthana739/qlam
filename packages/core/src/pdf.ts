import type { ResumeData } from "./schemas/resume.js";

/**
 * Renders a ResumeData object into a simple, ATS-friendly HTML string.
 * This is pure code – no AI calls.
 */
export function resumeToHtml(resume: ResumeData): string {
  const esc = (s: string | null | undefined) =>
    (s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const section = (title: string, body: string) =>
    body.trim()
      ? `<section><h2>${esc(title)}</h2>${body}</section>`
      : "";

  // ---- Basics ----
  const { basics } = resume;
  const links = (basics.links ?? [])
    .map((l) => `<a href="${esc(l.url)}">${esc(l.name)}</a>`)
    .join(" · ");

  const headerHtml = `
<header>
  <h1>${esc(basics.name)}</h1>
  ${basics.headline ? `<p class="headline">${esc(basics.headline)}</p>` : ""}
  <p class="contact">
    ${basics.email ? `<span>${esc(basics.email)}</span>` : ""}
    ${basics.phone ? `<span>${esc(basics.phone)}</span>` : ""}
    ${links}
  </p>
</header>`;

  // ---- Summary ----
  const summaryHtml = section(
    "Summary",
    resume.summary ? `<p>${esc(resume.summary)}</p>` : ""
  );

  // ---- Experience ----
  const expItems = (resume.experience ?? [])
    .map((e) => {
      const dates = [e.startDate, e.current ? "Present" : e.endDate]
        .filter(Boolean)
        .join(" – ");
      const bullets = (e.highlights ?? [])
        .map((h) => `<li>${esc(h)}</li>`)
        .join("");
      return `
<div class="entry">
  <div class="entry-header">
    <span class="entry-title">${esc(e.position)}</span>
    <span class="entry-right">${esc(dates)}</span>
  </div>
  <div class="entry-sub">
    <span>${esc(e.company)}</span>
    ${e.location ? `<span>${esc(e.location)}</span>` : ""}
  </div>
  ${e.description ? `<p>${esc(e.description)}</p>` : ""}
  ${bullets ? `<ul>${bullets}</ul>` : ""}
</div>`;
    })
    .join("");
  const experienceHtml = section("Experience", expItems);

  // ---- Education ----
  const eduItems = (resume.education ?? [])
    .map((e) => {
      const dates = [e.startDate, e.endDate].filter(Boolean).join(" – ");
      const bullets = (e.highlights ?? [])
        .map((h) => `<li>${esc(h)}</li>`)
        .join("");
      return `
<div class="entry">
  <div class="entry-header">
    <span class="entry-title">${esc(e.degree)}</span>
    <span class="entry-right">${esc(dates)}</span>
  </div>
  <div class="entry-sub">
    <span>${esc(e.institution)}</span>
    ${e.gpa ? `<span>GPA: ${esc(e.gpa)}</span>` : ""}
  </div>
  ${bullets ? `<ul>${bullets}</ul>` : ""}
</div>`;
    })
    .join("");
  const educationHtml = section("Education", eduItems);

  // ---- Skills ----
  const skillRows = (resume.skills ?? [])
    .filter((s) => s.name || (s.keywords ?? []).length > 0)
    .map((s) => {
      const kws = (s.keywords ?? []).join(", ");
      return `<tr><td class="skill-name">${esc(s.name)}</td><td>${esc(kws)}</td></tr>`;
    })
    .join("");
  const skillsHtml = section(
    "Skills",
    skillRows ? `<table class="skills-table">${skillRows}</table>` : ""
  );

  // ---- Projects ----
  const projItems = (resume.projects ?? [])
    .map((p) => {
      const tech = (p.technologies ?? []).join(", ");
      const bullets = (p.highlights ?? [])
        .map((h) => `<li>${esc(h)}</li>`)
        .join("");
      return `
<div class="entry">
  <div class="entry-header">
    <span class="entry-title">${p.url ? `<a href="${esc(p.url)}">${esc(p.name)}</a>` : esc(p.name)}</span>
    ${tech ? `<span class="entry-right">${esc(tech)}</span>` : ""}
  </div>
  ${p.description ? `<p>${esc(p.description)}</p>` : ""}
  ${bullets ? `<ul>${bullets}</ul>` : ""}
</div>`;
    })
    .join("");
  const projectsHtml = section("Projects", projItems);

  // ---- Certifications ----
  const certItems = (resume.certifications ?? [])
    .map((c) => {
      return `
<div class="entry">
  <div class="entry-header">
    <span class="entry-title">${esc(c.name)}</span>
    ${c.date ? `<span class="entry-right">${esc(c.date)}</span>` : ""}
  </div>
  <div class="entry-sub"><span>${esc(c.issuer)}</span></div>
</div>`;
    })
    .join("");
  const certsHtml = section("Certifications", certItems);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111;
         max-width: 800px; margin: 0 auto; padding: 32px; }
  h1 { font-size: 20pt; margin-bottom: 4px; }
  .headline { font-size: 11pt; color: #555; margin-bottom: 4px; }
  .contact { font-size: 10pt; color: #333; margin-bottom: 12px; }
  .contact span, .contact a { margin-right: 10px; text-decoration: none; color: #333; }
  section { margin-top: 18px; }
  h2 { font-size: 13pt; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 10px;
       text-transform: uppercase; letter-spacing: 0.04em; }
  .entry { margin-bottom: 10px; }
  .entry-header { display: flex; justify-content: space-between; }
  .entry-title { font-weight: bold; }
  .entry-right { font-size: 10pt; color: #555; }
  .entry-sub { font-size: 10pt; color: #555; display: flex; gap: 10px; margin-bottom: 2px; }
  p { font-size: 10.5pt; margin: 3px 0; }
  ul { margin-left: 18px; margin-top: 3px; }
  li { font-size: 10.5pt; margin-bottom: 2px; }
  .skills-table { border-collapse: collapse; width: 100%; }
  .skills-table td { padding: 2px 6px; font-size: 10.5pt; vertical-align: top; }
  .skill-name { font-weight: bold; white-space: nowrap; width: 120px; }
  a { color: #1a0dab; }
</style>
</head>
<body>
${headerHtml}
${summaryHtml}
${experienceHtml}
${educationHtml}
${skillsHtml}
${projectsHtml}
${certsHtml}
</body>
</html>`;
}
