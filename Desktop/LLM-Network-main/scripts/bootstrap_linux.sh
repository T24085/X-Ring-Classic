#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-$HOME/.llm-network}"
REPO_URL="${REPO_URL:-https://github.com/T24085/LLM-Network.git}"
REPO_REF="${REPO_REF:-main}"
SERVER_URL="${SERVER_URL:-}"
ROLE="${ROLE:-auto}"
ENABLE_WORKER="${ENABLE_WORKER:-auto}"
INSTALL_OLLAMA="${INSTALL_OLLAMA:-auto}"
CREATE_SERVICE="${CREATE_SERVICE:-auto}"
PULL_MODELS="${PULL_MODELS:-1}"
WORKER_ID="${WORKER_ID:-}"
OWNER_USER_ID="${OWNER_USER_ID:-}"
GPU_NAME="${GPU_NAME:-Jetson Nano}"
VRAM_GB="${VRAM_GB:-4}"
MODELS_CSV="${MODELS_CSV:-qwen3:4b}"
TPS_CSV="${TPS_CSV:-qwen3:4b=10}"
WORKER_TOKEN="${WORKER_TOKEN:-}"
POLL_INTERVAL="${POLL_INTERVAL:-2}"

usage() {
  cat <<'EOF'
Usage:
  bootstrap_linux.sh [options]

Common options:
  --install-dir PATH
  --repo-url URL
  --repo-ref REF
  --server-url URL

Worker enablement options:
  --enable-worker
  --role user|worker|auto
  --worker-id ID
  --owner-user-id USER_ID
  --gpu-name NAME
  --vram-gb GB
  --models comma,separated,tags
  --tps comma,separated=model=tps
  --worker-token TOKEN
  --poll-interval SECONDS
  --install-ollama auto|yes|no
  --create-service auto|yes|no
  --pull-models 1|0
EOF
}

log() {
  printf '[llm-network] %s\n' "$*"
}

fail() {
  printf '[llm-network] ERROR: %s\n' "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --role) ROLE="$2"; shift 2 ;;
    --enable-worker) ENABLE_WORKER="yes"; shift 1 ;;
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --repo-url) REPO_URL="$2"; shift 2 ;;
    --repo-ref) REPO_REF="$2"; shift 2 ;;
    --server-url) SERVER_URL="$2"; shift 2 ;;
    --install-ollama) INSTALL_OLLAMA="$2"; shift 2 ;;
    --create-service) CREATE_SERVICE="$2"; shift 2 ;;
    --pull-models) PULL_MODELS="$2"; shift 2 ;;
    --worker-id) WORKER_ID="$2"; shift 2 ;;
    --owner-user-id) OWNER_USER_ID="$2"; shift 2 ;;
    --gpu-name) GPU_NAME="$2"; shift 2 ;;
    --vram-gb) VRAM_GB="$2"; shift 2 ;;
    --models) MODELS_CSV="$2"; shift 2 ;;
    --tps) TPS_CSV="$2"; shift 2 ;;
    --worker-token) WORKER_TOKEN="$2"; shift 2 ;;
    --poll-interval) POLL_INTERVAL="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

[[ "$ROLE" == "auto" || "$ROLE" == "user" || "$ROLE" == "worker" ]] || fail "--role must be 'auto', 'user', or 'worker'"
[[ "$ENABLE_WORKER" == "auto" || "$ENABLE_WORKER" == "yes" || "$ENABLE_WORKER" == "no" ]] || fail "--enable-worker resolves to yes/no/auto only"

if [[ "$ROLE" == "worker" ]]; then
  ENABLE_WORKER="yes"
elif [[ "$ROLE" == "user" && "$ENABLE_WORKER" == "auto" ]]; then
  ENABLE_WORKER="no"
fi

if [[ "$ENABLE_WORKER" == "auto" ]]; then
  if [[ -n "$WORKER_ID" || -n "$OWNER_USER_ID" || -n "$WORKER_TOKEN" ]]; then
    ENABLE_WORKER="yes"
  else
    ENABLE_WORKER="no"
  fi
fi

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

apt_install_if_possible() {
  local package="$1"
  if dpkg -s "$package" >/dev/null 2>&1; then
    return 0
  fi
  if have_cmd sudo && have_cmd apt-get; then
    log "Installing missing package: $package"
    sudo apt-get update -y
    sudo apt-get install -y "$package"
    return 0
  fi
  return 1
}

