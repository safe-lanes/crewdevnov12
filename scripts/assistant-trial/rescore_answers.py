"""Re-apply the answer regexes of a (corrected) test-set file to SAVED answers — used once, after the backspace
encoding defect in test-set-context.json was fixed. Query/data scores are unchanged; originals are not modified."""
import json, re, sys
set_file, results_in, results_out = sys.argv[1:4]
turns = {(c["id"], i + 1): t for c in json.load(open(set_file, encoding="utf-8"))["cases"] for i, t in enumerate(c["turns"])}
rows = json.load(open(results_in, encoding="utf-8"))
for r in rows:
    t = turns[(r["id"], r["turn"])]
    r["missing"] = [x for x in t.get("answerAll", []) if not re.search(x, r["answer"], re.I)]
    r["forbidden"] = [x for x in t.get("answerNone", []) if re.search(x, r["answer"], re.I)]
    r["answerOk"] = not r["missing"] and not r["forbidden"]
    r["pass"] = r["answerOk"] and r["queryOk"] is not False and r["dataOk"] is not False and r["status"] == 200
    r["rescored"] = "answer regexes re-applied after fixing the backspace encoding defect"
json.dump(rows, open(results_out, "w", encoding="utf-8"), indent=1)
for r in rows:
    print(("PASS" if r["pass"] else "FAIL"), f"{r['id']}.{r['turn']}", "q", r["queryOk"], "d", r["dataOk"], "a", r["answerOk"], r["missing"] or "")
print(sum(r["pass"] for r in rows), "/", len(rows))
