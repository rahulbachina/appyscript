---
title: Installation
parent: Getting Started
nav_order: 1
---

# Installation

AppyScript runs on Node.js and compiles your `.appy` programs to ESP32/MicroPython, Arduino C++, Pico MicroPython, micro:bit MicroPython, CircuitPython, and Applaa Home.

## Requirements

- Node.js 18 or later ([nodejs.org](https://nodejs.org))
- npm 9 or later (bundled with Node.js)
- A USB cable to connect your robot board

## Option 1 — Install via npm (recommended)

Install the AppyScript CLI globally so the `appyscript` command is available everywhere:

```bash
npm install -g appyscript
```

Verify the installation:

```bash
appyscript --version
```

You should see output like:

```
AppyScript 1.0.0
```

## Option 2 — Clone from GitHub

If you want the latest development build or want to contribute:

```bash
git clone https://github.com/rahulbachina/appyscript.git
cd appyscript
npm install
npm link
```

Then verify:

```bash
appyscript --version
```

## MCP Server (for AI assistants)

If you want an AI assistant such as Claude to generate and compile AppyScript programs for you, start the MCP server:

```bash
npx appyscript@latest mcp
```

Add this server to your AI assistant's MCP configuration and it will be able to write, compile, and flash AppyScript programs on your behalf.

## Skills (optional add-ons)

AppyScript Skills are pre-built libraries for common robotics patterns. Install them with:

```bash
appyscript skills add pid-control --agent claude
```

The `--agent claude` flag lets Claude generate code that uses the skill automatically.

## Supported Target Boards

| Target flag | Board / runtime |
|-------------|----------------|
| `esp32` | ESP32 / MicroPython |
| `arduino` | Arduino / C++ |
| `pico` | Raspberry Pi Pico / MicroPython |
| `microbit` | micro:bit / MicroPython |
| `circuitpython` | Any CircuitPython board |
| `applaa-home` | Applaa Home hub |

## Next Steps

Head to [First Program](first-program.md) to write and compile your first `.appy` file.