ensure_base_tools() {
  for tool in curl git; do
    if ! have_cmd "$tool"; then
      apt_install_if_possible "$tool" || fail "Missing required tool '$tool'. Install it and retry."
    fi
  done
}

choose_python() {
  local candidate
  for candidate in python3.13 python3.12 python3.11 python3.10 python3.9 python3.8 python3; do
    if have_cmd "$candidate"; then
      if "$candidate" - <<'PY' >/dev/null 2>&1
import sys
raise SystemExit(0 if sys.version_info >= (3, 8) else 1)
PY
      then
        printf '%s' "$candidate"
        return 0
      fi
    fi
  done
  return 1
}

ensure_python() {
  if ! PYTHON_BIN="$(choose_python)"; then
    if have_cmd apt-get && have_cmd sudo; then
      log "Installing Python 3 and venv support"
      sudo apt-get update -y
      sudo apt-get install -y python3 python3-venv python3-pip
      PYTHON_BIN="$(choose_python || true)"
    fi
  fi
  [[ -n "${PYTHON_BIN:-}" ]] || fail "Python 3.8+ is required."
  if ! "$PYTHON_BIN" -m venv --help >/dev/null 2>&1; then
    apt_install_if_possible python3-venv || fail "python3-venv is required."
  fi
}

create_venv() {
  mkdir -p "$INSTALL_DIR"
  if [[ ! -x "$INSTALL_DIR/venv/bin/python" ]]; then
    log "Creating virtual environment at $INSTALL_DIR/venv"
    "$PYTHON_BIN" -m venv "$INSTALL_DIR/venv"
  fi
  VENV_PY="$INSTALL_DIR/venv/bin/python"
  VENV_PIP="$INSTALL_DIR/venv/bin/pip"
}

install_package() {
  log "Installing ollama-network from $REPO_URL@$REPO_REF"
  "$VENV_PIP" install --upgrade pip setuptools wheel
  "$VENV_PIP" install --upgrade "git+$REPO_URL@$REPO_REF"
}

copy_logo_asset() {
  mkdir -p "$INSTALL_DIR/share"
  local source_logo
  source_logo="$("$VENV_PY" - <<'PY'
from importlib import resources
try:
    print(resources.files("ollama_network").joinpath("assets/logo.png"))
except Exception:
    print("")
PY
)"
  if [[ -n "$source_logo" && -f "$source_logo" ]]; then
    cp "$source_logo" "$INSTALL_DIR/share/logo.png"
  fi
}

install_ollama_if_needed() {
  local desired="$1"
  if [[ "$desired" == "no" ]]; then
    return 0
  fi
  if have_cmd ollama; then
    return 0
  fi
  [[ "$desired" == "yes" || "$desired" == "auto" ]] || return 0
  log "Installing Ollama"
  curl -fsSL https://ollama.com/install.sh | sh
}

