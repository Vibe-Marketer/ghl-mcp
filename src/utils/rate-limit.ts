/**
 * KV-based sliding window rate limiter for Cloudflare Workers.
 * Uses OAUTH_KV (already bound) with short TTLs to track request counts.
 *
 * HIGH-2 fix: rate limit on /admin/login, /signup, and /mcp
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Check and increment rate limit for a given key.
 *
 * @param kv - KV namespace (OAUTH_KV)
 * @param key - Unique key (e.g., "rl:login:<ip>")
 * @param limit - Max requests per window
 * @param windowSeconds - Window duration in seconds
 */
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds); // Align to window boundary
  const kvKey = `${key}:${windowStart}`;

  const current = parseInt((await kv.get(kvKey)) ?? "0", 10);

  if (current >= limit) {
    const resetIn = windowSeconds - (now - windowStart);
    return { allowed: false, remaining: 0, resetInSeconds: resetIn };
  }

  // Increment counter with TTL = 2x window to handle boundary overlap
  await kv.put(kvKey, String(current + 1), { expirationTtl: windowSeconds * 2 });

  return {
    allowed: true,
    remaining: limit - current - 1,
    resetInSeconds: windowSeconds - (now - windowStart),
  };
}

/**
 * Extract client IP from Cloudflare request headers.
 */
export function getClientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

/**
 * Build a rate-limit-exceeded response with appropriate headers.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      retry_after_seconds: result.resetInSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.resetInSeconds),
        "X-RateLimit-Remaining": "0",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
