# pkgmng

`pkgmng` is a local APT repository manager. It indexes configured APT repositories, refreshes package metadata on a schedule, runs lightweight security checks on Debian package records, and exposes a web UI plus JSON APIs.

## Runtime

- App: FastAPI
- Port: `8080`
- Data: SQLite at `DB_PATH`, default `/data/pkgmng.db` in the container
- Default repositories:
  - Debian bookworm main
  - Debian bookworm-security main

## Configuration

`APT_REPOS` is a comma-separated list of:

```text
name|base_url|suite|component
```

Example:

```text
debian-bookworm|https://deb.debian.org/debian|bookworm|main,debian-security|https://security.debian.org/debian-security|bookworm-security|main
```

## Development

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
pytest
python -m app.main
```
