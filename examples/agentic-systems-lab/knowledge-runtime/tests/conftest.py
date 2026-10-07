import os

import httpx
import pytest
import pytest_asyncio

from knowledge_runtime.api import create_app
from knowledge_runtime.database import migrate, pool
from knowledge_runtime.observability import Audit
from knowledge_runtime.retrieval import Retrieval
from knowledge_runtime.security import Principal, Settings

WORKER_TOKEN = "synthetic-test-worker-credential-000001"
REVIEWER_TOKEN = "synthetic-test-reviewer-credential-0002"
OTHER_TOKEN = "synthetic-test-other-credential-000003"
READER_TOKEN = "synthetic-test-readonly-credential-004"
ALL_TOOLS = [
    "search_knowledge",
    "get_document_status",
    "get_extraction_status",
    "search_customer",
    "draft_followup",
    "request_followup_send",
    "get_pipeline_status",
]


@pytest.fixture(scope="session")
def database_url():
    value = os.environ.get("TEST_DATABASE_URL", "")
    if not value:
        pytest.fail("Real PostgreSQL/pgvector is required: configure TEST_DATABASE_URL")
    if not value.split("?")[0].endswith("_test"):
        pytest.fail("Tests truncate data; database name must end with _test")
    return value


@pytest.fixture
def principal():
    return Principal(
        tenant="demo",
        subject="worker",
        permissions=["read", "ingest", "delete", "propose"],
        tools=ALL_TOOLS,
    )


@pytest.fixture
def other_principal():
    return Principal(
        tenant="other",
        subject="worker-other",
        permissions=["read", "ingest", "delete", "propose"],
        tools=ALL_TOOLS,
    )


@pytest.fixture
def reviewer():
    return Principal(tenant="demo", subject="human", permissions=["read", "approve"], tools=[])


@pytest.fixture
def settings(database_url, principal, other_principal, reviewer):
    return Settings(
        _env_file=None,
        database_url=database_url,
        token_bindings={
            WORKER_TOKEN: principal,
            REVIEWER_TOKEN: reviewer,
            OTHER_TOKEN: other_principal,
            READER_TOKEN: Principal(
                tenant="demo", subject="reader", permissions=["read"], tools=["search_knowledge"]
            ),
        },
        mcp_token=WORKER_TOKEN,
        provider_timeout=1,
        parser_timeout=5,
    )


@pytest_asyncio.fixture
async def database(database_url):
    await migrate(database_url)
    active = await pool(database_url)
    # Select only this service's tables, not vector extension objects.
    names = await active.fetch("""
        SELECT tablename FROM pg_tables WHERE schemaname='public'
        AND tablename <> 'knowledge_migrations'
    """)
    if names:
        table_names = ",".join('"' + r["tablename"] + '"' for r in names)
        await active.execute(f"TRUNCATE {table_names} RESTART IDENTITY CASCADE")
    yield active
    await active.close()


@pytest.fixture
def retrieval(database):
    return Retrieval(database, Audit(database), timeout=0.2)


@pytest_asyncio.fixture
async def client(database, settings):
    app = create_app(settings, database)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": "Bearer " + WORKER_TOKEN},
        ) as active:
            active.app = app
            yield active


@pytest_asyncio.fixture
async def customer(database):
    await database.execute("""
        INSERT INTO customers(tenant,customer_id,display_name,recipient,verified)
        VALUES('demo','synthetic-customer','Example Customer','customer@example.invalid',true)
    """)
    return "synthetic-customer"


@pytest.fixture
def workflow(database):
    from knowledge_runtime.workflow import Workflow

    return Workflow(database, Audit(database))


@pytest.fixture
def gateway(retrieval, workflow):
    from knowledge_runtime.gateway import Gateway

    return Gateway(retrieval, workflow, retrieval.audit)
