import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { detectAtsSystem } from "../src/apply/handlers/detector.js";

describe("ATS System Detector", () => {
  test("detects Greenhouse for boards.greenhouse.io and job-boards.greenhouse.io", () => {
    const res1 = detectAtsSystem("https://boards.greenhouse.io/acme/jobs/12345");
    assert.equal(res1.isSupported, true);
    assert.equal(res1.ats, "greenhouse");
    assert.equal(res1.hostname, "boards.greenhouse.io");

    const res2 = detectAtsSystem("https://job-boards.greenhouse.io/startup/jobs/67890");
    assert.equal(res2.isSupported, true);
    assert.equal(res2.ats, "greenhouse");
  });

  test("detects Lever for jobs.lever.co and jobs.eu.lever.co", () => {
    const res1 = detectAtsSystem("https://jobs.lever.co/leverdemo/abc-123");
    assert.equal(res1.isSupported, true);
    assert.equal(res1.ats, "lever");
    assert.equal(res1.hostname, "jobs.lever.co");

    const res2 = detectAtsSystem("https://jobs.eu.lever.co/eurocorp/def-456");
    assert.equal(res2.isSupported, true);
    assert.equal(res2.ats, "lever");
  });

  test("detects Ashby for jobs.ashbyhq.com", () => {
    const res = detectAtsSystem("https://jobs.ashbyhq.com/techcorp/xyz-789");
    assert.equal(res.isSupported, true);
    assert.equal(res.ats, "ashby");
    assert.equal(res.hostname, "jobs.ashbyhq.com");
  });

  test("returns isSupported=false and needs_user reason for unknown or custom domains", () => {
    const unknown = detectAtsSystem("https://careers.google.com/jobs/results/123");
    assert.equal(unknown.isSupported, false);
    assert.equal(unknown.ats, null);
    assert.ok(unknown.reason?.includes("Unsupported ATS URL or unknown job board domain"));

    const workday = detectAtsSystem("https://acme.myworkdayjobs.com/en-US/careers/job/1");
    assert.equal(workday.isSupported, false);
    assert.equal(workday.ats, null);
    assert.ok(workday.reason?.includes("Unsupported ATS URL"));
  });

  test("handles malformed or invalid URLs safely without throwing", () => {
    const invalid = detectAtsSystem("not-a-valid-url");
    assert.equal(invalid.isSupported, false);
    assert.equal(invalid.ats, null);
    assert.ok(invalid.reason?.includes("Invalid job application URL"));
  });
});
