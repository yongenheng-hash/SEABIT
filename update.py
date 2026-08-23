#!/usr/bin/env python3
"""
SEABIT — feed builder (version A: no LLM)

What this does, in order:
  1. Reads sources.json for the list of RSS feeds.
  2. Fetches each feed and pulls out the stories.
  3. Tags each story with a region and a topic using keyword rules.
  4. Groups stories that are really the same story from different outlets.
  5. Merges with what's already in feed.json, keeps the last 30 days.
  6. Writes feed.json, which the website reads.

Run it with:  python update.py
"""

import json
import hashlib
import re
import sys
from datetime import datetime, timezone, timedelta

import feedparser

# ── settings you might want to change ─────────────────────────────
RETENTION_DAYS = 30      # how much history feed.json keeps
CLUSTER_THRESHOLD = 0.55 # 0-1. higher = fewer stories get merged together
CLUSTER_WINDOW_HRS = 48  # only merge stories published within this many hours
MAX_PER_FEED = 25        # ignore anything older than the newest 25 per feed

SOURCES_FILE = "sources.json"
OUTPUT_FILE = "feed.json"


# ── topic tagging ─────────────────────────────────────────────────
# First rule that matches wins, so order matters here.
TOPIC_RULES = [
    ("policy", ["monetary policy", "interest rate", "policy rate", "opr",
                "bank rate", "fomc", "rate decision", "policy statement",
                "monetary policy committee", "mpc", "tightening", "easing",
                "basis point", "rate cut", "rate hike"]),
    ("inflation", ["inflation", "consumer price", "cpi", "price index",
                   "producer price", "ppi", "deflation", "price pressure",
                   "cost of living"]),
    ("labour", ["employment", "unemployment", "payroll", "jobs", "labour",
                "labor market", "wage", "hiring", "jobless"]),
    ("growth", ["gdp", "growth", "output", "recession", "economic activity",
                "industrial production", "retail sales", "pmi",
                "manufacturing"]),
    ("markets", ["exchange rate", "currency", "bond", "yield", "equity",
                 "market", "fx", "ringgit", "dollar", "euro", "sterling",
                 "gold", "commodity", "oil"]),
    ("fiscal", ["budget", "fiscal", "deficit", "debt", "tariff", "trade",
                "export", "import", "subsidy", "taxation"]),
    ("research", ["working paper", "research", "study", "speech", "remarks",
                  "lecture", "survey", "review", "report"]),
]

# Words that show up in almost every headline and tell you nothing.
# Removed before comparing two headlines for similarity.
STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "are", "was", "were", "be",
    "been", "has", "have", "had", "will", "would", "says", "said", "after",
    "over", "amid", "into", "its", "it", "that", "this", "new", "up", "down",
}


def log(msg):
    print(msg, flush=True)


# ── step 1: fetch ─────────────────────────────────────────────────
def fetch_all(feeds):
    """Pull every feed. Returns raw stories plus a per-feed report."""
    stories, report = [], []

    for f in feeds:
        try:
            parsed = feedparser.parse(f["url"])
            entries = parsed.entries[:MAX_PER_FEED]

            if not entries:
                report.append((f["name"], "EMPTY", 0))
                continue

            keep = f.get("filter")   # optional: only keep stories mentioning these
            skipped = 0

            for e in entries:
                ts = entry_time(e)
                if ts is None:
                    continue
                link = (e.get("link") or "").strip()
                title = clean_text(e.get("title") or "")
                if not link or not title:
                    continue

                if keep:
                    hay = (title + " " + strip_html(e.get("summary", ""))).lower()
                    if not any(k.lower() in hay for k in keep):
                        skipped += 1
                        continue

                stories.append({
                    "id": hashlib.sha1(link.encode()).hexdigest()[:12],
                    "ts": ts.isoformat(),
                    "source": f["name"],
                    "region": f.get("region", "Global"),
                    "weight": f.get("weight", 5),
                    "title": title,
                    "url": link,
                    "blurb": clean_text(strip_html(e.get("summary", "")))[:400],
                })

            note = f"ok ({skipped} filtered out)" if skipped else "ok"
            report.append((f["name"], note, len(entries) - skipped))

        except Exception as ex:
            report.append((f["name"], f"FAILED: {type(ex).__name__}", 0))

    return stories, report


