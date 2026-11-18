import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isRetryableGeminiError,
  withGeminiRetry,
  AI_BUSY_MESSAGE,
} from "../src/ai.ts";

describe("isRetryableGeminiError", () => {
  it("returns true for status 429 and 503", () => {
    assert.equal(isRetryableGeminiError({ status: 429 }), true);
    assert.equal(isRetryableGeminiError({ status: 503 }), true);
    assert.equal(isRetryableGeminiError({ statusCode: 429 }), true);
    assert.equal(isRetryableGeminiError({ statusCode: 503 }), true);
    assert.equal(isRetryableGeminiError({ response: { status: 429 } }), true);
    assert.equal(isRetryableGeminiError({ response: { status: 503 } }), true);
  });

  it("returns true for RESOURCE_EXHAUSTED and UNAVAILABLE codes/messages", () => {
    assert.equal(isRetryableGeminiError({ code: "RESOURCE_EXHAUSTED" }), true);
    assert.equal(isRetryableGeminiError({ code: "UNAVAILABLE" }), true);
    assert.equal(isRetryableGeminiError(new Error("Resource has been exhausted (rate limit)")), true);
    assert.equal(isRetryableGeminiError(new Error("Service unavailable, please try later")), true);
  });

  it("returns false for non-retryable errors (400, 401, 403, 404, 500)", () => {
    assert.equal(isRetryableGeminiError({ status: 400 }), false);
    assert.equal(isRetryableGeminiError({ status: 401 }), false);
    assert.equal(isRetryableGeminiError({ status: 403 }), false);
    assert.equal(isRetryableGeminiError({ status: 404 }), false);
    assert.equal(isRetryableGeminiError({ status: 500 }), false);
    assert.equal(isRetryableGeminiError(new Error("Invalid argument provided")), false);
    assert.equal(isRetryableGeminiError(null), false);
  });
});

describe("withGeminiRetry", () => {
  it("returns result immediately if operation succeeds", async () => {
    let calls = 0;
    const result = await withGeminiRetry(async () => {
      calls++;
      return "success";
    }, [5, 10, 15]);

    assert.equal(result, "success");
    assert.equal(calls, 1);
  });

  it("retries on retryable 429/503 error and succeeds on subsequent attempt", async () => {
    let calls = 0;
    const result = await withGeminiRetry(async () => {
      calls++;
      if (calls === 1) {
        const err = new Error("429 Too Many Requests");
        Object.assign(err, { status: 429 });
        throw err;
      }
      return "recovered";
    }, [5, 10, 15]);

    assert.equal(result, "recovered");
    assert.equal(calls, 2);
  });

  it("throws friendly AI_BUSY_MESSAGE after exhausting all 3 retries", async () => {
    let calls = 0;
    await assert.rejects(
      async () => {
        await withGeminiRetry(async () => {
          calls++;
          const err = new Error("503 Service Unavailable");
          Object.assign(err, { status: 503 });
          throw err;
        }, [5, 10, 15]);
      },
      (err: Error) => {
        assert.equal(err.message, AI_BUSY_MESSAGE);
        return true;
      }
    );

    // Initial attempt + 3 retries = 4 attempts total
    assert.equal(calls, 4);
  });

  it("fails immediately without retry on non-retryable errors", async () => {
    let calls = 0;
    await assert.rejects(
      async () => {
        await withGeminiRetry(async () => {
          calls++;
          const err = new Error("400 Bad Request");
          Object.assign(err, { status: 400, code: "400" });
          throw err;
        }, [5, 10, 15]);
      },
      (err: Error) => {
        assert.equal(err.message, "400 Bad Request");
        return true;
      }
    );

    assert.equal(calls, 1);
  });
});
