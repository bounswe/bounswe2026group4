#!/usr/bin/env python3
"""
Read pytest-json-report (backend), vitest --reporter=json (frontend),
and jest --json (mobile) output files and generate a single Markdown wiki page.
"""

import json
import os
from datetime import datetime, timezone

WORKSPACE = os.environ.get("GITHUB_WORKSPACE", ".")
SERVER_URL = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "")
RUN_ID = os.environ.get("GITHUB_RUN_ID", "")
RUN_URL = f"{SERVER_URL}/{REPOSITORY}/actions/runs/{RUN_ID}" if RUN_ID else ""


def _icon(outcome):
    return {"passed": "✅", "failed": "❌", "skipped": "⚠️", "pending": "⚠️"}.get(
        outcome.lower(), "⚠️"
    )


def _fmt_ms(ms):
    if ms is None:
        return "—"
    if ms < 1000:
        return f"{int(ms)} ms"
    return f"{ms / 1000:.2f} s"


def _summary_line(passed, failed, skipped, total, duration_s):
    status = "✅ All passed" if failed == 0 else f"❌ {failed} failed"
    return (
        f"**{status}**"
        f" &nbsp;·&nbsp; {passed} passed"
        f" &nbsp;·&nbsp; {failed} failed"
        f" &nbsp;·&nbsp; {skipped} skipped"
        f" &nbsp;·&nbsp; {total} total"
        f" &nbsp;·&nbsp; {duration_s:.2f} s"
    )


# ── Backend ───────────────────────────────────────────────────────────────────

def backend_section(path):
    lines = ["## 🐍 Backend — Django / pytest", ""]

    if not os.path.exists(path):
        lines += ["_Report not generated — test run did not complete._", ""]
        return lines

    with open(path) as f:
        data = json.load(f)

    s = data.get("summary", {})
    passed = s.get("passed", 0)
    failed = s.get("failed", 0)
    skipped = s.get("skipped", 0) + s.get("xfailed", 0)
    total = s.get("total", passed + failed + skipped)
    duration = data.get("duration", 0)

    lines += [_summary_line(passed, failed, skipped, total, duration), ""]

    tests = data.get("tests", [])
    if tests:
        lines += ["<details>", "<summary>Full test list</summary>", ""]
        lines += ["| Test | Status | Duration |", "|------|--------|----------|"]
        for t in tests:
            node = t.get("nodeid", "")
            # Keep only the last two :: segments for readability
            parts = node.split("::")
            short = "::".join(parts[-2:]) if len(parts) >= 2 else node
            outcome = t.get("outcome", "unknown")
            dur = t.get("duration", 0) * 1000  # pytest reports in seconds
            lines.append(f"| `{short}` | {_icon(outcome)} {outcome} | {_fmt_ms(dur)} |")
        lines += ["", "</details>", ""]

    return lines


# ── Frontend / Mobile (Jest-compatible JSON) ──────────────────────────────────

def jest_section(path, title, emoji):
    lines = [f"## {emoji} {title}", ""]

    if not os.path.exists(path):
        lines += ["_Report not generated — test run did not complete._", ""]
        return lines

    with open(path) as f:
        data = json.load(f)

    passed = data.get("numPassedTests", 0)
    failed = data.get("numFailedTests", 0)
    skipped = data.get("numPendingTests", 0) + data.get("numTodoTests", 0)
    total = data.get("numTotalTests", passed + failed + skipped)

    # Duration: sum (endTime - startTime) across all suites (milliseconds)
    duration_ms = sum(
        (r.get("endTime", 0) - r.get("startTime", 0))
        for r in data.get("testResults", [])
    )

    lines += [_summary_line(passed, failed, skipped, total, duration_ms / 1000), ""]

    test_results = data.get("testResults", [])
    if test_results:
        lines += ["<details>", "<summary>Full test list</summary>", ""]
        lines += [
            "| Suite | Test | Status | Duration |",
            "|-------|------|--------|----------|",
        ]
        for suite in test_results:
            raw_path = suite.get("testFilePath", suite.get("name", ""))
            basename = os.path.basename(raw_path)
            # Strip common suffixes for a cleaner label
            for suffix in (".test.jsx", ".test.tsx", ".test.js", ".test.ts",
                           ".spec.jsx", ".spec.tsx", ".spec.js", ".spec.ts"):
                basename = basename.removesuffix(suffix)

            for assertion in suite.get("assertionResults", []):
                name = assertion.get("fullName", assertion.get("title", ""))
                outcome = assertion.get("status", "unknown")
                dur = assertion.get("duration", None)
                lines.append(
                    f"| `{basename}` | {name} | {_icon(outcome)} {outcome} | {_fmt_ms(dur)} |"
                )
        lines += ["", "</details>", ""]

    return lines


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    run_link = f"[CI run]({RUN_URL})" if RUN_URL else "CI run"

    md = [
        "# Generated Unit Test Reports",
        "",
        f"_Auto-generated: {now} — {run_link}_",
        "",
        "---",
        "",
    ]

    md += backend_section(os.path.join(WORKSPACE, "backend-report.json"))
    md += ["---", ""]
    md += jest_section(
        os.path.join(WORKSPACE, "frontend-report.json"),
        "Frontend — React / Vitest",
        "⚛️",
    )
    md += ["---", ""]
    md += jest_section(
        os.path.join(WORKSPACE, "mobile-report.json"),
        "Mobile — React Native / Jest",
        "📱",
    )

    output_path = os.path.join(WORKSPACE, "Generated-Unit-Test-Reports.md")
    with open(output_path, "w") as f:
        f.write("\n".join(md) + "\n")

    print(f"Report written to {output_path}")


if __name__ == "__main__":
    main()
