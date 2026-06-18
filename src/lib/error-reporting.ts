// Section 8: Errors — centralised, no stack traces exposed to clients.

export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error("[error]", msg, context);
}

// Sanitize before sending to the browser: never leak internal details.
export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Pass through well-known user-facing messages; swallow everything else.
    const safe = [
      "Unsupported file type",
      "File too large",
      "File is empty",
      "File content doesn",
      "Rate limit",
      "Unauthorized",
      "Review not found",
    ];
    if (safe.some((prefix) => error.message.startsWith(prefix))) return error.message;
  }
  return "Something went wrong. Please try again.";
}
