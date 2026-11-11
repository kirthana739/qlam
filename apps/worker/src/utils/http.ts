const USER_AGENT = "QlamBot/1.0 (+https://qlam.app/bot)";
const MAX_CONCURRENCY = 3;
const PAUSE_MS = 500;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

let activeRequests = 0;
const waitingQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENCY) {
    activeRequests++;
    return;
  }
  return new Promise((resolve) => {
    waitingQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeRequests--;
  const next = waitingQueue.shift();
  if (next) {
    next();
  }
}

/**
 * Polite fetch client with:
 * - Concurrency 3 limit
 * - 500ms pause
 * - User-Agent: QlamBot/1.0 (+https://qlam.app/bot)
 * - Retries with exponential backoff on 429 and 5xx
 */
export async function politeFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  await acquireSlot();

  try {
    const headers = new Headers(options.headers || {});
    headers.set("User-Agent", USER_AGENT);
    headers.set("Accept", "application/json");

    let attempt = 0;

    while (true) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        // Retry on 429 or 5xx server errors
        if (
          (response.status === 429 || (response.status >= 500 && response.status < 600)) &&
          attempt < RETRY_DELAYS_MS.length
        ) {
          const delay = RETRY_DELAYS_MS[attempt] ?? 1000;
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Apply polite pause before allowing next in slot
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
        return response;
      } catch (err) {
        if (attempt < RETRY_DELAYS_MS.length) {
          const delay = RETRY_DELAYS_MS[attempt] ?? 1000;
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
  } finally {
    releaseSlot();
  }
}

/**
 * Strips HTML tags and decodes entities to produce plain text.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";

  let text = html;

  // Add newlines around block tags
  text = text.replace(/<(p|div|br|li|h1|h2|h3|h4|h5|h6|tr)[^>]*>/gi, "\n");

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n\s*\n\s*\n+/g, "\n\n");

  return text.trim();
}

/**
 * Determines whether a job is remote by inspecting location and optional explicit flag.
 */
export function isRemoteLocation(
  location: string | null | undefined,
  explicitRemoteFlag = false
): boolean {
  if (explicitRemoteFlag) return true;
  if (!location) return false;
  return /\bremote\b/i.test(location);
}
