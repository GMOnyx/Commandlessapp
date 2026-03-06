#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Running tests"
python3 -m unittest discover -s tests -p "test_*.py"

echo "==> Cleaning build artifacts"
rm -rf dist build *.egg-info src/*.egg-info src/commandless_relay/*.egg-info

echo "==> Building package"
python3 -m build

echo "==> Uploading to PyPI"
python3 -m twine upload dist/*
