#!/usr/bin/env python3
"""Report unexpected Next servers without reading secrets or stopping processes."""
import json
import os
from pathlib import Path
import subprocess
import sys


def inspect():
    apps = json.loads(subprocess.check_output(["pm2", "jlist"], text=True))
    managed = {app["pid"]: app["name"] for app in apps if app["pid"]}
    rows = []
    for proc in Path("/proc").iterdir():
        if not proc.name.isdigit():
            continue
        try:
            if not (proc / "comm").read_text().startswith("next-server"):
                continue
            pid = int(proc.name)
            cwd = os.readlink(proc / "cwd")
            if not cwd.startswith(("/opt/vulpine-", "/opt/security-releases/")):
                continue
            fields = (proc / "stat").read_text().rsplit(")", 1)[1].split()
            cgroup = (proc / "cgroup").read_text().strip()
            owner = managed.get(pid)
            # A named systemd service is a supervisor, unlike an SSH session.
            if not owner and cgroup.endswith(".service"):
                owner = cgroup.rsplit("/", 1)[-1]
            rows.append({"pid": pid, "parent_pid": int(fields[1]), "cwd": cwd,
                         "supervisor": owner, "status": "managed" if owner else "unmanaged"})
        except (OSError, ValueError, IndexError):
            continue
    return rows


if __name__ == "__main__":
    rows = inspect()
    print(json.dumps(rows, indent=2))
    sys.exit(1 if any(row["status"] == "unmanaged" for row in rows) else 0)
