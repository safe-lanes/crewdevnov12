"""
PILOT TRIAL — privacy inspection of the COMPLETE outbound model requests (ASSISTANT_CAPTURE_OUTBOUND wire bodies).

Searches every request for every synthetic person and vessel name of the trial fixture and reports each hit with its
location: system prompt · current user message · history (earlier user/assistant turns) · tool-call arguments ·
tool results (rows, groups, errors, filters echo) · tool schemas. Names are synthetic (setup-trial-dbs.ts).

Usage: python inspect_capture.py <capture.jsonl> [first_line] [last_line]   (1-based, inclusive)
"""
import json
import re
import sys
from collections import Counter

PEOPLE = ("Aldric Vexmoor Benedek Quorrlyn Corvina Tallowind Dagny Brisketh Elsbet Orvanne Faustin Kelderwick Gisla Marrowfen "
          "Hadrian Pellisande Ilvar Strandquist Jorund Talmace Kestrel Duvanne Lusine Ferrowby Marek Oldenvaal Nadira Sklemmon "
          "Orrin Haverlock Petra Wintermarsh Quillon Rasterby Rasmine Thornquay Sefton Grallowmere Tamsin Ebberline Ulric Penhallow "
          "Vesna Ardcaster Wendel Crossfeather Xanthe Moorgrave Yorick Fellhammer Zelia Brantwood Abelard Nettlecombe Brisa "
          "Halvorcrest Cormac Tidewellyn").split()
VESSELS = ["Alpha Star", "Beta Ocean", "Gamma Bay", "Alpha Trader", "Delta Sky"]
TERMS = [(p, "person") for p in PEOPLE] + [(v, "vessel") for v in VESSELS]


def hits(text: str):
    for term, kind in TERMS:
        if re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text, re.I):
            yield term, kind


def main() -> None:
    path = sys.argv[1]
    lines = open(path, encoding="utf-8").read().splitlines()
    first = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    last = int(sys.argv[3]) if len(sys.argv) > 3 else len(lines)
    findings = []
    places = Counter()
    for n in range(first, last + 1):
        body = json.loads(json.loads(lines[n - 1])["body"])
        msgs = body.get("messages") or []
        last_user = max((i for i, m in enumerate(msgs) if m.get("role") == "user"), default=-1)
        for i, m in enumerate(msgs):
            role = m.get("role")
            content = m.get("content")
            text = content if isinstance(content, str) else json.dumps(content or "")
            if role == "system":
                where = "system"
            elif role == "user":
                where = "current-user-message" if i == last_user else "history-user"
            elif role == "assistant":
                where = "history-assistant" if i < last_user else "this-turn-assistant"
            elif role == "tool":
                where = "tool-result"
            else:
                where = role or "?"
            for term, kind in hits(text):
                findings.append((n, where, kind, term))
            for tc in m.get("tool_calls") or []:
                for term, kind in hits(tc.get("function", {}).get("arguments", "")):
                    findings.append((n, "tool-call-arguments", kind, term))
        for term, kind in hits(json.dumps(body.get("tools") or [])):
            findings.append((n, "tool-schemas", kind, term))
    for f in findings:
        places[(f[1], f[2])] += 1
    print(f"requests inspected: {last - first + 1} (lines {first}-{last}); hits: {len(findings)}")
    for (where, kind), c in sorted(places.items()):
        print(f"  {where:24s} {kind:7s} {c}")
    for f in findings[:200]:
        print(f"  line {f[0]:5d}  {f[1]:24s} {f[2]:7s} {f[3]}")


CATEGORY = {
    "tool-result": "names returned by tools (visible in tool results)",
    "history-assistant": "names replayed through earlier ASSISTANT answers",
    "history-user": "names the user typed in EARLIER turns (replayed)",
    "current-user-message": "names the user typed in THIS turn",
    "tool-call-arguments": "names the model wrote into tool arguments",
    "system": "system prompt", "tool-schemas": "tool schemas", "this-turn-assistant": "this turn's assistant text",
}


def classify(lines: list[str], first: int, last: int) -> dict:
    counts: dict[str, list[str]] = {}
    masked_tool_tokens = 0
    for n in range(first, last + 1):
        body = json.loads(json.loads(lines[n - 1])["body"])
        msgs = body.get("messages") or []
        last_user = max((i for i, m in enumerate(msgs) if m.get("role") == "user"), default=-1)
        for i, m in enumerate(msgs):
            role = m.get("role")
            text = m.get("content") if isinstance(m.get("content"), str) else json.dumps(m.get("content") or "")
            where = {"system": "system", "tool": "tool-result"}.get(role) or (
                ("current-user-message" if i == last_user else "history-user") if role == "user" else
                ("history-assistant" if i < last_user else "this-turn-assistant"))
            if role == "tool":
                masked_tool_tokens += len(re.findall(r"\[(PERSON|VESSEL)_\d+\]", text))
            for term, _ in hits(text):
                counts.setdefault(where, []).append(term)
            for tc in m.get("tool_calls") or []:
                for term, _ in hits(tc.get("function", {}).get("arguments", "")):
                    counts.setdefault("tool-call-arguments", []).append(term)
        for term, _ in hits(json.dumps(body.get("tools") or [])):
            counts.setdefault("tool-schemas", []).append(term)
    return {"requests": last - first + 1, "maskedTokensInToolResults": masked_tool_tokens,
            "visible": {k: sorted(set(v)) for k, v in counts.items()}}


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[2] == "--ranges":
        cap = open(sys.argv[1], encoding="utf-8").read().splitlines()
        for row in json.load(open(sys.argv[3], encoding="utf-8")):
            if row["end"] < row["start"]:
                print(row["scenario"], "no model request"); continue
            c = classify(cap, row["start"], row["end"])
            print(f"{row['scenario']:36s} requests {c['requests']}  masked-in-tool-results {c['maskedTokensInToolResults']}")
            for k, v in c["visible"].items():
                print(f"    VISIBLE {k:22s} {', '.join(v)}")
    else:
        main()
