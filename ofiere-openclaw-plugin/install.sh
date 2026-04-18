#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Ofiere PM Plugin — Bulletproof Installer for OpenClaw
#
# Downloads the plugin from npm, installs all dependencies automatically,
# configures environment variables, and optionally restarts the gateway.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/gilanggemar/Ofiere/main/ofiere-openclaw-plugin/install.sh | bash -s -- \
#     --supabase-url "https://xxx.supabase.co" \
#     --service-key "eyJ..." \
#     --user-id "your-uuid"
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PLUGIN_PKG="ofiere-openclaw-plugin"
NO_RESTART=false

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
PLUGIN_DIR="$EXTENSIONS_DIR/ofiere"
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
    --no-restart)    NO_RESTART=true;    shift ;;
    *)               echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Validate ─────────────────────────────────────────────────────────────────

if [[ -z "$SUPABASE_URL" || -z "$SERVICE_KEY" || -z "$USER_ID" ]]; then
  echo ""
  echo "Ofiere PM Plugin — Installer"
  echo ""
  echo "Usage:"
  echo "  curl -sSL https://raw.githubusercontent.com/gilanggemar/Ofiere/main/ofiere-openclaw-plugin/install.sh | bash -s -- \\"
  echo "    --supabase-url \"https://xxx.supabase.co\" \\"
  echo "    --service-key \"eyJ...\" \\"
  echo "    --user-id \"your-uuid\""
  echo ""
  echo "Only 3 parameters needed. All agents get the plugin automatically."
  echo ""
  exit 1
fi

# ── Pre-flight checks ───────────────────────────────────────────────────────

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   Ofiere PM Plugin — Installing...            ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js not found."
  echo "    Install Node.js 18+ first: https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 18 ]]; then
  echo "  ✗ Node.js version $(node -v) is too old. Need v18+."
  exit 1
fi
echo "  ✓ Node.js $(node -v)"

# Check npm
if ! command -v npm &>/dev/null; then
  echo "  ✗ npm not found."
  exit 1
fi
echo "  ✓ npm $(npm -v)"

echo ""
echo "  OpenClaw Home:  $OPENCLAW_HOME"
echo "  Plugin Target:  $PLUGIN_DIR"
echo ""

# ── Step 1: Download plugin from npm ─────────────────────────────────────────

mkdir -p "$PLUGIN_DIR"

echo "→ Downloading plugin from npm..."

# Save the current directory
ORIG_DIR="$(pwd)"

# Download the npm package tarball
TMP_DIR=$(mktemp -d)
cd "$TMP_DIR"

npm pack "$PLUGIN_PKG" --quiet 2>/dev/null || npm pack "$PLUGIN_PKG" 2>/dev/null

TARBALL=$(ls ${PLUGIN_PKG}-*.tgz 2>/dev/null | head -1)
if [[ -z "$TARBALL" ]]; then
  echo "  ✗ Failed to download $PLUGIN_PKG from npm."
  echo "    Check your internet connection and try again."
  cd "$ORIG_DIR"
  rm -rf "$TMP_DIR"
  exit 1
fi

# Extract directly into the plugin directory (--strip-components=1 removes the 'package/' prefix)
tar xzf "$TARBALL" -C "$PLUGIN_DIR" --strip-components=1
cd "$ORIG_DIR"
rm -rf "$TMP_DIR"

echo "  ✓ Plugin downloaded (npm: $PLUGIN_PKG)"

# ── Step 2: Install dependencies ─────────────────────────────────────────────

echo "→ Installing dependencies..."

cd "$PLUGIN_DIR"

# npm install resolves @supabase/supabase-js, zod, and any transitive deps
npm install --omit=dev --no-audit --no-fund --loglevel=error 2>&1 | while read -r line; do
  echo "    $line"
done

if [[ -d "$PLUGIN_DIR/node_modules/@supabase" ]]; then
  echo "  ✓ Dependencies installed"
else
  echo "  ✗ Dependency installation may have failed."
  echo "    Try running manually: cd $PLUGIN_DIR && npm install"
  exit 1
fi

cd "$ORIG_DIR"

# ── Step 3: Append env vars (idempotent) ─────────────────────────────────────

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

append_env "OFIERE_SUPABASE_URL" "$SUPABASE_URL"
append_env "OFIERE_SERVICE_ROLE_KEY" "$SERVICE_KEY"
append_env "OFIERE_USER_ID" "$USER_ID"

# ── Step 4: Register plugin in openclaw.json ─────────────────────────────────

echo "→ Registering plugin in OpenClaw config..."

CONFIG_FILE="$OPENCLAW_HOME/openclaw.json"

