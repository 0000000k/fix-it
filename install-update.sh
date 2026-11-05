#!/bin/bash
# Fix it v0.7: install/update an existing Figma development plugin without Node.js.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/manifest.json"

if [ ! -f "$TEMPLATE" ] || [ ! -f "$SCRIPT_DIR/ui.html" ] || [ ! -f "$SCRIPT_DIR/code.js" ]; then
  echo "Error: Keep the installer in the extracted Fix it folder." >&2
  exit 1
fi

if [ -n "${FIX_IT_TARGET_DIR:-}" ]; then
  TARGET="$FIX_IT_TARGET_DIR"
elif command -v osascript >/dev/null 2>&1; then
  echo "Select the existing registered Fix it plugin folder."
  TARGET="$(osascript -e 'POSIX path of (choose folder with prompt "Select the folder of your existing Fix it Figma plugin")' 2>/dev/null || true)"
else
  printf 'Drag your existing Fix it plugin folder here, then press Enter: '
  IFS= read -r TARGET
  # Finder drag-and-drop in Terminal escapes spaces.
  TARGET="${TARGET//\\ / }"
fi

if [ -z "${TARGET:-}" ]; then
  echo "No folder selected. Nothing changed." >&2
  exit 1
fi
TARGET="${TARGET%/}"
OLD_MANIFEST="$TARGET/manifest.json"
if [ ! -f "$OLD_MANIFEST" ]; then
  echo "Error: manifest.json not found in selected folder: $TARGET" >&2
  echo "Select the registered Fix it plugin folder. If missing, first create a Figma development plugin." >&2
  exit 1
fi

PLUGIN_ID="$(sed -nE 's/.*"id"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$OLD_MANIFEST" | head -n 1)"
if [ -z "$PLUGIN_ID" ]; then
  echo "Error: No Figma-issued plugin ID was found in the selected manifest." >&2
  echo "The chosen folder must have a Figma-issued plugin ID." >&2
  exit 1
fi
if [[ ! "$PLUGIN_ID" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "Error: Unexpected plugin ID format. Nothing changed." >&2
  exit 1
fi

BACKUP="$TARGET/.fix-it-backup-before-v0.7"
if [ -e "$BACKUP" ]; then
  BACKUP="$TARGET/.fix-it-backup-$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "$BACKUP"
for file in manifest.json code.js ui.html companion.js setup-claude.mjs confluence-bridge.js SKILL.md ; do
  [ -f "$TARGET/$file" ] && cp -p "$TARGET/$file" "$BACKUP/$file"
done

# Build a valid manifest by adding the actual Figma-issued ID to Fix it's manifest.
NEW_MANIFEST="$TARGET/manifest.json.fixit.tmp"
{
  printf '{\n  "id": "%s",\n' "$PLUGIN_ID"
  tail -n +2 "$TEMPLATE"
} > "$NEW_MANIFEST"

for file in code.js ui.html companion.js setup-claude.mjs confluence-bridge.js SKILL.md ; do
  cp -f "$SCRIPT_DIR/$file" "$TARGET/$file"
done
mv -f "$NEW_MANIFEST" "$TARGET/manifest.json"

printf '\nFix it v0.7 installed successfully.\n'
printf 'Figma plugin ID retained: %s\n' "$PLUGIN_ID"
printf 'Installed in: %s\n' "$TARGET"
printf 'Backup: %s\n' "$BACKUP"
printf '\nIn Figma Desktop, reopen Plugins > Development > Fix it.\n'
printf 'No Node.js was required for this installation.\n'
