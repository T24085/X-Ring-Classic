# Ollama Network MVP

This repository now includes an MVP for a reciprocal decentralized inference pool built around local-only Ollama workers.

## Design Constraints

- Only approved Ollama model tags can participate.
- Workers must execute models locally with cloud fallback disabled.
- The public pool only accepts `public` jobs for now.
- Credits are earned only when a worker serves another user's verified job.
- Self-owned workers are excluded from network assignment to prevent self-farming.

## Package Layout

The implementation lives in `src/ollama_network/`.

- `catalog.py`: approved Ollama models and reservation pricing
- `coordinator.py`: in-memory scheduler and settlement flow
- `ledger.py`: reciprocal credit accounting and reservation handling
- `models.py`: worker, job, result, and policy types
- `demo.py`: runnable end-to-end example

## Current Flow

1. Register users with a starting credit balance.
2. Register volunteer workers that advertise installed Ollama models and throughput.
3. Submit a public job for an approved Ollama model.
4. Reserve the requester's credits up front.
5. Match the job to another user's compatible worker.
6. Complete the job with a verified result.
7. Transfer the actual job credits to the worker owner and refund unused reservation.

## Run The Demo

```bash
python -m ollama_network.demo
```

## Run Tests

```bash
pytest tests/test_ollama_network.py
```

## What This MVP Is And Is Not

This now includes a minimal runnable runtime:

- reciprocal compute credits
- local-only Ollama model enforcement
- worker capability matching
- public-pool guardrails
- stdlib JSON API server for clients and workers
- worker daemon that polls, claims jobs, executes local `ollama run`, and reports results

It does not yet include:

- distributed verification workers
- persistent storage
- cryptographic worker attestation
- NAT traversal or peer-to-peer transport

## Recommended Next Steps

## Runtime Commands

Start the API server:

```bash
python -m ollama_network.server --host 127.0.0.1 --port 8000
```

Open the dashboard:

```text
http://127.0.0.1:8000/dashboard
```

CLI examples:

```bash
python -m ollama_network.cli --server-url http://127.0.0.1:8000 register-user --user-id alice --starting-credits 5
python -m ollama_network.cli --server-url http://127.0.0.1:8000 register-worker --worker-id worker-bob-01 --owner-user-id bob --gpu-name "RTX 4090" --vram-gb 24 --model llama3.1:8b --tps llama3.1:8b=72
python -m ollama_network.cli --server-url http://127.0.0.1:8000 submit-job --requester-user-id alice --model-tag llama3.1:8b --prompt "Summarize the network state." --max-output-tokens 240
```

Start a worker:

```bash
python -m ollama_network.worker_daemon --server-url http://127.0.0.1:8000 --worker-id worker-bob-01 --owner-user-id bob --gpu-name "RTX 4090" --vram-gb 24 --model llama3.1:8b --tps llama3.1:8b=72
```

## Dashboard Rationale

For the MVP, a combined dashboard is a good idea because it:

- reduces friction while the protocol is still changing
- exposes credit flow, worker state, and queue behavior in one place
- gives you a browser path for demos without writing a separate client app first
- still allows CLI-first usage through the dedicated `ollama_network.cli` module

For a real public network, this should likely split into:

- a requester client surface
- a worker/operator console
- a separate admin view for fraud, verification, and reputation

Recommended next steps:

1. Persist users, jobs, balances, and worker reputation in SQLite or Postgres.
2. Add a client CLI or small web UI for job submission and status polling.
3. Add result verification policies, including duplicate execution sampling.
4. Add signed worker identities and benchmark proofs before opening public registration.
5. Add worker heartbeats, reassignment timeouts, and stale-job recovery.
