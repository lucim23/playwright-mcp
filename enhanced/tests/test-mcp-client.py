#!/usr/bin/env python3
"""
Minimal MCP client that launches the enhanced Playwright MCP server
(enhanced/cli.js) and inspects the tools/list + tools/call responses.

Ported from the legacy fork's root-level `test-mcp-client.py` (issue #6 / #9,
TK-3) and extended to assert the specific things that would catch upstream
regressions the enhancement layer depends on:
  (a) every enhanced param declared in enhanced/tools/schemas.js appears in
      the corresponding tool's tools/list inputSchema
  (b) file_download is listed
  (c) a tools/call using an enhanced param (browser_navigate with
      returnSnapshot:false, against a data: URL, no network needed) does not
      error and actually took effect (Snapshot section stripped) — this is
      exactly what would break silently if upstream ever adopted `.strict()`
      Zod schemas (see EP-1 / issue #6 study notes)

The server uses newline-delimited JSON-RPC over stdio (not Content-Length
framing) — same protocol shape as upstream's own cli.js.

NOTE ON THE `mcp` PACKAGE: despite the historical filename, this script (like
the legacy fork's original) never imports the `mcp` pip package — it speaks
newline-delimited JSON-RPC over stdio directly using only the standard
library (json/subprocess/threading/pathlib), so it needs nothing beyond
`python3` itself. `pip`/`pip3` aren't installed in the environment TK-2/TK-3
were implemented in (`python3 -m pip` -> "No module named pip"), which
initially looked like it would block running this script per the task
brief's fallback guidance — but since no package is actually required, it
runs fine as-is. It WAS executed end-to-end during verification (see the
task's final report for output/exit code) as a second, independent
regression gate alongside `enhanced/tests/smoke.mjs` (which drives the same
server through the real `@modelcontextprotocol/sdk` Client instead of raw
JSON-RPC framing).
"""

import json
import subprocess
import sys
import threading
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


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


def call_tool(proc, next_id, name, arguments):
    send_message(proc.stdin, {
        "jsonrpc": "2.0",
        "id": next_id,
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    })
    resp = read_message(proc.stdout)
    return resp


def main():
    server_cmd = ["node", str(REPO_ROOT / "enhanced" / "cli.js"), "--headless"]
    print(f"Starting: {' '.join(server_cmd)}")

    proc = subprocess.Popen(
        server_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=str(REPO_ROOT),
    )

    stderr_lines = []
    t = threading.Thread(target=collect_stderr, args=(proc.stderr, stderr_lines), daemon=True)
    t.start()

    failures = []

    def check(label, condition):
        status = "PASS" if condition else "FAIL"
        print(f"{status} - {label}")
        if not condition:
            failures.append(label)

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

        send_message(proc.stdin, {"jsonrpc": "2.0", "method": "notifications/initialized"})

        # 2. List tools
        print("\n--- tools/list ---")
        send_message(proc.stdin, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})

        resp = read_message(proc.stdout)
        if resp is None or "error" in resp:
            print(f"ERROR: {resp}")
            print("STDERR:", "\n".join(stderr_lines))
            return 1

        tools = resp["result"]["tools"]
        by_name = {t["name"]: t for t in tools}
        print(f"Total tools: {len(tools)}")

        # (b) file_download listed
        check("file_download is listed", "file_download" in by_name)
        if "file_download" in by_name:
            props = by_name["file_download"].get("inputSchema", {}).get("properties", {})
            check("file_download has url + path", "url" in props and "path" in props)

        # (a) enhanced params present in schemas — kept in sync with
        # enhanced/tools/schemas.js; if that file changes this list should too.
        expected_params = {
            "browser_click": ["returnSnapshot", "snapshotMaxElements", "snapshotFormat"],
            "browser_navigate": ["returnSnapshot"],
            "browser_snapshot": ["format", "maxElements", "includeRoles", "excludeRoles"],
            "browser_console_messages": ["limit", "countOnly"],
            "browser_network_requests": ["limit", "countOnly"],
            "browser_evaluate": ["maxOutputLength"],
            "browser_run_code_unsafe": ["maxOutputLength"],
            "browser_take_screenshot": ["type"],
        }
        for tool_name, params in expected_params.items():
            tool = by_name.get(tool_name)
            if tool is None:
                print(f"SKIP - {tool_name} not present under default capabilities")
                continue
            props = tool.get("inputSchema", {}).get("properties", {})
            for p in params:
                check(f"{tool_name}.inputSchema has enhanced param \"{p}\"", p in props)

        ss = by_name.get("browser_take_screenshot")
        if ss:
            q = ss.get("inputSchema", {}).get("properties", {}).get("type", {})
            check("browser_take_screenshot type default is jpeg", q.get("default") == "jpeg")

        # (c) enhanced param accepted without error + actually took effect
        print("\n--- tools/call: browser_navigate with returnSnapshot:false ---")
        resp = call_tool(proc, 3, "browser_navigate", {
            "url": "data:text/html,<h1>smoke test</h1>",
            "returnSnapshot": False,
        })
        result = resp.get("result", {}) if resp else {}
        check("tools/call did not error at the protocol level", resp is not None and "error" not in resp)
        check("browser_navigate result is not flagged isError", result.get("isError") is not True)
        text = next((c.get("text", "") for c in result.get("content", []) if c.get("type") == "text"), "")
        check("returnSnapshot:false strips the Snapshot section", "### Snapshot" not in text)
        check("returnSnapshot:false response notes it via Meta", "Snapshot: disabled" in text)

        print("\n--- tools/call: file_download rejects non-http(s) protocol ---")
        resp = call_tool(proc, 4, "file_download", {"url": "ftp://example.com/file.txt", "path": "x.txt"})
        result = resp.get("result", {}) if resp else {}
        check("file_download rejects ftp:// protocol", result.get("isError") is True)

        return 1 if failures else 0

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        if stderr_lines:
            print(f"\nSTDERR ({len(stderr_lines)} lines):")
            for line in stderr_lines[:20]:
                print(f"  {line}")
        if failures:
            print(f"\n{len(failures)} check(s) failed: {failures}")


if __name__ == "__main__":
    sys.exit(main() or 0)