pull_models_if_needed() {
  [[ "$PULL_MODELS" == "1" ]] || return 0
  have_cmd ollama || return 0
  local model
  IFS=',' read -r -a model_array <<<"$MODELS_CSV"
  for model in "${model_array[@]}"; do
    model="${model#"${model%%[![:space:]]*}"}"
    model="${model%"${model##*[![:space:]]}"}"
    [[ -n "$model" ]] || continue
    log "Pulling Ollama model $model"
    ollama pull "$model"
  done
}

write_user_env() {
  mkdir -p "$INSTALL_DIR/bin"
  cat >"$INSTALL_DIR/bin/activate-ollama-network.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
source "$INSTALL_DIR/venv/bin/activate"
export OLLAMA_NETWORK_SERVER_URL="${SERVER_URL}"
exec "\$SHELL"
EOF
  chmod +x "$INSTALL_DIR/bin/activate-ollama-network.sh"
}

write_dashboard_launcher() {
  [[ -n "$SERVER_URL" ]] || return 0
  mkdir -p "$INSTALL_DIR/bin"
  cat >"$INSTALL_DIR/bin/open-dashboard.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec xdg-open "${SERVER_URL%/}/dashboard"
EOF
  chmod +x "$INSTALL_DIR/bin/open-dashboard.sh"

  cat >"$HOME/open_llm_network_dashboard.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec "$INSTALL_DIR/bin/open-dashboard.sh"
EOF
  chmod +x "$HOME/open_llm_network_dashboard.sh"
}

write_worker_launcher() {
  [[ -n "$SERVER_URL" ]] || fail "--server-url is required for worker role"
  [[ -n "$WORKER_ID" ]] || fail "--worker-id is required for worker role"
  [[ -n "$OWNER_USER_ID" ]] || fail "--owner-user-id is required for worker role"
  [[ -n "$WORKER_TOKEN" ]] || fail "--worker-token is required for worker role"

  mkdir -p "$INSTALL_DIR/bin"
  local launcher="$INSTALL_DIR/bin/run-worker.sh"
  cat >"$launcher" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec "$INSTALL_DIR/venv/bin/ollama-network-worker" \\
  --server-url "$SERVER_URL" \\
  --worker-id "$WORKER_ID" \\
  --owner-user-id "$OWNER_USER_ID" \\
  --gpu-name "$GPU_NAME" \\
  --vram-gb "$VRAM_GB" \\
$("$PYTHON_BIN" - <<PY
models = [item.strip() for item in """$MODELS_CSV""".split(",") if item.strip()]
tps = [item.strip() for item in """$TPS_CSV""".split(",") if item.strip()]
for item in models:
    print(f'  --model "{item}" \\\\')
for item in tps:
    print(f'  --tps "{item}" \\\\')
PY
  )  --poll-interval "$POLL_INTERVAL" \\
  --worker-token "$WORKER_TOKEN"
EOF
  chmod +x "$launcher"

  cat >"$HOME/start_llm_network_worker.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec "$launcher"
EOF
  chmod +x "$HOME/start_llm_network_worker.sh"
}

write_desktop_shortcut() {
  [[ -n "$SERVER_URL" ]] || return 0
  local applications_dir="$HOME/.local/share/applications"
  local desktop_dir="$HOME/Desktop"

  mkdir -p "$applications_dir"
  cat >"$applications_dir/llm-network.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=LLM Network
Comment=Open the LLM Network dashboard
Exec=$INSTALL_DIR/bin/open-dashboard.sh
Icon=$INSTALL_DIR/share/logo.png
Terminal=false
Categories=Network;Utility;
EOF
  chmod +x "$applications_dir/llm-network.desktop"

  if [[ -d "$desktop_dir" ]]; then
    cp "$applications_dir/llm-network.desktop" "$desktop_dir/LLM Network.desktop"
    chmod +x "$desktop_dir/LLM Network.desktop"
  fi
}

install_worker_service() {
  local desired="$1"
  if [[ "$desired" == "no" ]]; then
    return 0
  fi
  if ! have_cmd systemctl; then
    if [[ "$desired" == "yes" ]]; then
      fail "systemctl is not available but --create-service=yes was requested."
    fi
    return 0
  fi
  if ! have_cmd sudo; then
    if [[ "$desired" == "yes" ]]; then
      fail "sudo is required to install a system worker service."
    fi
    return 0
  fi
  local service_name="llm-network-worker.service"
  local service_path="/etc/systemd/system/$service_name"
  log "Installing systemd service $service_name"
  sudo tee "$service_path" >/dev/null <<EOF
[Unit]
Description=LLM Network Worker
After=network-online.target ollama.service
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/bin/run-worker.sh
Restart=always
RestartSec=5
Environment=HOME=$HOME

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable --now "$service_name"
}

print_user_summary() {
  cat <<EOF

LLM Network install complete.

Install dir:
  $INSTALL_DIR

Activate the environment:
  source "$INSTALL_DIR/bin/activate-ollama-network.sh"

Dashboard launcher:
  $HOME/open_llm_network_dashboard.sh

Example commands:
  $INSTALL_DIR/venv/bin/ollama-network-cli --server-url "$SERVER_URL" network
  $INSTALL_DIR/venv/bin/ollama-network-cli --server-url "$SERVER_URL" models
EOF
}

print_worker_summary() {
  cat <<EOF

LLM Network install complete with worker mode enabled.

Install dir:
  $INSTALL_DIR

Worker launcher:
  $INSTALL_DIR/bin/run-worker.sh

Home wrapper:
  $HOME/start_llm_network_worker.sh

Dashboard launcher:
  $HOME/open_llm_network_dashboard.sh

Service status:
  sudo systemctl status llm-network-worker.service

Manual start:
  $INSTALL_DIR/bin/run-worker.sh
EOF
}

ensure_base_tools
ensure_python
create_venv
install_package
copy_logo_asset
write_user_env
write_dashboard_launcher
write_desktop_shortcut

if [[ "$ENABLE_WORKER" == "yes" ]]; then
  install_ollama_if_needed "$INSTALL_OLLAMA"
  pull_models_if_needed
  write_worker_launcher
  install_worker_service "$CREATE_SERVICE"
  print_worker_summary
else
  print_user_summary
fi