if [[ -f "$CONFIG_FILE" ]]; then
  # Use Node.js for safe JSON manipulation (we already verified node exists)
  REGISTER_RESULT=$(node -e "
    const fs = require('fs');
    const p = '$CONFIG_FILE';
    const c = JSON.parse(fs.readFileSync(p, 'utf8'));

    let changed = false;

    // Ensure plugins.allow exists and includes 'ofiere'
    if (!c.plugins) c.plugins = {};
    if (!c.plugins.allow) c.plugins.allow = [];
    if (!c.plugins.allow.includes('ofiere')) {
      c.plugins.allow.push('ofiere');
      changed = true;
    }

    // Ensure tools.allow exists and includes 'ofiere'
    if (!c.tools) c.tools = {};
    if (!c.tools.allow) c.tools.allow = [];
    if (!c.tools.allow.includes('ofiere')) {
      c.tools.allow.push('ofiere');
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(p, JSON.stringify(c, null, 2) + String.fromCharCode(10));
      console.log('REGISTERED');
    } else {
      console.log('ALREADY_REGISTERED');
    }
  " 2>&1) || true

  if [[ "$REGISTER_RESULT" == "REGISTERED" ]]; then
    echo "  ✓ Added 'ofiere' to plugins.allow and tools.allow"
  elif [[ "$REGISTER_RESULT" == "ALREADY_REGISTERED" ]]; then
    echo "  ✓ Plugin already registered in config"
  else
    echo "  ⚠ Could not update openclaw.json: $REGISTER_RESULT"
    echo "    You may need to manually add 'ofiere' to plugins.allow and tools.allow"
  fi
else
  echo "  ⚠ openclaw.json not found at $CONFIG_FILE"
  echo "    OpenClaw will auto-discover the plugin from the extensions directory."
fi

# ── Step 5: Verify plugin loads ──────────────────────────────────────────────

echo "→ Verifying plugin..."

# Quick check: can Node resolve the entry point and its imports?
VERIFY_RESULT=$(node -e "
  try {
    require('$PLUGIN_DIR/node_modules/@supabase/supabase-js');
    require('$PLUGIN_DIR/node_modules/zod');
    console.log('OK');
  } catch(e) {
    console.log('FAIL:' + e.message);
  }
" 2>&1) || true

if [[ "$VERIFY_RESULT" == "OK" ]]; then
  echo "  ✓ Plugin dependencies verified"
else
  echo "  ⚠ Verification warning: $VERIFY_RESULT"
  echo "    The plugin may still work — OpenClaw uses its own module loader."
fi

# ── Step 6: Auto-restart gateway ─────────────────────────────────────────────

if [[ "$NO_RESTART" == "true" ]]; then
  echo ""
  echo "  ℹ Skipping restart (--no-restart flag)"
  echo "  → Restart manually: openclaw gateway restart"
else
  echo "→ Restarting OpenClaw gateway..."

  RESTARTED=false

  # Try Docker first (most common for VPS deployments)
  if command -v docker &>/dev/null; then
    # Find the OpenClaw container
    CONTAINER_ID=$(docker ps --filter "name=openclaw" --format "{{.ID}}" 2>/dev/null | head -1)
    if [[ -z "$CONTAINER_ID" ]]; then
      # Try broader search
      CONTAINER_ID=$(docker ps --format "{{.ID}} {{.Image}}" 2>/dev/null | grep -i "openclaw" | awk '{print $1}' | head -1)
    fi

    if [[ -n "$CONTAINER_ID" ]]; then
      docker restart "$CONTAINER_ID" >/dev/null 2>&1 && RESTARTED=true
      if [[ "$RESTARTED" == "true" ]]; then
        echo "  ✓ Docker container restarted ($CONTAINER_ID)"
      fi
    fi
  fi

  # Try native OpenClaw CLI
  if [[ "$RESTARTED" == "false" ]] && command -v openclaw &>/dev/null; then
    openclaw gateway restart 2>/dev/null && RESTARTED=true
    if [[ "$RESTARTED" == "true" ]]; then
      echo "  ✓ Gateway restarted via CLI"
    fi
  fi

  # Try systemctl
  if [[ "$RESTARTED" == "false" ]] && command -v systemctl &>/dev/null; then
    if systemctl is-active --quiet openclaw 2>/dev/null; then
      sudo systemctl restart openclaw 2>/dev/null && RESTARTED=true
      if [[ "$RESTARTED" == "true" ]]; then
        echo "  ✓ Gateway restarted via systemctl"
      fi
    fi
  fi

  if [[ "$RESTARTED" == "false" ]]; then
    echo "  ⚠ Could not auto-restart. Please restart manually:"
    echo "    • Docker: docker restart <container>"
    echo "    • Native: openclaw gateway restart"
    echo "    • Systemd: sudo systemctl restart openclaw"
  fi
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ✓ Ofiere PM Plugin v3.0 Installed!               ║"
echo "║                                                      ║"
echo "║   Source:  npm ($PLUGIN_PKG@latest)"
echo "║   Plugin:  $PLUGIN_DIR"
echo "║   Env:     $ENV_FILE"
echo "║                                                      ║"
echo "║   9 Meta-tools available to ALL agents:              ║"
echo "║     • OFIERE_TASK_OPS      (tasks CRUD + plans)      ║"
echo "║     • OFIERE_AGENT_OPS     (list agents)             ║"
echo "║     • OFIERE_PROJECT_OPS   (spaces/folders/deps)     ║"
echo "║     • OFIERE_SCHEDULE_OPS  (calendar events)         ║"
echo "║     • OFIERE_KNOWLEDGE_OPS (knowledge base)          ║"
echo "║     • OFIERE_WORKFLOW_OPS  (workflows + trigger)     ║"
echo "║     • OFIERE_NOTIFY_OPS    (notifications)           ║"
echo "║     • OFIERE_MEMORY_OPS    (conversations/memory)    ║"
echo "║     • OFIERE_PROMPT_OPS    (prompt chunks)           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

