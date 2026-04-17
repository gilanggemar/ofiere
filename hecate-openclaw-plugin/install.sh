#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Hecate PM Plugin — Foolproof Installer for OpenClaw
#
# This script NEVER modifies openclaw.json. It only:
#   1. Downloads plugin files to the extensions directory
#   2. Appends env vars to the .env file (idempotent)
#
# OpenClaw auto-discovers plugins in the extensions directory.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/gilanggemar/Hecate/main/hecate-openclaw-plugin/install.sh | bash -s -- \
#     --supabase-url "https://xxx.supabase.co" \
#     --service-key "eyJ..." \
#     --user-id "your-uuid"
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_URL="https://github.com/gilanggemar/Hecate.git"
PLUGIN_SUBDIR="hecate-openclaw-plugin"

# ── Auto-detect OpenClaw home ────────────────────────────────────────────────

detect_openclaw_home() {
  # Docker containers typically mount to /data/.openclaw
  if [[ -d "/data/.openclaw" ]]; then
    echo "/data/.openclaw"
    return
  fi

  # Standard OpenClaw home
  if [[ -d "$HOME/.openclaw" ]]; then
    echo "$HOME/.openclaw"
    return
  fi

  # Create default if nothing exists
  echo "$HOME/.openclaw"
}

OPENCLAW_HOME="$(detect_openclaw_home)"
EXTENSIONS_DIR="$OPENCLAW_HOME/extensions"
PLUGIN_DIR="$EXTENSIONS_DIR/hecate"
ENV_FILE="$OPENCLAW_HOME/.env"

# ── Parse arguments ──────────────────────────────────────────────────────────

SUPABASE_URL=""
SERVICE_KEY=""
USER_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --supabase-url)  SUPABASE_URL="$2";  shift 2 ;;
    --service-key)   SERVICE_KEY="$2";   shift 2 ;;
    --user-id)       USER_ID="$2";       shift 2 ;;
    *)               echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Validate ─────────────────────────────────────────────────────────────────

if [[ -z "$SUPABASE_URL" || -z "$SERVICE_KEY" || -z "$USER_ID" ]]; then
  echo ""
  echo "Hecate PM Plugin — Foolproof Installer"
  echo ""
  echo "Usage:"
  echo "  curl -sSL https://raw.githubusercontent.com/gilanggemar/Hecate/main/hecate-openclaw-plugin/install.sh | bash -s -- \\"
  echo "    --supabase-url \"https://xxx.supabase.co\" \\"
  echo "    --service-key \"eyJ...\" \\"
  echo "    --user-id \"your-uuid\""
  echo ""
  echo "Only 3 parameters needed. No agent ID required — all agents get the plugin automatically."
  echo ""
  exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   Hecate PM Plugin — Installing...            ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "  OpenClaw Home:  $OPENCLAW_HOME"
echo "  Plugin Target:  $PLUGIN_DIR"
echo ""

# ── Step 1: Download plugin files ────────────────────────────────────────────
# Strategy: git clone if available, otherwise curl tarball

mkdir -p "$EXTENSIONS_DIR"

if [[ -d "$PLUGIN_DIR/.git" ]] || [[ -d "$PLUGIN_DIR/src" ]]; then
  echo "→ Plugin already exists, updating..."
  # If we originally cloned it, try to pull
  if [[ -d "$PLUGIN_DIR/.git" ]]; then
    cd "$PLUGIN_DIR"
    git pull --quiet 2>/dev/null || true
    cd - > /dev/null
  else
    # Re-download via tarball
    TMP_DIR=$(mktemp -d)
    if command -v git &>/dev/null; then
      git clone --depth 1 --single-branch --branch main "$REPO_URL" "$TMP_DIR/hecate-repo" 2>/dev/null
      rm -rf "$PLUGIN_DIR"
      cp -r "$TMP_DIR/hecate-repo/$PLUGIN_SUBDIR" "$PLUGIN_DIR"
    elif command -v curl &>/dev/null; then
      curl -sSL "https://github.com/gilanggemar/Hecate/archive/refs/heads/main.tar.gz" | tar xz -C "$TMP_DIR"
      rm -rf "$PLUGIN_DIR"
      cp -r "$TMP_DIR/Hecate-main/$PLUGIN_SUBDIR" "$PLUGIN_DIR"
    else
      echo "  ✗ Neither git nor curl found. Cannot download plugin."
      exit 1
    fi
    rm -rf "$TMP_DIR"
  fi
  echo "  ✓ Plugin updated"
else
  echo "→ Downloading plugin..."
  TMP_DIR=$(mktemp -d)
  if command -v git &>/dev/null; then
    git clone --depth 1 --single-branch --branch main "$REPO_URL" "$TMP_DIR/hecate-repo" 2>/dev/null
    cp -r "$TMP_DIR/hecate-repo/$PLUGIN_SUBDIR" "$PLUGIN_DIR"
  elif command -v curl &>/dev/null; then
    curl -sSL "https://github.com/gilanggemar/Hecate/archive/refs/heads/main.tar.gz" | tar xz -C "$TMP_DIR"
    cp -r "$TMP_DIR/Hecate-main/$PLUGIN_SUBDIR" "$PLUGIN_DIR"
  else
    echo "  ✗ Neither git nor curl found. Cannot download plugin."
    exit 1
  fi
  rm -rf "$TMP_DIR"
  echo "  ✓ Plugin downloaded"
fi

# ── Step 2: Append env vars (idempotent) ─────────────────────────────────────

echo "→ Configuring environment variables..."

# Create .env if it doesn't exist
touch "$ENV_FILE"

# Helper: append a var only if it's not already set in the file
append_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # Update existing value
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" 2>/dev/null || \
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" 2>/dev/null || true
    echo "  ✓ Updated $key"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
    echo "  ✓ Added $key"
  fi
}

append_env "HECATE_SUPABASE_URL" "$SUPABASE_URL"
append_env "HECATE_SERVICE_ROLE_KEY" "$SERVICE_KEY"
append_env "HECATE_USER_ID" "$USER_ID"

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   ✓ Hecate PM Plugin Installed!               ║"
echo "║                                               ║"
echo "║   Plugin:  $PLUGIN_DIR"
echo "║   Env:     $ENV_FILE"
echo "║                                               ║"
echo "║   Tools: HECATE_LIST_TASKS                    ║"
echo "║          HECATE_CREATE_TASK                    ║"
echo "║          HECATE_UPDATE_TASK                    ║"
echo "║          HECATE_DELETE_TASK                    ║"
echo "║          HECATE_LIST_AGENTS                    ║"
echo "║                                               ║"
echo "║   All agents get these tools automatically.   ║"
echo "║                                               ║"
echo "║   Restart your gateway to activate:           ║"
echo "║   • Docker: docker restart <container>        ║"
echo "║   • Native: openclaw gateway restart          ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
