from __future__ import annotations

import argparse

from .api import create_server


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the Ollama Network API server.")
    parser.add_argument("--host", default="localhost", help="Bind host.")
    parser.add_argument("--port", type=int, default=8000, help="Bind port.")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    server = create_server(host=args.host, port=args.port)
    print(f"Ollama Network API listening on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
