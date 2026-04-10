# LLM Network

Decentralized local inference orchestration for Ollama-based workers.

LLM Network lets one machine run the coordinator and dashboard while other machines join as users, workers, or both. The system is designed around local Ollama models, account-based credits, shared conversation history, and a live view of network activity.

## What It Does

- Runs a central coordinator API and browser dashboard
- Lets users sign in with Google and keep a stable network identity
- Supports shared balances, conversations, and history across machines
- Allows one account to both use the network and contribute worker capacity
- Supports remote worker daemons with long-lived worker tokens
- Includes a one-command Linux installer for joining the network from GitHub

## Current Capabilities

- Local-only Ollama worker execution
- Credit reservation, settlement, refunds, and worker earnings
- Live network map on the landing page and dashboard
- Same-machine worker loop for testing
- Remote worker daemon support for Linux devices such as a Jetson or laptop
- Optional Firestore-backed shared state for multi-machine persistence

## Repository Layout

- `src/ollama_network/` core server, dashboard, worker daemon, auth, catalog, and state management
- `tests/` runtime, accounting, policy, and integration coverage
- `scripts/bootstrap_linux.sh` GitHub-served Linux installer
- `start_network_server.bat` Windows launcher for the coordinator
- `start_dashboard.bat` Windows launcher for the dashboard
- `start_tunnel.bat` Windows launcher for a public Cloudflare quick tunnel
- `start_worker_daemon.bat` Windows launcher for a local worker daemon with auto-detected hardware

## Requirements

- Python 3.8+
- Ollama on any machine that will execute local models
- Firebase project for Google sign-in
- Optional Firestore service account if you want shared state across multiple hosts

## Installation

### Local Development

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
```

Or install from project metadata:

```bash
pip install -e .[dev]
```

### Linux Join Installer

Client install:

```bash
curl -fsSL https://raw.githubusercontent.com/T24085/LLM-Network/main/scripts/bootstrap_linux.sh | \
  bash -s -- --server-url http://YOUR_SERVER_HOST:8000
```

Enable worker mode from the same installer:

```bash
curl -fsSL https://raw.githubusercontent.com/T24085/LLM-Network/main/scripts/bootstrap_linux.sh | \
  bash -s -- \
    --server-url http://YOUR_SERVER_HOST:8000 \
    --enable-worker \
    --owner-user-id usr_your_id_here \
    --worker-id worker-your-node-01 \
    --gpu-name "Jetson Nano" \
    --vram-gb 4 \
    --models qwen3:4b \
    --tps qwen3:4b=10 \
    --worker-token YOUR_WORKER_TOKEN
```

The Linux installer creates:

- `~/.llm-network/` managed install directory
- `~/open_llm_network_dashboard.sh`
- `~/start_llm_network_worker.sh` when worker mode is enabled
- a desktop shortcut for Linux desktop environments

## Running the Network

### Windows

Start the coordinator:

```bat
start_network_server.bat
```

Open the dashboard:

```bat
start_dashboard.bat
```

Expose the server to another PC:

```bat
start_tunnel.bat
```

This opens a Cloudflare quick tunnel to `http://localhost:8000` and prints a public `trycloudflare.com` URL.
If you plan to sign in with Google through that URL, add the generated tunnel hostname to Firebase
Authentication authorized domains before testing from the other machine.

Start a worker on the current PC:

```bat
start_worker_daemon.bat
```

The launcher prompts for the owner user id and long-lived worker token, then auto-detects the local GPU,
system RAM, and installed Ollama models on the machine where it runs. Use this on the worker PC itself,
not on the coordinator host, when you want each worker to advertise its own hardware.

### Manual Server Startup

Local-only:

```bash
python -m ollama_network.server --host localhost --port 8000
```

Accessible to other machines:

```bash
python -m ollama_network.server --host 0.0.0.0 --port 8000
```

Dashboard URL:

```text
http://localhost:8000/dashboard
```

Landing page:

```text
http://localhost:8000/
```

