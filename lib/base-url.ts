import { headers } from "next/headers";

// Next.js's fetch() has no implicit base URL in the Node runtime, so Server Components calling
// their own API routes need an absolute URL - built from the incoming request's own headers so
// it's correct in both local dev and prod without a hardcoded env var.
export async function getBaseUrl(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
