import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { truthCheck, extractNumbers } from "../src/truthCheck.ts";
import type { ResumeData } from "../src/schemas/resume.ts";

const sampleBaseResume: ResumeData = {
  basics: {
    name: "Alex Doe",
    email: "alex@example.com",
    phone: "+1 555-0100",
    headline: "Full Stack Engineer",
    links: [{ name: "GitHub", url: "https://github.com/alexdoe" }],
  },
  summary: "Full stack engineer with 4 years of experience building distributed systems.",
  experience: [
    {
      company: "Acme Corp",
      position: "Software Engineer",
      location: "San Francisco, CA",
      startDate: "2021-01",
      endDate: "2023-06",
      current: false,
      description: "Core backend engineer.",
      highlights: [
        "Reduced API latency by 40% across 5 services serving 10M daily requests.",
        "Led migration of 3 monolith services to Go microservices, saving $500k annually.",
      ],
    },
    {
      company: "Beta Systems",
      position: "Junior Developer",
      location: "New York, NY",
      startDate: "2019-06",
      endDate: "2020-12",
      current: false,
      description: "Frontend engineer.",
      highlights: [
        "Built responsive UI dashboards using React, Redux, and TypeScript.",
        "Increased test coverage from 60% to 85% across 12 repositories.",
      ],
    },
  ],
  education: [
    {
      institution: "State University",
      degree: "B.S. in Computer Science",
      fieldOfStudy: "Computer Science",
      startDate: "2015-09",
      endDate: "2019-05",
      gpa: "3.8",
      highlights: ["Dean's List for 6 semesters."],
    },
  ],
  skills: [
    {
      name: "Languages",
      keywords: ["TypeScript", "Python", "Go", "SQL", "JavaScript"],
    },
    {
      name: "Frameworks",
      keywords: ["React", "Next.js", "Node.js", "Express"],
    },
    {
      name: "Tools",
      keywords: ["Docker", "PostgreSQL", "Git", "Kubernetes"],
    },
  ],
  projects: [
    {
      name: "CacheFlow",
      description: "In-memory caching engine.",
      url: "https://github.com/alexdoe/cacheflow",
      technologies: ["Go", "Redis"],
      highlights: ["Benchmarked at 100,000 ops/sec with sub-millisecond p99 latency."],
    },
  ],
  certifications: [
    {
      name: "AWS Certified Developer",
      issuer: "Amazon Web Services",
      date: "2022-03",
    },
  ],
};

