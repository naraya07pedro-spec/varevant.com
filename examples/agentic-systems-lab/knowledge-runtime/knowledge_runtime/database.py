from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path
from typing import Any, cast

import asyncpg
from pgvector.asyncpg import register_vector


async def migrate(url: str) -> None:
    connection = await asyncpg.connect(url)
    try:
        async with connection.transaction():
            await connection.execute("SELECT pg_advisory_xact_lock(847205194)")
            await connection.execute("""
                CREATE TABLE IF NOT EXISTS knowledge_migrations (
                  name text PRIMARY KEY, checksum text NOT NULL,
                  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
                )
            """)
            root = Path(__file__).resolve().parent.parent / "migrations"
            for path in sorted(root.glob("*.sql")):
                sql = path.read_text()
                checksum = hashlib.sha256(sql.encode()).hexdigest()
                existing = await connection.fetchval(
                    "SELECT checksum FROM knowledge_migrations WHERE name=$1", path.name
                )
                if existing and existing != checksum:
                    raise RuntimeError("migration checksum mismatch")
                if not existing:
                    await connection.execute(sql)
                    await connection.execute(
                        "INSERT INTO knowledge_migrations(name, checksum) VALUES($1,$2)",
                        path.name,
                        checksum,
                    )
    finally:
        await connection.close()


async def pool(url: str) -> asyncpg.Pool[Any]:
    async def initialize(connection: asyncpg.Connection[Any]) -> None:
        await register_vector(connection)

    return cast(
        "asyncpg.Pool[Any]",
        await asyncpg.create_pool(
            url,
            min_size=1,
            max_size=10,
            init=initialize,
            command_timeout=15,
            server_settings={"statement_timeout": "15000", "lock_timeout": "5000"},
        ),
    )


async def main() -> None:
    from knowledge_runtime.security import Settings

    await migrate(Settings().database_url)


if __name__ == "__main__":
    asyncio.run(main())
