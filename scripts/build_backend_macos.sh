#!/bin/bash

set -euo pipefail

REPOSITORY_PATH=$(cd "$(dirname "$0")/.." && pwd -P)
ARCHITECTURE=${1:-}

case "$ARCHITECTURE" in
  arm64)
    PYTHON_EXECUTABLE=${DAKDASH_PYTHON_ARM64:-/opt/homebrew/bin/python3}
    EXPECTED_MACHINE=arm64
    ;;
  x64)
    PYTHON_EXECUTABLE=${DAKDASH_PYTHON_X64:-/Library/Frameworks/Python.framework/Versions/3.9/bin/python3}
    EXPECTED_MACHINE=x86_64
    ;;
  *)
    echo "Usage: $0 <arm64|x64>" >&2
    exit 2
    ;;
esac

if [[ ! -x "$PYTHON_EXECUTABLE" ]]; then
  echo "Python for $ARCHITECTURE is unavailable: $PYTHON_EXECUTABLE" >&2
  exit 1
fi

ACTUAL_MACHINE=$(
  "$PYTHON_EXECUTABLE" -c 'import platform; print(platform.machine())'
)
if [[ "$ACTUAL_MACHINE" != "$EXPECTED_MACHINE" ]]; then
  echo "Python architecture mismatch: expected $EXPECTED_MACHINE, found $ACTUAL_MACHINE" >&2
  exit 1
fi

BUILD_PATH="$REPOSITORY_PATH/.build/macos/backend-$ARCHITECTURE"
VIRTUAL_ENVIRONMENT="$BUILD_PATH/venv"
OUTPUT_PATH="$REPOSITORY_PATH/desktop/backend/$ARCHITECTURE"

mkdir -p "$BUILD_PATH" "$OUTPUT_PATH"
if [[ ! -x "$VIRTUAL_ENVIRONMENT/bin/python" ]]; then
  "$PYTHON_EXECUTABLE" -m venv "$VIRTUAL_ENVIRONMENT"
fi

"$VIRTUAL_ENVIRONMENT/bin/python" -m pip install --disable-pip-version-check \
  --requirement "$REPOSITORY_PATH/requirements.txt" \
  --requirement "$REPOSITORY_PATH/desktop/requirements-build.txt"

"$VIRTUAL_ENVIRONMENT/bin/python" -m PyInstaller \
  --clean \
  --noconfirm \
  --onedir \
  --name dakdash-backend \
  --distpath "$OUTPUT_PATH" \
  --workpath "$BUILD_PATH/work" \
  --specpath "$BUILD_PATH/spec" \
  --add-data "$REPOSITORY_PATH/desktop/dist:desktop/dist" \
  --add-data "$REPOSITORY_PATH/scoreboard_svgs:scoreboard_svgs" \
  "$REPOSITORY_PATH/desktop_backend.py"

BACKEND_EXECUTABLE="$OUTPUT_PATH/dakdash-backend/dakdash-backend"
if [[ ! -x "$BACKEND_EXECUTABLE" ]]; then
  echo "Backend build did not produce $BACKEND_EXECUTABLE" >&2
  exit 1
fi
if ! file "$BACKEND_EXECUTABLE" | grep -q "$EXPECTED_MACHINE"; then
  file "$BACKEND_EXECUTABLE" >&2
  echo "Backend executable has the wrong architecture" >&2
  exit 1
fi

echo "$BACKEND_EXECUTABLE"