describe("truthCheck unit tests", () => {
  test("1. valid tailored resume with skill subset, reordered bullets, identical facts passes", () => {
    const tailored: ResumeData = {
      ...sampleBaseResume,
      summary: "Full stack engineer with 4 years of experience building distributed systems.",
      experience: [
        {
          ...sampleBaseResume.experience[0]!,
          // Reordered highlights, same metrics
          highlights: [
            "Led migration of 3 monolith services to Go microservices, saving $500k annually.",
            "Reduced API latency by 40% across 5 services serving 10M daily requests.",
          ],
        },
      ],
      skills: [
        {
          name: "Languages",
          keywords: ["TypeScript", "Go"], // Subset of base
        },
        {
          name: "Tools",
          keywords: ["Docker", "PostgreSQL"],
        },
      ],
    };

    const result = truthCheck(sampleBaseResume, tailored);
    assert.equal(result.ok, true);
    assert.equal(result.violations.length, 0);
  });

  test("2. invented skill fails verification", () => {
    const tailored: ResumeData = {
      ...sampleBaseResume,
      skills: [
        ...sampleBaseResume.skills,
        {
          name: "Rust", // Not in base skills
          keywords: ["Tokio", "Actix"],
        },
      ],
    };

    const result = truthCheck(sampleBaseResume, tailored);
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("Invented skill: \"Rust\"")));
  });

  test("3. invented skill keyword in category fails verification", () => {
    const tailored: ResumeData = {
      ...sampleBaseResume,
      skills: [
        {
          name: "Languages",
          keywords: ["TypeScript", "Rust"], // "Rust" is invented
        },
      ],
    };

    const result = truthCheck(sampleBaseResume, tailored);
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("Rust")));
  });

  test("4. invented number in bullet highlight fails verification", () => {
    const tailored: ResumeData = {
      ...sampleBaseResume,
      experience: [
        {
          ...sampleBaseResume.experience[0]!,
          highlights: [
            // 75% was never in base resume (base had 40%)
            "Reduced API latency by 75% across 5 services serving 10M daily requests.",
          ],
        },
      ],
    };

    const result = truthCheck(sampleBaseResume, tailored);
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("75%")));
  });

  test("5. invented team size number in bullet fails verification", () => {
    const tailored: ResumeData = {
      ...sampleBaseResume,
      experience: [
        {
          ...sampleBaseResume.experience[0]!,
          highlights: [
            // "15 engineers" - 15 is not in base resume
            "Managed a cross-functional squad of 15 engineers to deliver core features.",
          ],
        },
      ],
    };

    const result = truthCheck(sampleBaseResume, tailored);
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("15")));
  });

  test("6. changed start date in experience fails verification", () => {
    const tailored: ResumeData = {
      ...sampleBaseResume,
      experience: [
        {
          ...sampleBaseResume.experience[0]!,
          startDate: "2020-01", // Base was 2021-01
        },
      ],
    };

    const result = truthCheck(sampleBaseResume, tailored);
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("Changed start date")));
  });

  test("7. changed end date in experience fails verification", () => {
    const tailored: ResumeData = {
      ...sampleBaseResume,
      experience: [
        {
          ...sampleBaseResume.experience[0]!,
          endDate: "2024-01", // Base was 2023-06
        },
      ],
    };

    const result = truthCheck(sampleBaseResume, tailored);
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("Changed end date")));
  });

  test("8. changed employer name fails verification", () => {
    const tailored: ResumeData = {
      ...sampleBaseResume,
      experience: [
        {
          ...sampleBaseResume.experience[0]!,
          company: "Google", // Base was Acme Corp
        },
      ],
    };

    const result = truthCheck(sampleBaseResume, tailored);
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("Invented employer: \"Google\"")));
  });

  test("9. changed job title/position fails verification", () => {
    const tailored: ResumeData = {
      ...sampleBaseResume,
      experience: [
        {
          ...sampleBaseResume.experience[0]!,
          position: "Principal Staff Architect", // Base was Software Engineer
        },
      ],
    };

    const result = truthCheck(sampleBaseResume, tailored);
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("Changed title")));
  });

  test("10. changed school institution fails verification", () => {
    const tailored: ResumeData = {
      ...sampleBaseResume,
      education: [
        {
          ...sampleBaseResume.education[0]!,
          institution: "MIT", // Base was State University
        },
      ],
    };

    const result = truthCheck(sampleBaseResume, tailored);
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("Invented school: \"MIT\"")));
  });

  test("11. changed academic degree fails verification", () => {
    const tailored: ResumeData = {
      ...sampleBaseResume,
      education: [
        {
          ...sampleBaseResume.education[0]!,
          degree: "Ph.D. in Computer Science", // Base was B.S. in Computer Science
        },
      ],
    };

    const result = truthCheck(sampleBaseResume, tailored);
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("Changed degree")));
  });

  test("12. case-insensitive skill matching is allowed", () => {
    const tailored: ResumeData = {
      ...sampleBaseResume,
      skills: [
        {
          name: "LANGUAGES", // Base was Languages
          keywords: ["typescript", "python", "GO", "sql"], // All exist in base with different casing
        },
      ],
    };

    const result = truthCheck(sampleBaseResume, tailored);
    assert.equal(result.ok, true);
    assert.equal(result.violations.length, 0);
  });

  test("13. number extraction handles decimals, currencies, and percentages accurately", () => {
    const text = "Saved $500k, boosted performance by 40% with 99.9% uptime and 100,000 ops/sec.";
    const { tokens, rawDigits } = extractNumbers(text);
    assert.ok(tokens.includes("$500k"));
    assert.ok(tokens.includes("40%"));
    assert.ok(tokens.includes("99.9%"));
    assert.ok(rawDigits.includes("500"));
    assert.ok(rawDigits.includes("40"));
    assert.ok(rawDigits.includes("99.9"));
    assert.ok(rawDigits.includes("100000"));
  });
});