def entry_time(entry):
    """RSS dates come in several shapes. Returns a timezone-aware datetime."""
    for key in ("published_parsed", "updated_parsed"):
        st = entry.get(key)
        if st:
            try:
                return datetime(*st[:6], tzinfo=timezone.utc)
            except (TypeError, ValueError):
                pass
    return None


def strip_html(s):
    return re.sub(r"<[^>]+>", " ", s or "")


def clean_text(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


# ── step 2: tag ───────────────────────────────────────────────────
def tag_topic(story):
    hay = (story["title"] + " " + story["blurb"]).lower()
    for topic, words in TOPIC_RULES:
        if any(w in hay for w in words):
            return topic
    return "research"


# ── step 3: cluster near-duplicates ───────────────────────────────
def keywords(title):
    words = re.findall(r"[a-z0-9]+", title.lower())
    return {w for w in words if w not in STOPWORDS and len(w) > 2}


def similar(a, b):
    """Jaccard overlap of two keyword sets: shared words / total words."""
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def cluster(stories):
    """Merge stories covering the same event. Keeps the highest-weight source."""
    stories = sorted(stories, key=lambda s: s["ts"], reverse=True)
    for s in stories:
        s["_kw"] = keywords(s["title"])
        s["_dt"] = datetime.fromisoformat(s["ts"])

    clusters = []
    for s in stories:
        placed = False
        for c in clusters:
            head = c[0]
            gap = abs((head["_dt"] - s["_dt"]).total_seconds()) / 3600
            if gap <= CLUSTER_WINDOW_HRS and \
               similar(head["_kw"], s["_kw"]) >= CLUSTER_THRESHOLD:
                c.append(s)
                placed = True
                break
        if not placed:
            clusters.append([s])

    out = []
    for c in clusters:
        # the most authoritative source in the cluster leads
        lead = max(c, key=lambda s: (s["weight"], s["ts"]))
        others = sorted({s["source"] for s in c if s["source"] != lead["source"]})
        out.append({
            "id": lead["id"],
            "ts": lead["ts"],
            "source": lead["source"],
            "region": lead["region"],
            "topic": tag_topic(lead),
            "bias": "neutral",          # version B fills this in properly
            "score": score_item(lead, len(c)),
            "title": lead["title"],
            "sum": "",                  # version B fills this in
            "why": "",                  # version B fills this in
            "extra": len(others),
            "also": others,
            "url": lead["url"],
        })
    return out


def score_item(lead, cluster_size):
    """Crude stand-in for judgement: source authority + how widely covered."""
    return min(99, lead["weight"] * 5 + (cluster_size - 1) * 8)


# ── step 4: merge with history ────────────────────────────────────
def merge(fresh, existing):
    """Existing items win, so a story is never re-dated or re-written."""
    by_id = {i["id"]: i for i in existing}
    added = 0
    for item in fresh:
        if item["id"] not in by_id:
            by_id[item["id"]] = item
            added += 1

    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    kept = [i for i in by_id.values()
            if datetime.fromisoformat(i["ts"]) >= cutoff]
    kept.sort(key=lambda i: i["ts"], reverse=True)
    return kept, added, len(by_id) - len(kept)


def load_existing():
    try:
        with open(OUTPUT_FILE) as fh:
            data = json.load(fh)
        return data.get("items", []) if isinstance(data, dict) else data
    except (FileNotFoundError, json.JSONDecodeError):
        return []


# ── main ──────────────────────────────────────────────────────────
def main():
    with open(SOURCES_FILE) as fh:
        feeds = json.load(fh)["feeds"]

    log(f"Fetching {len(feeds)} feeds\n")
    raw, report = fetch_all(feeds)

    log("  FEED REPORT")
    for name, status, n in report:
        mark = "  ok " if status.startswith("ok") else "  !! "
        log(f"{mark}{name:<34} {status:<28} {n} entries")

    alive = sum(1 for _, s, _ in report if s.startswith("ok"))
    if alive == 0:
        log("\nNo feeds returned anything. Not writing feed.json.")
        sys.exit(1)

    log(f"\n{len(raw)} stories fetched from {alive} live feeds")

    grouped = cluster(raw)
    log(f"{len(grouped)} stories after merging duplicates")

    existing = load_existing()
    items, added, dropped = merge(grouped, existing)
    log(f"{added} new, {dropped} aged out, {len(items)} in feed")

    with open(OUTPUT_FILE, "w") as fh:
        json.dump({
            "generated": datetime.now(timezone.utc).isoformat(),
            "items": items,
        }, fh, indent=1, ensure_ascii=False)

    log(f"\nWrote {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
