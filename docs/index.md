---
title: Home
nav_order: 1
description: "AppyScript — the English-first programming language for educational robotics"
permalink: /
---

# AppyScript

The **English-first** programming language for educational robotics.  
Write what you mean. No whitespace errors. Compiles to anything.

```appyscript
when distance < 30cm
  say "INTRUDER ALERT!"
  show angry
  spin right 180°
end
```

---

## Why AppyScript?

- **End-blocks, not indentation** — kids can't break programs with a wrong tab
- **Natural language** — `move forward for 2s` reads like English
- **6 compile targets** — one language, every popular robotics board, plus your smart home
- **AI-native** — MCP server lets Claude, Cursor, and Codex write AppyScript natively

---

## Quick Install

```bash
npm install -g appyscript
appyscript compile hello.appy --target esp32
```

---

## Targets

| Target | Runtime | Board |
|--------|---------|-------|
| `esp32` | MicroPython | M5Stack Core S3 SE, ESP32-S3 |
| `arduino` | C++ | Arduino Uno, Nano, Mega |
| `pico` | MicroPython | Raspberry Pi Pico W |
| `microbit` | MicroPython | BBC micro:bit V2 |
| `circuitpython` | CircuitPython | Adafruit Circuit Playground |
| `home` | JSON | Applaa Home smart devices |

---

[Get started →](getting-started/installation){: .btn .btn-primary }
[View on GitHub →](https://github.com/rahulbachina/appyscript){: .btn }
