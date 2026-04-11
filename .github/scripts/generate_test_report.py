#!/usr/bin/env python3
"""
Read pytest-json-report (backend), vitest --reporter=json (frontend),
and jest --json (mobile) output files and generate separate Markdown wiki
pages for each suite plus an index page.

Output files (written to GITHUB_WORKSPACE):
  Backend-Generated-Unit-Test-Reports.md
  Frontend-Generated-Unit-Test-Reports.md
  Mobile-Generated-Unit-Test-Reports.md
  Generated-Unit-Test-Reports.md  (index linking to the three above)
"""

import json
import os
from datetime import datetime, timezone

WORKSPACE = os.environ.get("GITHUB_WORKSPACE", ".")
SERVER_URL = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "")
RUN_ID = os.environ.get("GITHUB_RUN_ID", "")
RUN_URL = f"{SERVER_URL}/{REPOSITORY}/actions/runs/{RUN_ID}" if RUN_ID else ""

WIKI_BASE = f"{SERVER_URL}/{REPOSITORY}/wiki"


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


def _page_header(title, now, run_link):
    return [
        f"# {title}",
        "",
        f"_Auto-generated: {now} — {run_link}_",
        "",
        "---",
        "",
    ]


# ── Backend ───────────────────────────────────────────────────────────────────

def build_backend_page(path, now, run_link):
    lines = _page_header("Backend Generated Unit Test Reports", now, run_link)

    if not os.path.exists(path):
        lines += ["_Report not generated — test run did not complete._", ""]
        return lines, None  # None = no summary for index

    with open(path) as f:
        data = json.load(f)

    s = data.get("summary", {})
    passed = s.get("passed", 0)
    failed = s.get("failed", 0)
    skipped = s.get("skipped", 0) + s.get("xfailed", 0)
    total = s.get("total", passed + failed + skipped)
    duration = data.get("duration", 0)

    summary = _summary_line(passed, failed, skipped, total, duration)
    lines += [summary, ""]

    tests = data.get("tests", [])
    if tests:
        lines += ["<details>", "<summary>Full test list</summary>", ""]
        lines += ["| Test | Status | Duration |", "|------|--------|----------|"]
        for t in tests:
            node = t.get("nodeid", "")
            parts = node.split("::")
            short = "::".join(parts[-2:]) if len(parts) >= 2 else node
            outcome = t.get("outcome", "unknown")
            dur = t.get("duration", 0) * 1000
            lines.append(f"| `{short}` | {_icon(outcome)} {outcome} | {_fmt_ms(dur)} |")
        lines += ["", "</details>", ""]

    return lines, summary


# ── Frontend / Mobile (Jest-compatible JSON) ──────────────────────────────────

def build_jest_page(path, title, now, run_link):
    lines = _page_header(title, now, run_link)

    if not os.path.exists(path):
        lines += ["_Report not generated — test run did not complete._", ""]
        return lines, None

    with open(path) as f:
        data = json.load(f)

    passed = data.get("numPassedTests", 0)
    failed = data.get("numFailedTests", 0)
    skipped = data.get("numPendingTests", 0) + data.get("numTodoTests", 0)
    total = data.get("numTotalTests", passed + failed + skipped)
    duration_ms = sum(
        (r.get("endTime", 0) - r.get("startTime", 0))
        for r in data.get("testResults", [])
    )

    summary = _summary_line(passed, failed, skipped, total, duration_ms / 1000)
    lines += [summary, ""]

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

    return lines, summary


# ── Index page ────────────────────────────────────────────────────────────────

def build_index_page(backend_summary, frontend_summary, mobile_summary, now, run_link):
    def row(emoji, label, slug, summary):
        link = f"[{label}]({WIKI_BASE}/{slug})"
        return f"| {emoji} {link} | {summary or '_pending_'} |"

    lines = [
        "# Generated Unit Test Reports",
        "",
        f"_Auto-generated: {now} — {run_link}_",
        "",
        "| Suite | Result |",
        "|-------|--------|",
        row("🐍", "Backend", "Backend-Generated-Unit-Test-Reports", backend_summary),
        row("⚛️", "Frontend", "Frontend-Generated-Unit-Test-Reports", frontend_summary),
        row("📱", "Mobile", "Mobile-Generated-Unit-Test-Reports", mobile_summary),
        "",
    ]
    return lines


# ── Main ──────────────────────────────────────────────────────────────────────

def write(filename, lines):
    path = os.path.join(WORKSPACE, filename)
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"Written: {path}")


def main():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    run_link = f"[CI run]({RUN_URL})" if RUN_URL else "CI run"

    backend_lines, backend_summary = build_backend_page(
        os.path.join(WORKSPACE, "backend-report.json"), now, run_link
    )
    frontend_lines, frontend_summary = build_jest_page(
        os.path.join(WORKSPACE, "frontend-report.json"),
        "Frontend Generated Unit Test Reports", now, run_link
    )
    mobile_lines, mobile_summary = build_jest_page(
        os.path.join(WORKSPACE, "mobile-report.json"),
        "Mobile Generated Unit Test Reports", now, run_link
    )
    index_lines = build_index_page(
        backend_summary, frontend_summary, mobile_summary, now, run_link
    )

    write("Backend-Generated-Unit-Test-Reports.md", backend_lines)
    write("Frontend-Generated-Unit-Test-Reports.md", frontend_lines)
    write("Mobile-Generated-Unit-Test-Reports.md", mobile_lines)
    write("Generated-Unit-Test-Reports.md", index_lines)


if __name__ == "__main__":
    main()
