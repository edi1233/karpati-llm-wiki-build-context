from __future__ import annotations

import gzip
import json
import lzma
import os
import re
import sqlite3
import time
from contextlib import asynccontextmanager, closing
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse


APP_VERSION = os.getenv("APP_VERSION", "dev")
DATA_DIR = Path(os.getenv("DATA_DIR", ".data"))
DB_PATH = Path(os.getenv("DB_PATH", str(DATA_DIR / "pkgmng.db")))
REFRESH_INTERVAL_MINUTES = int(os.getenv("REFRESH_INTERVAL_MINUTES", "360"))
APT_REPOS = os.getenv(
    "APT_REPOS",
    "debian-bookworm|https://deb.debian.org/debian|bookworm|main,"
    "debian-security|https://security.debian.org/debian-security|bookworm-security|main",
)
HTTP_TIMEOUT_SECONDS = float(os.getenv("HTTP_TIMEOUT_SECONDS", "30"))
MAX_PACKAGES_PER_REPO = int(os.getenv("MAX_PACKAGES_PER_REPO", "2500"))


@dataclass(frozen=True)
class AptRepo:
    name: str
    base_url: str
    suite: str
    component: str

    @property
    def packages_urls(self) -> list[str]:
        base = self.base_url.rstrip("/")
        rel = f"dists/{self.suite}/{self.component}/binary-amd64/Packages"
        return [f"{base}/{rel}.xz", f"{base}/{rel}.gz", f"{base}/{rel}"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def parse_repos(raw: str = APT_REPOS) -> list[AptRepo]:
    repos: list[AptRepo] = []
    for item in [part.strip() for part in raw.split(",") if part.strip()]:
        parts = [part.strip() for part in item.split("|")]
        if len(parts) != 4:
            raise ValueError("APT_REPOS entries must use name|base_url|suite|component")
        repos.append(AptRepo(*parts))
    return repos


def connect_db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with closing(connect_db()) as conn:
        conn.executescript(
            """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS repos (
              name TEXT PRIMARY KEY,
              base_url TEXT NOT NULL,
              suite TEXT NOT NULL,
              component TEXT NOT NULL,
              last_refresh TEXT,
              package_count INTEGER NOT NULL DEFAULT 0,
              status TEXT NOT NULL DEFAULT 'pending',
              error TEXT
            );
            CREATE TABLE IF NOT EXISTS packages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              repo_name TEXT NOT NULL,
              package TEXT NOT NULL,
              version TEXT NOT NULL,
              architecture TEXT,
              section TEXT,
              priority TEXT,
              filename TEXT,
              size INTEGER,
              sha256 TEXT,
              maintainer TEXT,
              description TEXT,
              security_status TEXT NOT NULL,
              security_findings TEXT NOT NULL,
              refreshed_at TEXT NOT NULL,
              UNIQUE(repo_name, package, version, architecture)
            );
            CREATE INDEX IF NOT EXISTS idx_packages_name ON packages(package);
            CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(security_status);
            """
        )
        for repo in parse_repos():
            conn.execute(
                """
                INSERT INTO repos(name, base_url, suite, component)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                  base_url=excluded.base_url,
                  suite=excluded.suite,
                  component=excluded.component
                """,
                (repo.name, repo.base_url, repo.suite, repo.component),
            )
        conn.commit()


def parse_packages_index(text: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    current: dict[str, str] = {}
    last_key = ""
    for raw_line in text.splitlines():
        if not raw_line:
            if current:
                records.append(current)
                current = {}
                last_key = ""
            continue
        if raw_line.startswith(" ") and last_key:
            current[last_key] = f"{current[last_key]}\n{raw_line[1:]}"
            continue
        if ":" in raw_line:
            key, value = raw_line.split(":", 1)
            last_key = key
            current[key] = value.strip()
    if current:
        records.append(current)
    return records


def assess_package(record: dict[str, str]) -> tuple[str, list[str]]:
    findings: list[str] = []
    if not record.get("SHA256"):
        findings.append("missing SHA256 checksum")
    if not record.get("Filename", "").endswith(".deb"):
        findings.append("package filename is not a .deb")
    priority = record.get("Priority", "").lower()
    if priority in {"required", "important"}:
        findings.append(f"high-impact priority: {priority}")
    section = record.get("Section", "").lower()
    if any(word in section for word in ["admin", "kernel", "net", "utils"]):
        findings.append(f"sensitive section: {section}")
    description = record.get("Description", "")
    if re.search(r"\b(setuid|root|privilege|kernel module)\b", description, re.I):
        findings.append("description mentions privileged behavior")
    if not findings:
        return "passed", []
    if any("missing" in item or "not a .deb" in item for item in findings):
        return "failed", findings
    return "review", findings


async def fetch_packages_text(repo: AptRepo) -> str:
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS, follow_redirects=True) as client:
        last_error = ""
        for url in repo.packages_urls:
            try:
                response = await client.get(url)
                response.raise_for_status()
                data = response.content
                if url.endswith(".xz"):
                    return lzma.decompress(data).decode("utf-8", errors="replace")
                if url.endswith(".gz"):
                    return gzip.decompress(data).decode("utf-8", errors="replace")
                return data.decode("utf-8", errors="replace")
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)
        raise RuntimeError(last_error or "no Packages index could be fetched")


