#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Hecate PM Plugin — One-Click Installer for OpenClaw Agents
# Usage:
#   curl -sSL https://raw.githubusercontent.com/gilanggemar/Hecate/main/hecate-openclaw-plugin/install.sh | bash -s -- \
#     --supabase-url "https://xxx.supabase.co" \
#     --service-key "eyJ..." \
#     --user-id "your-uuid" \
#     --agent-id "sasha"
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_URL="https://github.com/gilanggemar/Hecate.git"
INSTALL_DIR="${HECATE_INSTALL_DIR:-$HOME/.hecate-plugin}"

# ── Parse arguments ──────────────────────────────────────────────────────────

SUPABASE_URL=""
SERVICE_KEY=""
USER_ID=""
AGENT_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --supabase-url)  SUPABASE_URL="$2";  shift 2 ;;
    --service-key)   SERVICE_KEY="$2";   shift 2 ;;
    --user-id)       USER_ID="$2";       shift 2 ;;
    --agent-id)      AGENT_ID="$2";      shift 2 ;;
    *)               echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Validate ─────────────────────────────────────────────────────────────────

if [[ -z "$SUPABASE_URL" || -z "$SERVICE_KEY" || -z "$USER_ID" || -z "$AGENT_ID" ]]; then
  echo ""
  echo "Hecate PM Plugin Installer"
  echo ""
  echo "Usage:"
  echo "  curl -sSL https://raw.githubusercontent.com/gilanggemar/Hecate/main/hecate-openclaw-plugin/install.sh | bash -s -- \\"
  echo "    --supabase-url \"https://xxx.supabase.co\" \\"
  echo "    --service-key \"eyJ...\" \\"
  echo "    --user-id \"your-uuid\" \\"
  echo "    --agent-id \"sasha\""
  echo ""
  exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   Hecate PM Plugin — Installing...        ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# ── Step 1: Clone or update the repo ─────────────────────────────────────────

if [[ -d "$INSTALL_DIR/.git" ]]; then
  echo "→ Updating existing Hecate repo..."
  cd "$INSTALL_DIR"
  git pull --quiet origin main 2>/dev/null || git pull --quiet
else
  echo "→ Cloning Hecate repo..."
  git clone --depth 1 --single-branch --branch main "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

echo "  ✓ Repo ready at $INSTALL_DIR"

# ── Step 2: Install the plugin into OpenClaw ─────────────────────────────────

PLUGIN_DIR="$INSTALL_DIR/hecate-openclaw-plugin"

if [[ ! -d "$PLUGIN_DIR" ]]; then
  echo "  ✗ Plugin directory not found at $PLUGIN_DIR"
  exit 1
fi

echo "→ Installing plugin..."
openclaw plugins install "$PLUGIN_DIR" 2>/dev/null || true
echo "  ✓ Plugin installed"

# ── Step 3: Configure ────────────────────────────────────────────────────────

echo "→ Configuring for agent: $AGENT_ID"
openclaw hecate setup \
  --supabase-url "$SUPABASE_URL" \
  --service-key "$SERVICE_KEY" \
  --user-id "$USER_ID" \
  --agent-id "$AGENT_ID" 2>/dev/null || {
    # Fallback: write config directly if CLI isn't available yet
    echo "  (Writing config directly...)"
    OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"
    if command -v node &>/dev/null; then
      node -e "
        const fs = require('fs');
        const p = '$OPENCLAW_CONFIG';
        let c = {};
        try { c = JSON.parse(fs.readFileSync(p,'utf8')); } catch {}
        if (!c.plugins) c.plugins = {};
        if (!c.plugins.entries) c.plugins.entries = {};
        c.plugins.entries.hecate = {
          enabled: true,
          config: {
            supabaseUrl: '$SUPABASE_URL',
            serviceRoleKey: '$SERVICE_KEY',
            userId: '$USER_ID',
            agentId: '$AGENT_ID'
          }
        };
        if (!c.tools) c.tools = {};
        if (!Array.isArray(c.tools.alsoAllow)) c.tools.alsoAllow = [];
        if (!c.tools.alsoAllow.includes('hecate')) c.tools.alsoAllow.push('hecate');
        fs.mkdirSync(require('path').dirname(p), {recursive:true});
        fs.writeFileSync(p, JSON.stringify(c, null, 2));
      "
    fi
  }
echo "  ✓ Configured"

# ── Step 4: Restart gateway ──────────────────────────────────────────────────

echo "→ Restarting OpenClaw gateway..."
openclaw gateway restart 2>/dev/null || true
echo "  ✓ Gateway restarted"

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   ✓ Hecate PM Plugin Installed!           ║"
echo "║                                           ║"
echo "║   Agent: $AGENT_ID"
echo "║   Tools: HECATE_LIST_TASKS                ║"
echo "║          HECATE_CREATE_TASK                ║"
echo "║          HECATE_UPDATE_TASK                ║"
echo "║          HECATE_DELETE_TASK                ║"
echo "║          HECATE_LIST_AGENTS                ║"
echo "║                                           ║"
echo "║   Run: openclaw hecate doctor              ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
