import assert from "node:assert/strict";
import test from "node:test";
import { signPayload, verifyWebhookSignature } from "../src/webhook.js";

test("accepts a valid HMAC signature", () => {
  const body = JSON.stringify({ id: "lead-001" });
  const secret = "test-secret";
  const signature = signPayload(body, secret);

  assert.equal(verifyWebhookSignature(body, signature, secret), true);
});

test("rejects a modified payload", () => {
  const body = JSON.stringify({ id: "lead-001" });
  const secret = "test-secret";
  const signature = signPayload(body, secret);

  assert.equal(
    verifyWebhookSignature(JSON.stringify({ id: "lead-002" }), signature, secret),
    false,
  );
});
