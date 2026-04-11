#!/usr/bin/env python3
"""
Read pytest-json-report (backend), vitest --reporter=json (frontend),
and jest --json (mobile) output files and generate:
  - Self-contained HTML report per suite
  - Markdown wiki page per suite (links to HTML report)
  - Markdown index page

HTML files are pushed to the wiki repo and served via htmlpreview.github.io.

Output files (written to GITHUB_WORKSPACE):
  Backend-Generated-Unit-Test-Reports.html
  Frontend-Generated-Unit-Test-Reports.html
  Mobile-Generated-Unit-Test-Reports.html
  Backend-Generated-Unit-Test-Reports.md
  Frontend-Generated-Unit-Test-Reports.md
  Mobile-Generated-Unit-Test-Reports.md
  Generated-Unit-Test-Reports.md  (index)
"""

import html as html_lib
import json
import os
from datetime import datetime, timezone

WORKSPACE = os.environ.get("GITHUB_WORKSPACE", ".")
SERVER_URL = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "")
RUN_ID = os.environ.get("GITHUB_RUN_ID", "")
RUN_URL = f"{SERVER_URL}/{REPOSITORY}/actions/runs/{RUN_ID}" if RUN_ID else ""
WIKI_BASE = f"{SERVER_URL}/{REPOSITORY}/wiki"
WIKI_RAW_BASE = (
    f"https://raw.githubusercontent.com/wiki/"
    + REPOSITORY
    if REPOSITORY
    else ""
)
HTMLPREVIEW_BASE = "https://htmlpreview.github.io/?"


# ── Shared helpers ────────────────────────────────────────────────────────────

def _md_icon(outcome):
    return {"passed": "✅", "failed": "❌", "skipped": "⚠️", "pending": "⚠️"}.get(
        outcome.lower(), "⚠️"
    )


def _fmt_ms(ms):
    if ms is None:
        return "—"
    if ms < 1000:
        return f"{int(ms)} ms"
    return f"{ms / 1000:.2f} s"


def _md_summary_line(passed, failed, skipped, total, duration_s):
    status = "✅ All passed" if failed == 0 else f"❌ {failed} failed"
    return (
        f"**{status}**"
        f" &nbsp;·&nbsp; {passed} passed"
        f" &nbsp;·&nbsp; {failed} failed"
        f" &nbsp;·&nbsp; {skipped} skipped"
        f" &nbsp;·&nbsp; {total} total"
        f" &nbsp;·&nbsp; {duration_s:.2f} s"
    )


# ── HTML generation ───────────────────────────────────────────────────────────

_HTML_CSS = """
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f8fafc; color: #1e293b; padding: 32px 24px;
}
.container { max-width: 1100px; margin: 0 auto; }
h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 6px; }
.meta { font-size: 0.85rem; color: #64748b; margin-bottom: 24px; }
.meta a { color: #3b82f6; text-decoration: none; }
.meta a:hover { text-decoration: underline; }
.summary {
  display: flex; gap: 20px; flex-wrap: wrap;
  background: white; border: 1px solid #e2e8f0;
  border-radius: 12px; padding: 20px 24px; margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}
.stat { display: flex; flex-direction: column; align-items: center; min-width: 70px; }
.stat-value { font-size: 2rem; font-weight: 800; line-height: 1; }
.stat-label {
  font-size: 0.7rem; color: #94a3b8;
  text-transform: uppercase; letter-spacing: .06em; margin-top: 4px;
}
.c-pass { color: #16a34a; }
.c-fail { color: #dc2626; }
.c-skip { color: #d97706; }
.c-neutral { color: #334155; }
.progress {
  height: 8px; border-radius: 4px; background: #e2e8f0;
  margin-bottom: 28px; overflow: hidden; display: flex;
}
.progress-pass { background: #16a34a; }
.progress-fail { background: #dc2626; }
.progress-skip { background: #d97706; }
.card {
  background: white; border: 1px solid #e2e8f0;
  border-radius: 12px; overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}
table { width: 100%; border-collapse: collapse; }
thead th {
  background: #1e293b; color: #e2e8f0;
  padding: 11px 16px; text-align: left;
  font-size: 0.75rem; text-transform: uppercase; letter-spacing: .06em;
}
tbody tr { transition: background .1s; }
tbody tr:hover { background: #f1f5f9; }
tbody tr.row-fail { background: #fef2f2; }
tbody tr.row-fail:hover { background: #fee2e2; }
tbody tr:last-child td { border-bottom: none; }
td { padding: 9px 16px; border-bottom: 1px solid #f1f5f9; font-size: 0.875rem; }
.badge {
  display: inline-block; padding: 2px 10px;
  border-radius: 99px; font-size: 0.72rem; font-weight: 600;
}
.badge-pass { background: #dcfce7; color: #15803d; }
.badge-fail { background: #fee2e2; color: #b91c1c; }
.badge-skip { background: #fef9c3; color: #a16207; }
.mono { font-family: 'Menlo', 'Monaco', 'Consolas', monospace; font-size: 0.8rem; }
.suite { color: #6366f1; }
.dur { color: #94a3b8; }
.pending-note {
  padding: 40px; text-align: center;
  color: #94a3b8; font-style: italic;
}
"""