async def refresh_repo(repo: AptRepo) -> dict[str, Any]:
    started = time.time()
    try:
        text = await fetch_packages_text(repo)
        records = parse_packages_index(text)[:MAX_PACKAGES_PER_REPO]
        refreshed_at = now_iso()
        with closing(connect_db()) as conn:
            conn.execute("DELETE FROM packages WHERE repo_name = ?", (repo.name,))
            for record in records:
                status, findings = assess_package(record)
                conn.execute(
                    """
                    INSERT OR REPLACE INTO packages (
                      repo_name, package, version, architecture, section, priority,
                      filename, size, sha256, maintainer, description,
                      security_status, security_findings, refreshed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        repo.name,
                        record.get("Package", ""),
                        record.get("Version", ""),
                        record.get("Architecture", ""),
                        record.get("Section", ""),
                        record.get("Priority", ""),
                        record.get("Filename", ""),
                        int(record.get("Size", "0") or "0"),
                        record.get("SHA256", ""),
                        record.get("Maintainer", ""),
                        record.get("Description", ""),
                        status,
                        json.dumps(findings),
                        refreshed_at,
                    ),
                )
            conn.execute(
                """
                UPDATE repos
                SET last_refresh = ?, package_count = ?, status = 'ok', error = NULL
                WHERE name = ?
                """,
                (refreshed_at, len(records), repo.name),
            )
            conn.commit()
        return {"repo": repo.name, "status": "ok", "packages": len(records), "seconds": round(time.time() - started, 2)}
    except Exception as exc:  # noqa: BLE001
        with closing(connect_db()) as conn:
            conn.execute(
                "UPDATE repos SET status = 'error', error = ?, last_refresh = ? WHERE name = ?",
                (str(exc), now_iso(), repo.name),
            )
            conn.commit()
        return {"repo": repo.name, "status": "error", "error": str(exc)}


async def refresh_all() -> list[dict[str, Any]]:
    return [await refresh_repo(repo) for repo in parse_repos()]


def schedule_refresh() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(lambda: __import__("asyncio").run(refresh_all()), "interval", minutes=REFRESH_INTERVAL_MINUTES)
    scheduler.start()
    return scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    scheduler = schedule_refresh()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(title="pkgmng", version=APP_VERSION, lifespan=lifespan)


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {"ok": True, "version": APP_VERSION, "time": now_iso()}


@app.get("/readyz")
def readyz() -> dict[str, Any]:
    with closing(connect_db()) as conn:
        count = conn.execute("SELECT COUNT(*) FROM repos").fetchone()[0]
    return {"ok": count > 0, "repos": count}


@app.post("/api/refresh")
async def api_refresh() -> JSONResponse:
    return JSONResponse({"results": await refresh_all()})


@app.get("/api/repos")
def api_repos() -> list[dict[str, Any]]:
    with closing(connect_db()) as conn:
        return [dict(row) for row in conn.execute("SELECT * FROM repos ORDER BY name")]


@app.get("/api/packages")
def api_packages(
    q: str = "",
    status: str = Query("", pattern="^(|passed|review|failed)$"),
    limit: int = Query(200, ge=1, le=1000),
) -> dict[str, Any]:
    where: list[str] = []
    args: list[Any] = []
    if q:
        where.append("(package LIKE ? OR description LIKE ? OR maintainer LIKE ?)")
        args.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
    if status:
        where.append("security_status = ?")
        args.append(status)
    sql = "SELECT * FROM packages"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY security_status DESC, package LIMIT ?"
    args.append(limit)
    with closing(connect_db()) as conn:
        rows = [dict(row) for row in conn.execute(sql, args)]
        for row in rows:
            row["security_findings"] = json.loads(row["security_findings"])
        totals = dict(
            conn.execute(
                """
                SELECT
                  COUNT(*) total,
                  SUM(security_status='passed') passed,
                  SUM(security_status='review') review,
                  SUM(security_status='failed') failed
                FROM packages
                """
            ).fetchone()
        )
    return {"packages": rows, "totals": totals}


def dashboard_html() -> str:
    return """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>pkgmng</title>
  <style>
    :root { color-scheme: light; --ink:#15171a; --muted:#5b6370; --line:#d9dee7; --panel:#f7f9fb; --accent:#116b5f; --bad:#b42318; --warn:#9a6700; --ok:#087443; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #ffffff; color: var(--ink); }
    header { border-bottom: 1px solid var(--line); padding: 18px 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    h1 { margin: 0; font-size: 22px; letter-spacing: 0; }
    main { padding: 24px 28px 40px; max-width: 1440px; margin: 0 auto; }
    button, select, input { font: inherit; border: 1px solid var(--line); border-radius: 6px; background: #fff; color: var(--ink); height: 38px; }
    button { padding: 0 14px; background: var(--accent); border-color: var(--accent); color: #fff; cursor: pointer; }
    button:active { transform: translateY(1px); }
    input { min-width: 260px; padding: 0 10px; }
    select { padding: 0 8px; }
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin: 18px 0; align-items: center; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)); gap: 10px; margin-bottom: 18px; }
    .metric { border-top: 3px solid var(--line); padding: 12px 0 8px; }
    .metric strong { display:block; font-size: 26px; }
    .metric span { color: var(--muted); font-size: 13px; }
    .repos { display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; margin-bottom: 20px; }
    .repo { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; min-height: 116px; }
    .repo h2 { margin: 0 0 6px; font-size: 15px; }
    .repo p { margin: 3px 0; color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px 8px; text-align: left; vertical-align: top; font-size: 13px; }
    th { position: sticky; top: 0; background: #fff; z-index: 1; color: #303740; }
    td:nth-child(1) { width: 16%; font-weight: 650; }
    td:nth-child(2) { width: 20%; overflow-wrap: anywhere; }
    td:nth-child(3), td:nth-child(4) { width: 9%; }
    td:nth-child(5) { width: 12%; }
    .badge { display:inline-block; border-radius: 999px; padding: 3px 8px; color: #fff; font-size: 12px; }
    .passed { background: var(--ok); }
    .review { background: var(--warn); }
    .failed { background: var(--bad); }
    .muted { color: var(--muted); }
    .error { color: var(--bad); }
    @media (max-width: 760px) {
      header { align-items: flex-start; flex-direction: column; padding: 16px; }
      main { padding: 16px; }
      .metrics { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
      input { min-width: 100%; }
      table { min-width: 920px; }
      .table-wrap { overflow-x: auto; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>pkgmng</h1>
      <div class="muted">APT repository mirror index and Debian package security review</div>
    </div>
    <button id="refresh">Refresh</button>
  </header>
  <main>
    <section class="metrics" id="metrics"></section>
    <section class="repos" id="repos"></section>
    <div class="toolbar">
      <input id="q" placeholder="Search package, maintainer, description">
      <select id="status">
        <option value="">All statuses</option>
        <option value="failed">Failed</option>
        <option value="review">Review</option>
        <option value="passed">Passed</option>
      </select>
    </div>
    <section class="table-wrap">
      <table>
        <thead><tr><th>Package</th><th>Version</th><th>Repo</th><th>Status</th><th>Section</th><th>Findings</th><th>Description</th></tr></thead>
        <tbody id="packages"><tr><td colspan="7" class="muted">Loading packages...</td></tr></tbody>
      </table>
    </section>
  </main>
  <script>
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    async function load() {
      const params = new URLSearchParams({ q: $('q').value, status: $('status').value, limit: '300' });
      const [repos, packages] = await Promise.all([fetch('/api/repos').then(r => r.json()), fetch('/api/packages?' + params).then(r => r.json())]);
      const totals = packages.totals || {};
      $('metrics').innerHTML = [['Total', totals.total], ['Passed', totals.passed], ['Review', totals.review], ['Failed', totals.failed]].map(([k,v]) => `<div class="metric"><strong>${Number(v || 0)}</strong><span>${k}</span></div>`).join('');
      $('repos').innerHTML = repos.map(r => `<article class="repo"><h2>${esc(r.name)} <span class="badge ${r.status === 'ok' ? 'passed' : 'failed'}">${esc(r.status)}</span></h2><p>${esc(r.base_url)} ${esc(r.suite)}/${esc(r.component)}</p><p>${Number(r.package_count || 0)} packages, refreshed ${esc(r.last_refresh || 'never')}</p>${r.error ? `<p class="error">${esc(r.error)}</p>` : ''}</article>`).join('');
      $('packages').innerHTML = packages.packages.length ? packages.packages.map(p => `<tr><td>${esc(p.package)}</td><td>${esc(p.version)}</td><td>${esc(p.repo_name)}</td><td><span class="badge ${esc(p.security_status)}">${esc(p.security_status)}</span></td><td>${esc(p.section || '')}</td><td>${esc((p.security_findings || []).join('; ') || 'none')}</td><td class="muted">${esc((p.description || '').split('\\n')[0])}</td></tr>`).join('') : '<tr><td colspan="7" class="muted">No packages match this filter. Refresh repositories to populate the index.</td></tr>';
    }
    $('refresh').addEventListener('click', async () => { $('refresh').disabled = true; $('refresh').textContent = 'Refreshing'; await fetch('/api/refresh', { method: 'POST' }); $('refresh').disabled = false; $('refresh').textContent = 'Refresh'; load(); });
    $('q').addEventListener('input', () => clearTimeout(window.__t) || (window.__t = setTimeout(load, 250)));
    $('status').addEventListener('change', load);
    load();
  </script>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return dashboard_html()


@app.get("/robots.txt", response_class=PlainTextResponse)
def robots() -> str:
    return "User-agent: *\nDisallow:\n"


@app.exception_handler(Exception)
async def error_handler(_, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": str(exc)})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=os.getenv("APP_HOST", "0.0.0.0"), port=int(os.getenv("APP_PORT", "8080")))
