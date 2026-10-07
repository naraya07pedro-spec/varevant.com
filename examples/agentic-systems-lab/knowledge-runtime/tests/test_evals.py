from knowledge_runtime.evaluate import evaluate


async def test_deterministic_retrieval_eval_dataset(database_url, database):
    results = await evaluate(database_url)
    assert results["passed"] == results["total"] == 12, results
