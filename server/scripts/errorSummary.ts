// One-line summary of an error for the MongoDB scripts: its class name and
// code only, never the message. The driver's message can include the cluster
// hostname, and the GitHub Actions logs for this repo are public.
// Example: "MongoServerError, code 18 AuthenticationFailed".
export function errorSummary(err: unknown): string {
  if (!(err instanceof Error)) return "unknown error";
  const { code, codeName } = err as { code?: unknown; codeName?: unknown };
  const parts = [err.name];
  if (typeof code === "number" || typeof code === "string") {
    parts.push(`code ${code}${typeof codeName === "string" ? ` ${codeName}` : ""}`);
  }
  return parts.join(", ");
}
