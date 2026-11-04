"""
PILOT TRIAL (Astra round 3) — for each scenario of results/masking-checks-r3.json, inspect its captured outbound model
requests (capture.jsonl line range) and report: how many history-user / history-assistant messages were sent to the
provider, and every synthetic person or vessel name found, by location. Companion of inspect_capture.py.

Usage: python inspect_roles.py <capture.jsonl> <masking-checks-r3.json>
"""
import json
import re
import sys
from collections import Counter

from inspect_capture import hits  # same synthetic-name list and matcher


def main() -> None:
    cap = open(sys.argv[1], encoding="utf-8").read().splitlines()
    rows = json.load(open(sys.argv[2], encoding="utf-8"))
    print(f"{'scenario':38} {'lines':9} {'reqs':4} {'histU':5} {'histA':5} {'discarded':10} names-on-wire")
    for r in rows:
        roles = Counter()
        found = Counter()
        reqs = 0
        for n in range(int(r["start"]), int(r["end"]) + 1):
            if n < 1 or n > len(cap):
                continue
            body = json.loads(json.loads(cap[n - 1])["body"])
            msgs = body.get("messages") or []
            reqs += 1
            last_user = max((i for i, m in enumerate(msgs) if m.get("role") == "user"), default=-1)
            for i, m in enumerate(msgs):
                role = m.get("role")
                content = m.get("content")
                text = content if isinstance(content, str) else json.dumps(content or "")
                if role == "user" and i < last_user:
                    where = "history-user"
                elif role == "assistant" and i < last_user:
                    where = "history-assistant"
                elif role == "user":
                    where = "current-user"
                elif role == "assistant":
                    where = "this-turn-assistant"
                else:
                    where = role or "?"
                if where in ("history-user", "history-assistant"):
                    roles[where] += 1
                for term, kind in hits(text):
                    found[f"{where}:{kind}:{term}"] += 1
                for tc in m.get("tool_calls") or []:
                    for term, kind in hits(tc.get("function", {}).get("arguments", "")):
                        found[f"tool-call-args:{kind}:{term}"] += 1
        names = ", ".join(f"{k}×{v}" for k, v in sorted(found.items())) or "-"
        print(f"{r['scenario']:38} {r['start']}-{r['end']:<5} {reqs:4} {roles['history-user']:5} {roles['history-assistant']:5} "
              f"{str(r.get('historyDiscarded')):10} {names}")
        notice = re.search(r"\((Earlier messages[^)]*)\)", r.get("answer", ""))
        print(f"{'':38} answer: {r.get('answer', '')[:150].replace(chr(10), ' ')}{' …' if len(r.get('answer', '')) > 150 else ''}")
        if notice:
            print(f"{'':38} notice: {notice.group(1)[:110]} …")


if __name__ == "__main__":
    main()
