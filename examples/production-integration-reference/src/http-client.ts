import { HttpError } from "./retry.js";
import type { DownstreamClient, NormalizedLead } from "./types.js";

export class FetchDownstreamClient implements DownstreamClient {
  constructor(
    private readonly endpoint: string,
    private readonly token: string,
    private readonly timeoutMs = 5000,
  ) {}

  async sendLead(lead: NormalizedLead): Promise<{ externalId: string | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + this.token,
        },
        body: JSON.stringify({
          external_key: lead.id,
          email: lead.email,
          region: lead.region,
          source: lead.source,
          message: lead.message,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpError(
          "Downstream request failed with status " + response.status,
          response.status,
        );
      }

      const body = (await response.json().catch(() => ({}))) as {
        id?: unknown;
      };

      return {
        externalId: typeof body.id === "string" ? body.id : null,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
