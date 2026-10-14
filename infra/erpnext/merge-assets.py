"""Retain upstream bundles when adding the separately built HR app."""
import json
from pathlib import Path

for name in ("assets.json", "assets-rtl.json"):
    manifest = Path("assets") / name
    upstream = json.loads((Path("/tmp") / f"upstream-{name}").read_text())
    upstream.update(json.loads(manifest.read_text()))
    manifest.write_text(json.dumps(upstream, indent=2))
