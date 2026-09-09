#!/usr/bin/env python3
import argparse, datetime as dt, hashlib, json, os, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[1]
GEO = ROOT / "geo"
LOGS = GEO / "logs"


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def page_texts():
    pages = {}
    for p in ROOT.rglob("*.html"):
        if ".git" in p.parts:
            continue
        text = re.sub(r"<[^>]+>", " ", p.read_text(encoding="utf-8", errors="ignore"))
        pages[str(p.relative_to(ROOT))] = re.sub(r"\s+", " ", text).lower()
    return pages


def score(opportunity, config):
    w = config["opportunity_weights"]
    return round(sum(opportunity[k] * w[k] for k in w), 1)


def discover(config, prompts, pages):
    joined = " ".join(pages.values())
    candidates = []
    market_signals = {
        "HVAC": ["hvac", "missed call", "estimate follow-up", "speed-to-lead"],
        "Roofing": ["roofing", "roofer", "estimate follow-up", "speed-to-lead"],
        "B2B Agencies": ["white label", "agency partner", "technical execution", "n8n"],
    }
    routes = {
        "HVAC": "ai-automation-for-hvac/index.html",
        "Roofing": "ai-automation-for-roofing/index.html",
        "B2B Agencies": "white-label-ai-automation/index.html",
    }
    for market, signals in market_signals.items():
        relevant = [p for p in prompts if p["active"] and p["target_market"] == market]
        if not relevant:
            continue
        coverage = sum(1 for s in signals if s.lower() in joined) / len(signals)
        route_exists = (ROOT / routes[market]).exists()
        commercial = max(p["commercial_value"] for p in relevant)
        # FREE_MODE uses only observable first-party site signals. It does not fabricate LLM SOV.
        opp = {
            "commercial_value": commercial,
            "ai_recommendation_gap": 95 if not route_exists else max(20, round((1-coverage)*100)),
            "competitor_advantage": 70 if not route_exists else 45,
            "existing_varevant_evidence": 75 if market in ("HVAC", "Roofing") else 60,
            "ranking_citation_feasibility": 85 if not route_exists else 60,
            "authority_opportunity": 65,
        }
        candidates.append({
            "market": market,
            "target_page": "/" + routes[market].replace("index.html", ""),
            "proposed_action": "CREATE_NEW_PAGE" if not route_exists else "IMPROVE_EXISTING_CONTENT",
            "reason": f"Commercial prompt coverage exists in the library but dedicated {market} topical coverage is {'missing' if not route_exists else 'present but incomplete'}.",
            "components": opp,
            "opportunity_score": score(opp, config),
        })
    return sorted(candidates, key=lambda x: x["opportunity_score"], reverse=True)


def quality_snapshot():
    checks = {
        "robots_exists": (ROOT / "robots.txt").exists(),
        "sitemap_exists": (ROOT / "sitemap.xml").exists(),
        "canonical_home": 'rel="canonical"' in (ROOT / "index.html").read_text(encoding="utf-8", errors="ignore"),
        "organization_schema": 'application/ld+json' in (ROOT / "index.html").read_text(encoding="utf-8", errors="ignore"),
        "prompt_library": (GEO / "prompts.json").exists(),
    }
    return checks, round(sum(checks.values()) / len(checks) * 100)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["audit", "decision", "daily"], default="daily")
    args = parser.parse_args()
    config = load_json(GEO / "config.json")
    prompts = load_json(GEO / "prompts.json")
    pages = page_texts()
    candidates = discover(config, prompts, pages)
    top = candidates[0] if candidates else None
    action = "NO_ACTION"
    if top and top["opportunity_score"] >= config["minimum_opportunity_score"]:
        # In FREE_MODE the repository engine diagnoses and logs. Content authoring is intentionally gated
        # because no paid LLM/search API is assumed and fabricated research is forbidden.
        action = "NO_ACTION"
    checks, qscore = quality_snapshot()
    now = dt.datetime.now(dt.timezone.utc)
    run_id = now.strftime("%Y%m%dT%H%M%SZ") + "-" + hashlib.sha1(str(now.timestamp()).encode()).hexdigest()[:8]
    log = {
        "date": now.date().isoformat(),
        "run_id": run_id,
        "mode": args.mode,
        "measurement": {
            "ChatGPT_SOV": "NOT_MEASURED",
            "Perplexity_SOV": "NOT_MEASURED",
            "Gemini_SOV": "NOT_MEASURED"
        },
        "top_opportunity": top,
        "opportunity_score": top["opportunity_score"] if top else 0,
        "action": action,
        "target_page": top["target_page"] if top else None,
        "reason": "FREE_MODE never fabricates external LLM visibility. Repository-only diagnosis completed; execution is gated to a connected operator with fresh research." if top else "No qualified opportunity found.",
        "files_changed": [],
        "quality_score": qscore,
        "quality_checks": checks,
        "commit_sha": os.getenv("GITHUB_SHA"),
        "deployment_status": "NOT_CHECKED",
        "errors": [],
        "next_recommended_action": top["proposed_action"] if top else "NO_ACTION",
    }
    LOGS.mkdir(parents=True, exist_ok=True)
    out = LOGS / f"{now.date().isoformat()}.json"
    out.write_text(json.dumps(log, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(log, indent=2))

if __name__ == "__main__":
    main()
