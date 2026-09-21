import { createHash } from "node:crypto";
import { withRetry } from "./retry.js";
import type {
  DownstreamClient,
  IdempotencyStore,
  LeadInput,
  Logger,
  NormalizedLead,
} from "./types.js";

export function normalizeLead(input: LeadInput): NormalizedLead {
  return {
    id: String(input.id ?? "").trim(),
    email: String(input.email ?? "").trim().toLowerCase(),
    region: String(input.region ?? "").trim().toUpperCase(),
    source: String(input.source ?? "unknown").trim().toLowerCase(),
    message: String(input.message ?? "").trim(),
  };
}

export function validateLead(lead: NormalizedLead): string[] {
  const errors: string[] = [];

  if (!lead.id) errors.push("id_required");
  if (!lead.email || !/^\S+@\S+\.\S+$/.test(lead.email)) {
    errors.push("valid_email_required");
  }
  if (!lead.region) errors.push("region_required");

  return errors;
}

export function buildIdempotencyKey(lead: NormalizedLead): string {
  return createHash("sha256")
    .update([lead.id, lead.email, lead.source].join("|"))
    .digest("hex");
}

function errorClass(error: unknown): string {
  return error instanceof Error ? error.name || "Error" : "UnknownError";
}

export async function processLeadEvent(
  input: LeadInput,
  deps: {
    store: IdempotencyStore;
    downstream: DownstreamClient;
    logger: Logger;
  },
  config: {
    allowedRegions?: string[];
    maxAttempts?: number;
    baseDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
  } = {},
): Promise<
  | { status: "blocked"; reason: "validation_failed"; errors: string[] }
  | { status: "duplicate"; state: string; idempotencyKey: string }
  | { status: "sent"; idempotencyKey: string; externalId: string | null }
> {
  const lead = normalizeLead(input);
  const errors = validateLead(lead);

  if (errors.length > 0) {
    deps.logger.info("lead_blocked", { reason: "validation_failed", errors });
    return { status: "blocked", reason: "validation_failed", errors };
  }

  const allowedRegions = new Set(config.allowedRegions ?? ["ID", "SG", "AU"]);
  if (!allowedRegions.has(lead.region)) {
    deps.logger.info("lead_blocked", {
      reason: "region_not_allowed",
      region: lead.region,
    });
    return {
      status: "blocked",
      reason: "validation_failed",
      errors: ["region_not_allowed"],
    };
  }

  const idempotencyKey = buildIdempotencyKey(lead);
  const reservation = await deps.store.reserve(idempotencyKey, lead);

  if (!reservation.acquired) {
    deps.logger.info("duplicate_blocked", {
      idempotencyKey,
      state: reservation.state,
    });
    return {
      status: "duplicate",
      state: reservation.state,
      idempotencyKey,
    };
  }

  try {
    const result = await withRetry(
      () => deps.downstream.sendLead(lead),
      {
        maxAttempts: config.maxAttempts,
        baseDelayMs: config.baseDelayMs,
        sleep: config.sleep,
        random: config.random,
      },
    );

    await deps.store.markSent(idempotencyKey, result.externalId);
    deps.logger.info("lead_sent", {
      idempotencyKey,
      externalId: result.externalId,
    });

    return {
      status: "sent",
      idempotencyKey,
      externalId: result.externalId,
    };
  } catch (error) {
    await deps.store.markFailed(idempotencyKey, errorClass(error));
    deps.logger.error("lead_send_failed", {
      idempotencyKey,
      errorClass: errorClass(error),
    });
    throw error;
  }
}
