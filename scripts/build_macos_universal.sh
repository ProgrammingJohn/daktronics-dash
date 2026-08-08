#!/bin/bash

set -euo pipefail

REPOSITORY_PATH=$(cd "$(dirname "$0")/.." && pwd -P)
DESKTOP_PATH="$REPOSITORY_PATH/desktop"
RELEASE_PATH="$REPOSITORY_PATH/release"
UNIVERSAL_APP="$RELEASE_PATH/DakDash.app"
UNIVERSAL_ZIP="$RELEASE_PATH/DakDash-macos-universal.zip"
NODE_BIN_PATH=${DAKDASH_NODE_BIN_PATH:-/opt/homebrew/opt/node@22/bin}

if [[ ! -x "$NODE_BIN_PATH/node" || ! -x "$NODE_BIN_PATH/npm" ]]; then
  echo "Node 22 toolchain is unavailable: $NODE_BIN_PATH" >&2
  echo "Set DAKDASH_NODE_BIN_PATH to the directory containing node and npm." >&2
  exit 1
fi
NODE_MAJOR_VERSION=$(
  "$NODE_BIN_PATH/node" -p 'Number(process.versions.node.split(".")[0])'
)
if [[ "$NODE_MAJOR_VERSION" != "22" ]]; then
  echo "The release build requires Node 22; found Node $NODE_MAJOR_VERSION." >&2
  exit 1
fi
export PATH="$NODE_BIN_PATH:$PATH"

mkdir -p "$RELEASE_PATH"

cd "$DESKTOP_PATH"
npm ci
npm run build

"$REPOSITORY_PATH/scripts/build_backend_macos.sh" arm64
"$REPOSITORY_PATH/scripts/build_backend_macos.sh" x64

npx electron-forge package --platform=darwin --arch=arm64
npx electron-forge package --platform=darwin --arch=x64

ARM64_APP="$DESKTOP_PATH/out/DakDash-darwin-arm64/DakDash.app"
X64_APP="$DESKTOP_PATH/out/DakDash-darwin-x64/DakDash.app"

if [[ -e "$UNIVERSAL_APP" ]]; then
  rm -rf "$UNIVERSAL_APP"
fi
rm -f "$UNIVERSAL_ZIP"

node "$DESKTOP_PATH/scripts/makeUniversal.mjs" \
  "$X64_APP" \
  "$ARM64_APP" \
  "$UNIVERSAL_APP"

codesign --force --deep --sign - "$UNIVERSAL_APP"

ELECTRON_EXECUTABLE="$UNIVERSAL_APP/Contents/MacOS/DakDash"
ARCHITECTURES=$(lipo -archs "$ELECTRON_EXECUTABLE")
if [[ "$ARCHITECTURES" != *arm64* || "$ARCHITECTURES" != *x86_64* ]]; then
  echo "Universal Electron executable is missing an architecture: $ARCHITECTURES" >&2
  exit 1
fi

file "$UNIVERSAL_APP/Contents/Resources/backend/arm64/dakdash-backend/dakdash-backend"
file "$UNIVERSAL_APP/Contents/Resources/backend/x64/dakdash-backend/dakdash-backend"

ditto -c -k --sequesterRsrc --keepParent "$UNIVERSAL_APP" "$UNIVERSAL_ZIP"

echo "$UNIVERSAL_ZIP"
