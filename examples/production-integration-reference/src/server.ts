import { createServer } from "node:http";
import { Pool } from "pg";
import { processLeadEvent } from "./handler.js";
import { FetchDownstreamClient } from "./http-client.js";
import { PostgresIdempotencyStore } from "./idempotency.js";
import type { Logger } from "./types.js";
import { verifyWebhookSignature } from "./webhook.js";

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL ?? "";
const webhookSecret = process.env.WEBHOOK_SECRET ?? "";
const downstreamUrl = process.env.DOWNSTREAM_URL ?? "";
const downstreamToken = process.env.DOWNSTREAM_TOKEN ?? "";

if (!databaseUrl || !webhookSecret || !downstreamUrl || !downstreamToken) {
  throw new Error(
    "DATABASE_URL, WEBHOOK_SECRET, DOWNSTREAM_URL and DOWNSTREAM_TOKEN are required",
  );
}

const pool = new Pool({ connectionString: databaseUrl });
const store = new PostgresIdempotencyStore(pool);
const downstream = new FetchDownstreamClient(downstreamUrl, downstreamToken);

const logger: Logger = {
  info(event, fields = {}) {
    console.log(JSON.stringify({ level: "info", event, ...fields }));
  },
  error(event, fields = {}) {
    console.error(JSON.stringify({ level: "error", event, ...fields }));
  },
};

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/events/lead") {
    res.writeHead(404).end("not found");
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const rawBody = Buffer.concat(chunks).toString("utf8");

  const signature = req.headers["x-webhook-signature"];
  const provided = Array.isArray(signature) ? signature[0] : signature;

  if (!verifyWebhookSignature(rawBody, provided, webhookSecret)) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "invalid_signature" }));
    return;
  }

  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const result = await processLeadEvent(payload, {
      store,
      downstream,
      logger,
    });

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (error) {
    logger.error("request_failed", {
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "processing_failed" }));
  }
});

server.listen(port, () => {
  logger.info("server_started", { port });
});
