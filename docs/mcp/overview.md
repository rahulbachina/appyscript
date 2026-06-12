---
title: MCP Overview
nav_order: 1
---

# AppyScript MCP Server

## What is MCP?

Model Context Protocol (MCP) is an open standard that lets AI agents — Claude, Cursor, GitHub Copilot, and others — call external tools during a conversation. Instead of the AI guessing how your hardware language works, it calls a tool, gets a structured result, and uses that to write better code.

You expose capabilities as **tools**. The AI discovers them at runtime and calls them with typed arguments. The result comes back as JSON. No prompt engineering tricks. No hallucinated syntax.

## Why AppyScript Has One

AppyScript targets six different hardware backends: ESP32, Arduino Uno, Raspberry Pi Pico, micro:bit, a JS simulator, and a generic embedded profile. Each backend has different pin layouts, supported peripherals, clock speeds, and code-generation quirks.

Without an MCP server, an AI generating AppyScript has to:

- Guess which keywords are valid on the target
- Infer hardware capabilities from training data (which may be outdated or wrong)
- Hope the generated code compiles without a real compiler in the loop

With the AppyScript MCP server, the AI can:

1. Call `appyscript_list_targets()` to see exactly which backends exist
2. Call `appyscript_hardware_info(target)` to get the actual `HardwareProfile` — pins, peripherals, clock
3. Write AppyScript source, then call `appyscript_validate(source)` to catch errors before showing code to the user
4. Call `appyscript_compile(source, target)` to produce real output code
5. Call `appyscript_simulate(source, opts)` to run the logic and confirm behaviour without physical hardware

This loop — generate, validate, compile, simulate — is fully automated. The AI never leaves the conversation.

## How Any AI Agent Can Generate AppyScript

```
User: "Blink the onboard LED every 500 ms on an ESP32"

AI workflow (MCP-powered):
  1. appyscript_list_targets()          → confirms "esp32" is valid
  2. appyscript_hardware_info("esp32")  → learns LED is pin 2, board runs at 240 MHz
  3. Writes AppyScript source
  4. appyscript_validate(source)        → zero diagnostics
  5. appyscript_compile(source, "esp32")→ returns Arduino-compatible C++ ready to flash
  6. Returns code + explanation to user
```

No hallucinated pin numbers. No invalid keywords. No round-trips to the user asking "which ESP32 pin is the LED?".

## Server Details

| Property | Value |
|----------|-------|
| Version | 2.0.0 |
| Protocol | MCP (JSON-RPC 2.0 over stdio) |
| Tools | 7 |
| Targets | 6 (esp32, arduino-uno, rpi-pico, microbit, simulator, embedded) |

## Installation

### Run Without Installing

```bash
npx appyscript@latest mcp
```

### Run From a Local Build

```bash
node dist/mcp/server.js
```

## Client Configuration

### Claude Code (`~/.claude/mcp.json`)

```json
{
  "mcpServers": {
    "appyscript": {
      "command": "npx",
      "args": ["appyscript@latest", "mcp"]
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

Same format as Claude Code:

```json
{
  "mcpServers": {
    "appyscript": {
      "command": "npx",
      "args": ["appyscript@latest", "mcp"]
    }
  }
}
```

### OpenAI Codex

Set the environment variable before running:

```bash
export MCP_SERVER="npx appyscript@latest mcp"
```

## What the AI Can Do Once Connected

| Goal | Tool to call |
|------|--------------|
| Discover available targets | `appyscript_list_targets` |
| Check hardware capabilities | `appyscript_hardware_info` |
| Discover language keywords | `appyscript_list_keywords` |
| Validate code before showing it | `appyscript_validate` |
| Compile to target output | `appyscript_compile` |
| Test logic without hardware | `appyscript_simulate` |
| Explain existing AppyScript | `appyscript_explain` |

See [Tools Reference](tools-reference.md) for the full parameter and return-type documentation.
