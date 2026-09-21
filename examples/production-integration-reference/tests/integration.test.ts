import assert from "node:assert/strict";
import test from "node:test";
import { processLeadEvent } from "../src/handler.js";
import { HttpError } from "../src/retry.js";
import type {
  DownstreamClient,
  IdempotencyStore,
  Logger,
  NormalizedLead,
  ReservationResult,
} from "../src/types.js";

class MemoryStore implements IdempotencyStore {
  private readonly states = new Map<string, string>();

  async reserve(
    idempotencyKey: string,
    _payload: NormalizedLead,
  ): Promise<ReservationResult> {
    const existing = this.states.get(idempotencyKey);
    if (existing) {
      return { acquired: false, idempotencyKey, state: existing };
    }

    this.states.set(idempotencyKey, "RESERVED");
    return { acquired: true, idempotencyKey };
  }

  async markSent(idempotencyKey: string): Promise<void> {
    this.states.set(idempotencyKey, "SENT");
  }

  async markFailed(idempotencyKey: string): Promise<void> {
    this.states.set(idempotencyKey, "FAILED");
  }
}

const logger: Logger = {
  info() {},
  error() {},
};

const lead = {
  id: "lead-001",
  email: "Buyer@example.com",
  region: "id",
  source: "website",
  message: "Need help",
};

test("persists reservation before side effect and blocks replay", async () => {
  const store = new MemoryStore();
  let calls = 0;

  const downstream: DownstreamClient = {
    async sendLead() {
      calls += 1;
      return { externalId: "crm-123" };
    },
  };

  const first = await processLeadEvent(lead, { store, downstream, logger });
  const second = await processLeadEvent(lead, { store, downstream, logger });

  assert.equal(first.status, "sent");
  assert.equal(second.status, "duplicate");
  assert.equal(calls, 1);
});

test("retries transient HTTP failures and then succeeds", async () => {
  const store = new MemoryStore();
  let calls = 0;

  const downstream: DownstreamClient = {
    async sendLead() {
      calls += 1;
      if (calls < 3) throw new HttpError("temporary", 503);
      return { externalId: "crm-456" };
    },
  };

  const result = await processLeadEvent(
    { ...lead, id: "lead-002" },
    { store, downstream, logger },
    {
      baseDelayMs: 0,
      sleep: async () => {},
      random: () => 0,
    },
  );

  assert.equal(result.status, "sent");
  assert.equal(calls, 3);
});

test("does not retry a permanent 400 response", async () => {
  const store = new MemoryStore();
  let calls = 0;

  const downstream: DownstreamClient = {
    async sendLead() {
      calls += 1;
      throw new HttpError("bad request", 400);
    },
  };

  await assert.rejects(
    processLeadEvent(
      { ...lead, id: "lead-003" },
      { store, downstream, logger },
      {
        baseDelayMs: 0,
        sleep: async () => {},
      },
    ),
    /bad request/,
  );

  assert.equal(calls, 1);
});
