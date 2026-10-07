from __future__ import annotations

import asyncio

from knowledge_runtime.database import pool
from knowledge_runtime.security import Settings


async def main() -> None:
    settings = Settings()
    database = await pool(settings.database_url)
    try:
        tenants = {principal.tenant for principal in settings.token_bindings.values()}
        for tenant in tenants:
            await database.execute(
                """
                INSERT INTO customers(tenant,customer_id,display_name,recipient,verified)
                VALUES($1,'synthetic-customer','Example Customer','customer@example.invalid',true)
                ON CONFLICT DO NOTHING
            """,
                tenant,
            )
        print("Seeded synthetic tenant-bound customer; no external calls")
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())