_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>{css}</style>
</head>
<body>
<div class="container">
  <h1>{title}</h1>
  <p class="meta">Auto-generated: {now}{run_link_html}</p>
  {body}
</div>
</body>
</html>
"""


def _badge(outcome):
    o = outcome.lower()
    if o == "passed":
        return '<span class="badge badge-pass">passed</span>'
    if o == "failed":
        return '<span class="badge badge-fail">failed</span>'
    return '<span class="badge badge-skip">skipped</span>'


def _row_class(outcome):
    return ' class="row-fail"' if outcome.lower() == "failed" else ""


def _progress_bar(passed, failed, skipped, total):
    if total == 0:
        return ""
    p_pct = passed / total * 100
    f_pct = failed / total * 100
    s_pct = skipped / total * 100
    return (
        '<div class="progress">'
        f'<div class="progress-pass" style="width:{p_pct:.1f}%"></div>'
        f'<div class="progress-fail" style="width:{f_pct:.1f}%"></div>'
        f'<div class="progress-skip" style="width:{s_pct:.1f}%"></div>'
        "</div>"
    )


def _summary_block(passed, failed, skipped, total, duration_s):
    sc = "c-fail" if failed > 0 else "c-pass"
    return (
        f'<div class="summary">'
        f'<div class="stat"><span class="stat-value {sc}">{total}</span>'
        f'<span class="stat-label">Total</span></div>'
        f'<div class="stat"><span class="stat-value c-pass">{passed}</span>'
        f'<span class="stat-label">Passed</span></div>'
        f'<div class="stat"><span class="stat-value c-fail">{failed}</span>'
        f'<span class="stat-label">Failed</span></div>'
        f'<div class="stat"><span class="stat-value c-skip">{skipped}</span>'
        f'<span class="stat-label">Skipped</span></div>'
        f'<div class="stat"><span class="stat-value c-neutral">{duration_s:.1f}s</span>'
        f'<span class="stat-label">Duration</span></div>'
        f"</div>"
    )


def build_html(title, now, run_url, passed, failed, skipped, total, duration_s, rows_html, col_headers):
    run_link_html = (
        f' — <a href="{html_lib.escape(run_url)}">CI run</a>' if run_url else ""
    )
    summary = _summary_block(passed, failed, skipped, total, duration_s)
    progress = _progress_bar(passed, failed, skipped, total)
    headers = "".join(f"<th>{h}</th>" for h in col_headers)

    if rows_html:
        table = (
            f'<div class="card"><table>'
            f"<thead><tr>{headers}</tr></thead>"
            f"<tbody>{rows_html}</tbody>"
            f"</table></div>"
        )
    else:
        table = '<div class="card"><p class="pending-note">No test data available.</p></div>'

    body = summary + progress + table
    return _HTML_TEMPLATE.format(
        title=html_lib.escape(title),
        css=_HTML_CSS,
        now=html_lib.escape(now),
        run_link_html=run_link_html,
        body=body,
    )


# ── Backend ───────────────────────────────────────────────────────────────────

def process_backend(path, now):
    title = "Backend Generated Unit Test Reports"

    if not os.path.exists(path):
        html_out = _HTML_TEMPLATE.format(
            title=html_lib.escape(title), css=_HTML_CSS, now=html_lib.escape(now),
            run_link_html="",
            body='<div class="card"><p class="pending-note">Report not generated — test run did not complete.</p></div>',
        )
        return html_out, None, None

    with open(path) as f:
        data = json.load(f)

    s = data.get("summary", {})
    passed = s.get("passed", 0)
    failed = s.get("failed", 0)
    skipped = s.get("skipped", 0) + s.get("xfailed", 0)
    total = s.get("total", passed + failed + skipped)
    duration_s = data.get("duration", 0)

    # HTML rows
    rows = []
    for t in data.get("tests", []):
        node = t.get("nodeid", "")
        parts = node.split("::")
        short = "::".join(parts[-2:]) if len(parts) >= 2 else node
        outcome = t.get("outcome", "unknown")
        dur = t.get("duration", 0) * 1000
        rows.append(
            f'<tr{_row_class(outcome)}>'
            f'<td class="mono">{html_lib.escape(short)}</td>'
            f"<td>{_badge(outcome)}</td>"
            f'<td class="dur">{_fmt_ms(dur)}</td>'
            f"</tr>"
        )

    html_out = build_html(
        title, now, RUN_URL, passed, failed, skipped, total, duration_s,
        "".join(rows), ["Test", "Status", "Duration"],
    )
    md_summary = _md_summary_line(passed, failed, skipped, total, duration_s)
    return html_out, md_summary, (passed, failed, skipped, total, duration_s)


# ── Frontend / Mobile (Jest-compatible JSON) ──────────────────────────────────

def process_jest(path, title, now):
    if not os.path.exists(path):
        html_out = _HTML_TEMPLATE.format(
            title=html_lib.escape(title), css=_HTML_CSS, now=html_lib.escape(now),
            run_link_html="",
            body='<div class="card"><p class="pending-note">Report not generated — test run did not complete.</p></div>',
        )
        return html_out, None, None

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
    duration_s = duration_ms / 1000

    rows = []
    for suite in data.get("testResults", []):
        raw_path = suite.get("testFilePath", suite.get("name", ""))
        basename = os.path.basename(raw_path)
        for suffix in (".test.jsx", ".test.tsx", ".test.js", ".test.ts",
                       ".spec.jsx", ".spec.tsx", ".spec.js", ".spec.ts"):
            basename = basename.removesuffix(suffix)
        for assertion in suite.get("assertionResults", []):
            name = assertion.get("fullName", assertion.get("title", ""))
            outcome = assertion.get("status", "unknown")
            dur = assertion.get("duration", None)
            rows.append(
                f'<tr{_row_class(outcome)}>'
                f'<td class="mono suite">{html_lib.escape(basename)}</td>'
                f'<td class="mono">{html_lib.escape(name)}</td>'
                f"<td>{_badge(outcome)}</td>"
                f'<td class="dur">{_fmt_ms(dur)}</td>'
                f"</tr>"
            )

    html_out = build_html(
        title, now, RUN_URL, passed, failed, skipped, total, duration_s,
        "".join(rows), ["Suite", "Test", "Status", "Duration"],
    )
    md_summary = _md_summary_line(passed, failed, skipped, total, duration_s)
    return html_out, md_summary, (passed, failed, skipped, total, duration_s)


# ── Markdown pages ────────────────────────────────────────────────────────────

def _htmlpreview_url(filename):
    raw = f"https://raw.githubusercontent.com/wiki/{REPOSITORY}/{filename}"
    return f"{HTMLPREVIEW_BASE}{raw}"


def build_md_suite_page(title, slug, now, md_summary, stats, json_path, is_backend):
    html_filename = f"{slug}.html"
    preview_url = _htmlpreview_url(html_filename)
    run_link = f"[CI run]({RUN_URL})" if RUN_URL else "CI run"

    lines = [
        f"# {title}",
        "",
        f"_Auto-generated: {now} — {run_link}_",
        "",
        f"**[📄 View full HTML report]({preview_url})**",
        "",
        "---",
        "",
    ]

    if md_summary is None:
        lines += ["_Report not generated — test run did not complete._", ""]
        return lines

    lines += [md_summary, ""]

    if not os.path.exists(json_path):
        return lines

    with open(json_path) as f:
        data = json.load(f)

    if is_backend:
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
                lines.append(f"| `{short}` | {_md_icon(outcome)} {outcome} | {_fmt_ms(dur)} |")
            lines += ["", "</details>", ""]
    else:
        test_results = data.get("testResults", [])
        if test_results:
            lines += ["<details>", "<summary>Full test list</summary>", ""]
            lines += ["| Suite | Test | Status | Duration |", "|-------|------|--------|----------|"]
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
                    lines.append(f"| `{basename}` | {name} | {_md_icon(outcome)} {outcome} | {_fmt_ms(dur)} |")
            lines += ["", "</details>", ""]

    return lines


def build_md_index(backend_summary, frontend_summary, mobile_summary, now):
    run_link = f"[CI run]({RUN_URL})" if RUN_URL else "CI run"

    def row(emoji, label, slug, summary):
        md_link = f"[{label}]({WIKI_BASE}/{slug})"
        html_link = f"[📄 HTML]({_htmlpreview_url(slug + '.html')})"
        return f"| {emoji} {md_link} | {html_link} | {summary or '_pending_'} |"

    return [
        "# Generated Unit Test Reports",
        "",
        f"_Auto-generated: {now} — {run_link}_",
        "",
        "| Suite | HTML | Result |",
        "|-------|------|--------|",
        row("🐍", "Backend", "Backend-Generated-Unit-Test-Reports", backend_summary),
        row("⚛️", "Frontend", "Frontend-Generated-Unit-Test-Reports", frontend_summary),
        row("📱", "Mobile", "Mobile-Generated-Unit-Test-Reports", mobile_summary),
        "",
    ]


# ── Write helpers ─────────────────────────────────────────────────────────────

def write(filename, content):
    path = os.path.join(WORKSPACE, filename)
    with open(path, "w", encoding="utf-8") as f:
        if isinstance(content, list):
            f.write("\n".join(content) + "\n")
        else:
            f.write(content)
    print(f"Written: {path}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    backend_json = os.path.join(WORKSPACE, "backend-report.json")
    frontend_json = os.path.join(WORKSPACE, "frontend-report.json")
    mobile_json = os.path.join(WORKSPACE, "mobile-report.json")

    backend_html, backend_summary, backend_stats = process_backend(backend_json, now)
    frontend_html, frontend_summary, frontend_stats = process_jest(
        frontend_json, "Frontend Generated Unit Test Reports", now
    )
    mobile_html, mobile_summary, mobile_stats = process_jest(
        mobile_json, "Mobile Generated Unit Test Reports", now
    )

    # HTML reports
    write("Backend-Generated-Unit-Test-Reports.html", backend_html)
    write("Frontend-Generated-Unit-Test-Reports.html", frontend_html)
    write("Mobile-Generated-Unit-Test-Reports.html", mobile_html)

    # Markdown wiki pages (summary + link to HTML + expandable table)
    write("Backend-Generated-Unit-Test-Reports.md",
          build_md_suite_page(
              "Backend Generated Unit Test Reports",
              "Backend-Generated-Unit-Test-Reports",
              now, backend_summary, backend_stats, backend_json, is_backend=True,
          ))
    write("Frontend-Generated-Unit-Test-Reports.md",
          build_md_suite_page(
              "Frontend Generated Unit Test Reports",
              "Frontend-Generated-Unit-Test-Reports",
              now, frontend_summary, frontend_stats, frontend_json, is_backend=False,
          ))
    write("Mobile-Generated-Unit-Test-Reports.md",
          build_md_suite_page(
              "Mobile Generated Unit Test Reports",
              "Mobile-Generated-Unit-Test-Reports",
              now, mobile_summary, mobile_stats, mobile_json, is_backend=False,
          ))

    # Index
    write("Generated-Unit-Test-Reports.md",
          build_md_index(backend_summary, frontend_summary, mobile_summary, now))


if __name__ == "__main__":
    main()
