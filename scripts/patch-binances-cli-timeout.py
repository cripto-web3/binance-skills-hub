#!/usr/bin/env python3
"""Raise the default Binance REST request timeout so binance-cli works behind slow links.

Problem : @binance/common ConfigurationRestAPI defaults to timeout: 1000 ms, but
          api.binance.com latency in this sandbox is ~1.5-5 s, so every request aborts
          and the 3-retry loop ends with "Request failed after 3 retries".

Usage   : python3 scripts/patch-binances-cli-timeout.py [node-version]
          node-version defaults to the active one (e.g. v26.7.0, v22.13.0).

Note    : re-run after every `npm install -g @binance/binance-cli` and after switching
          Node.js versions (each version keeps its own global node_modules).
"""
import os
import re
import subprocess
import sys


def active_node_version() -> str:
    out = subprocess.run(["node", "--version"], capture_output=True, text=True).stdout.strip()
    if not out.startswith("v"):
        raise SystemExit("could not detect node version; pass it explicitly")
    return out  # e.g. "v26.7.0"


def main() -> int:
    version = sys.argv[1] if len(sys.argv) > 1 else active_node_version()
    base = os.path.expanduser(
        f"~/.nvm/versions/node/{version}/lib/node_modules/@binance/binance-cli"
    )
    targets = [
        os.path.join(base, "node_modules/@binance/common/dist/index.mjs"),
        os.path.join(base, "node_modules/@binance/common/dist/index.js"),
    ]
    patched_any = False
    for path in targets:
        if not os.path.exists(path):
            continue
        src = open(path, encoding="utf-8").read()
        pattern = re.compile(r"(this\.baseOptions\s*=\s*\{[^}]*?timeout:\s*param\.timeout\s*\?\?\s*)1e3(,)")
        if not pattern.search(src):
            if "15000" in src and "baseOptions" in src:
                print(f"[ok] {path} — already patched")
                patched_any = True
            else:
                print(f"[skip] {path} — marker not found (already patched or different version)")
            continue
        src, n = pattern.subn(r"\g<1>15000\g<2>", src, count=1)
        open(path, "w", encoding="utf-8").write(src)
        print(f"[patch] {path} — timeout 1000 ms -> 15000 ms ({n} replacement)")
        patched_any = True
    if not patched_any:
        print("no file was patched; is @binance/binance-cli installed for", version, "?")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