## Authentication

Google sign-in uses Firebase web auth. Keep the web config out of git and provide it through environment variables or an untracked file at `.runtime/firebase.local.json`.

Example:

```json
{
  "apiKey": "your-rotated-firebase-web-api-key",
  "authDomain": "llm-network.firebaseapp.com",
  "projectId": "llm-network",
  "storageBucket": "llm-network.firebasestorage.app",
  "messagingSenderId": "502332096634",
  "appId": "1:502332096634:web:bc43239838ae06ef197bc3"
}
```

If you expose the dashboard outside your local machine, add the real host name to Firebase Authentication authorized domains.

## Shared State Across Machines

By default, state is stored locally in `.runtime/private_state.json`.

To persist balances, conversations, account bindings, and history across multiple machines, configure the Firestore backend:

```powershell
$env:OLLAMA_NETWORK_STATE_BACKEND="firestore"
$env:OLLAMA_NETWORK_FIRESTORE_PROJECT_ID="your-project-id"
$env:OLLAMA_NETWORK_FIRESTORE_COLLECTION="ollama_network_state"
$env:OLLAMA_NETWORK_FIRESTORE_DOCUMENT="shared"
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account.json"
```

This path uses server credentials. Firestore rules alone do not provide this backend sync.

## CLI Examples

List models:

```bash
python -m ollama_network.cli --server-url http://localhost:8000 models
```

Issue a user identity:

```bash
python -m ollama_network.cli --server-url http://localhost:8000 issue-user --starting-credits 5
```

Inspect a user:

```bash
python -m ollama_network.cli --server-url http://localhost:8000 user --user-id usr_your_id_here
```

Submit a job:

```bash
python -m ollama_network.cli --server-url http://localhost:8000 submit-job --requester-user-id usr_your_id_here --model-tag qwen3:4b --prompt "Summarize the worker protocol." --max-output-tokens 240
```

## Remote Workers

Remote workers should authenticate with long-lived worker tokens, not Firebase browser tokens.

Issue a worker token on the coordinator host:

```bash
python -m ollama_network.cli issue-worker-token --user-id usr_your_id_here --label jetson-nano-home
```

List or revoke tokens later:

```bash
python -m ollama_network.cli list-worker-tokens --user-id usr_your_id_here
python -m ollama_network.cli revoke-worker-token --user-id usr_your_id_here --token-id wkt_your_token_id
```

Manual worker daemon example:

```bash
python -m ollama_network.worker_daemon \
  --server-url http://YOUR_SERVER_HOST:8000 \
  --worker-id worker-jetson-nano-01 \
  --owner-user-id usr_your_id_here \
  --gpu-name "Jetson Nano" \
  --vram-gb 4 \
  --model qwen3:4b \
  --tps qwen3:4b=10 \
  --worker-token YOUR_WORKER_TOKEN
```

## Worker Model Selection

Workers detect local Ollama models and can choose which of those models to advertise to the network.

Current behavior:

- A worker can register with any local model tags it wants to advertise
- The dashboard pre-fills detected models and lets the operator trim that list
- Models already known to the network catalog are routable by exact tag
- Unknown models are preserved on the worker but treated as not yet network-routable until catalog metadata is added

This keeps operator control at the machine level without breaking routing, pricing, or scheduler behavior for supported models.

## Deployment Notes

For a real internet-facing deployment:

- Bind the server to `0.0.0.0`
- Put the coordinator behind HTTPS
- Use a real hostname
- Add that hostname to Firebase authorized domains
- Prefer a reverse proxy or tunnel instead of exposing raw port `8000`
- Keep Firebase secrets and service-account credentials out of the repository

## Testing

Run the full suite:

```bash
pytest
```

## Status

This repository is in active development, but it already supports:

- authenticated dashboard access
- account-backed job submission
- remote worker onboarding
- shared Firestore-backed persistence
- live network visualization

It is suitable for continued internal development, LAN testing, and controlled early-network onboarding.
