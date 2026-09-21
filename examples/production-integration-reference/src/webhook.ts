import { createHmac, timingSafeEqual } from "node:crypto";

export function signPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyWebhookSignature(
  rawBody: string,
  providedSignature: string | undefined,
  secret: string,
): boolean {
  if (!providedSignature || !secret) return false;

  const expected = Buffer.from(signPayload(rawBody, secret), "utf8");
  const provided = Buffer.from(providedSignature.trim(), "utf8");

  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
