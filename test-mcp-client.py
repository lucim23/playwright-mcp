#!/usr/bin/env python3
"""
Minimal MCP client that launches the Playwright MCP server
and inspects the tools/list response.

The server uses newline-delimited JSON-RPC over stdio (not Content-Length framing).
"""

import json
import subprocess
import sys
import threading


def read_message(stdout):
    """Read a newline-delimited JSON-RPC message."""
    line = stdout.readline()
    if not line:
        return None
    return json.loads(line.decode("utf-8"))


def send_message(stdin, msg):
    """Send a newline-delimited JSON-RPC message."""
    payload = json.dumps(msg).encode("utf-8") + b"\n"
    stdin.write(payload)
    stdin.flush()


def collect_stderr(stream, lines):
    for raw in stream:
        lines.append(raw.decode(errors="replace").rstrip())


def main():
    server_cmd = ["node", "packages/playwright-mcp/cli.js", "--headless"]
    print(f"Starting: {' '.join(server_cmd)}")

    proc = subprocess.Popen(
        server_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    stderr_lines = []
    t = threading.Thread(target=collect_stderr, args=(proc.stderr, stderr_lines), daemon=True)
    t.start()

    try:
        # 1. Initialize
        print("\n--- initialize ---")
        send_message(proc.stdin, {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "test-client", "version": "1.0.0"}
            }
        })

        resp = read_message(proc.stdout)
        if resp is None:
            print("ERROR: No init response")
            print("STDERR:", "\n".join(stderr_lines))
            return 1
        if "error" in resp:
            print(f"ERROR: {json.dumps(resp['error'], indent=2)}")
            return 1
        print(f"Server: {resp['result'].get('serverInfo', {})}")

        # 2. Notify initialized
        send_message(proc.stdin, {
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        })

        # 3. List tools
        print("\n--- tools/list ---")
        send_message(proc.stdin, {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        })

        resp = read_message(proc.stdout)
        if resp is None:
            print("ERROR: No tools/list response")
            print("STDERR:", "\n".join(stderr_lines))
            return 1
        if "error" in resp:
            print(f"ERROR: {json.dumps(resp['error'], indent=2)}")
            return 1

        tools = resp["result"]["tools"]
        names = [t["name"] for t in tools]
        print(f"Total tools: {len(tools)}")
        print(f"Tools: {json.dumps(names, indent=2)}")

        # Check file_download
        print("\n--- file_download ---")
        fd = next((t for t in tools if t["name"] == "file_download"), None)
        if fd:
            print("FOUND")
            print(json.dumps(fd, indent=2))
        else:
            print("MISSING!")

        # Check screenshot defaults
        ss = next((t for t in tools if t["name"] == "browser_take_screenshot"), None)
        if ss:
            props = ss.get("inputSchema", {}).get("properties", {})
            print(f"\n--- browser_take_screenshot ---")
            q = props.get("quality", {})
            tp = props.get("type", {})
            print(f"quality default: {q.get('default', 'NOT SET')}")
            print(f"type default: {tp.get('default', 'NOT SET')}")
            print(f"description length: {len(ss.get('description', ''))}")

        return 0

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        if stderr_lines:
            print(f"\nSTDERR ({len(stderr_lines)} lines):")
            for line in stderr_lines[:10]:
                print(f"  {line}")


if __name__ == "__main__":
    sys.exit(main() or 0)
