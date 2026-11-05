#!/usr/bin/env python3
"""Runs the site locally: starts the web server and opens the home page.

The maps need this: OpenStreetMap refuses tile requests from pages opened
straight from disk (file://), so the site has to be served over http.

    python3 run.py                  (Windows: python run.py)
    python3 run.py --port 9000
    python3 run.py --no-browser

Press Ctrl+C to stop. No installs needed, only Python 3.
"""
import argparse
import functools
import http.server
import os
import pathlib
import platform
import subprocess
import threading
import webbrowser

SITE = pathlib.Path(__file__).resolve().parent / "Project"
HOME = "/Pages/HomePage.html"
PORTS_TO_TRY = 20


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/":
            self.send_response(302)
            self.send_header("Location", HOME)
            self.end_headers()
        else:
            super().do_GET()

    def end_headers(self):
        # Never cache, so a refresh always shows the latest edits
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # On Windows this option would let us share a port that is already in use
    allow_reuse_address = os.name != "nt"


def start_server(first_port):
    handler = functools.partial(Handler, directory=str(SITE))
    for port in range(first_port, first_port + PORTS_TO_TRY):
        try:
            # Only reachable from this computer, not from the rest of the network
            return Server(("127.0.0.1", port), handler), port
        except OSError:
            print(f"Port {port} is in use, trying the next one...")
    raise SystemExit(f"No free port between {first_port} and {first_port + PORTS_TO_TRY - 1}.")


def open_browser(url):
    if "microsoft" in platform.release().lower():
        # WSL: use the Windows browser
        try:
            subprocess.run(["cmd.exe", "/c", "start", "", url], cwd="/mnt/c",
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
        except OSError:
            pass
    webbrowser.open(url)


def main():
    parser = argparse.ArgumentParser(description="Run the CMS site locally.")
    parser.add_argument("--port", type=int, default=8000, help="port to use (default: 8000)")
    parser.add_argument("--no-browser", action="store_true", help="don't open the browser")
    args = parser.parse_args()

    server, port = start_server(args.port)
    url = f"http://localhost:{port}/"
    print(f"CMS is running at {url}  (Ctrl+C to stop)")
    if not args.no_browser:
        threading.Thread(target=open_browser, args=(url,), daemon=True).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
