"""PILOT TRIAL — summary of one or more results/<run>.json files (pass rates, axes, latency, model calls, tokens, cost).

Cost: measured tokens × per-token rates. The official rate was NOT verified (third-party trackers disagree), so two
rate sets are shown and labelled UNVERIFIED. (Round 1 scaled a 4-Sep figure; withdrawn — its rates were never verified.)
Usage: python summarize.py results/run3-final.json [results/run4-repeat.json ...]
"""
import json
import statistics
import sys

REF_TOKENS_IN, REF_TOKENS_OUT, REF_COST_PER_ANSWER = 1517, 266, 0.62 / 1000


def pct(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))] if xs else None


for path in sys.argv[1:]:
    rows = json.load(open(path, encoding="utf-8"))
    n = len(rows)
    passed = sum(r["pass"] for r in rows)
    held = [r for r in rows if r["heldOut"]]
    axes = {a: (sum(1 for r in rows if r[a] is True), sum(1 for r in rows if r[a] is not None)) for a in ("queryOk", "dataOk", "answerOk")}
    lat = [r["latencyMs"] for r in rows if r["status"] == 200]
    calls = [r["modelCalls"] for r in rows if r.get("modelCalls") is not None]
    tin = [r["usage"]["prompt_tokens"] for r in rows if r.get("usage")]
    tout = [r["usage"]["completion_tokens"] for r in rows if r.get("usage")]
    cats: dict[str, list[int]] = {}
    for r in rows:
        c = cats.setdefault(r["cat"], [0, 0])
        c[0] += r["pass"]
        c[1] += 1
    mean_in = statistics.mean(tin) if tin else 0
    mean_out = statistics.mean(tout) if tout else 0
    # scale the reference cost by token volume, input and output weighted as in the reference answer
    est = REF_COST_PER_ANSWER * (mean_in + mean_out) / (REF_TOKENS_IN + REF_TOKENS_OUT) if tin else None
    print(f"== {path}")
    print(f"turns {passed}/{n} pass · held-out {sum(r['pass'] for r in held)}/{len(held)} · development {passed - sum(r['pass'] for r in held)}/{n - len(held)}")
    print("axes  " + " · ".join(f"{a} {ok}/{tot}" for a, (ok, tot) in axes.items()))
    print(f"latency ms  p50 {pct(lat, 50)} · p95 {pct(lat, 95)} · max {max(lat) if lat else None}")
    if calls:
        print(f"model calls per turn  mean {statistics.mean(calls):.2f} · max {max(calls)}")
    print(f"tokens per turn (measured)  in {mean_in:.0f} · out {mean_out:.0f}")
    # cost: OpenAI's own price page was NOT verified; two conflicting third-party rate sets (USD per 1M tokens) shown
    for label, rin, rout in (("third-party A $0.20/$1.20", 0.20, 1.20), ("third-party B $1.00/$6.00", 1.00, 6.00)):
        print(f"    cost UNVERIFIED at {label}: ${(mean_in * rin + mean_out * rout) / 1000:.2f} per 1,000 turns")
    print("by category  " + " · ".join(f"{k} {v[0]}/{v[1]}" for k, v in sorted(cats.items())))
    fails = [f"{r['id']}.{r['turn']}" for r in rows if not r["pass"]]
    print("failed  " + (", ".join(fails) or "none"))
    # classification of FAILED turns (original pass/fail scores above are unchanged)
    cls = {"infrastructure": [], "correct answer via another valid route": [], "wrong or incomplete answer": []}
    for r in rows:
        if r["pass"]:
            continue
        key = f"{r['id']}.{r['turn']}"
        if r["status"] != 200 or str(r["answer"]).startswith("TypeError"):
            cls["infrastructure"].append(key)
        elif r["answerOk"]:
            cls["correct answer via another valid route"].append(key)
        else:
            cls["wrong or incomplete answer"].append(key)
    print("classified  " + " · ".join(f"{k}: {len(v)} {v}" for k, v in cls.items()))
