"""PILOT TRIAL — summary of one or more results/<run>.json files (pass rates, axes, latency, model calls, tokens, cost).

Cost is an ESTIMATE: scaled from the measured luna figure of 4-Sep-2026 (≈ $0.62 per 1,000 answers at ≈1,517 input +
266 output tokens per answer, project log), i.e. per-token prices are not known here — only that ratio.
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
    print(f"tokens per turn  in {mean_in:.0f} · out {mean_out:.0f}" + (f" · est. cost ≈ ${est * 1000:.2f} per 1,000 turns (ESTIMATE)" if est else ""))
    print("by category  " + " · ".join(f"{k} {v[0]}/{v[1]}" for k, v in sorted(cats.items())))
    fails = [f"{r['id']}.{r['turn']}" for r in rows if not r["pass"]]
    print("failed  " + (", ".join(fails) or "none"))
