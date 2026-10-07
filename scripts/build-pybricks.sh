#!/usr/bin/env bash
# Experimental: build a forked pybricks-code into public/pybricks for same-origin embed.
# Requires Node 18.x. Does not commit the ~137MB build — run locally / in CI if adopted.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_DIR="${ROOT}/vendor/pybricks-code"
PATCH="${ROOT}/vendor/pybricks-postmessage-bridge.patch"
OUT="${ROOT}/public/pybricks"
REPO_URL="${PYBRICKS_CODE_REPO:-https://github.com/pybricks/pybricks-code.git}"
REF="${PYBRICKS_CODE_REF:-master}"

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
if [[ "${NODE_MAJOR}" != "18" ]]; then
  echo "error: Node 18 required (found $(node -v 2>/dev/null || echo none))." >&2
  echo "  nvm install 18 && nvm use 18" >&2
  exit 1
fi

if [[ ! -d "${VENDOR_DIR}/.git" ]]; then
  mkdir -p "$(dirname "${VENDOR_DIR}")"
  git clone --depth 1 --branch "${REF}" "${REPO_URL}" "${VENDOR_DIR}"
fi

cd "${VENDOR_DIR}"

if [[ -f "${PATCH}" ]]; then
  # Idempotent: reset tracked sources then apply bridge patch.
  git checkout -- src/explorer/sagas.ts src/index.tsx 2>/dev/null || true
  git clean -fd -- src/rollingSparksBridge.ts 2>/dev/null || true
  git apply --whitespace=nowarn "${PATCH}"
fi

node .yarn/releases/yarn-3.3.0.cjs install
PUBLIC_URL=/pybricks node .yarn/releases/yarn-3.3.0.cjs build

rm -rf "${OUT}"
mkdir -p "$(dirname "${OUT}")"
cp -a "${VENDOR_DIR}/build" "${OUT}"
echo "Copied build → ${OUT}"
echo "Serve Rolling Sparks and open /programs/pybricks-spike (experimental)."
