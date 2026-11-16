#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
cd "$repo/mcp"
uv build --all-packages --wheel --out-dir "$out"
uv tool install --force --reinstall --find-links "$out" "$out"/token_io_decoupling-*.whl
printf '%s\n' 'Installed token-io-decoupling-tools. Configure Pi MCP to launch it with no arguments.' 'Install Skill explicitly: token-io-decoupling-tools skills install'
