---
title: Backends Overview
parent: Backends
nav_order: 1
---

# AppyScript Backends — Overview

AppyScript is a hardware-agnostic robotic language. A single `.appy` source file compiles to six distinct targets through a shared pipeline. This page explains the compiler architecture, the `BaseCodegen` class, and how to add a custom backend.

---

## Compiler Pipeline

```
.appy source
     │
     ▼
┌─────────────┐
│   Lexer     │  tokenises raw text → token stream
└─────────────┘
     │
     ▼
┌─────────────┐
│   Parser    │  token stream → AST (Abstract Syntax Tree)
└─────────────┘
     │
     ▼
┌──────────────────┐
│  Semantic Pass   │  type-checking, scope resolution, constant folding
└──────────────────┘
     │
     ▼
┌──────────────────────────────────────────┐
│         Backend Selector                 │
│  (--target esp32 | arduino | pico |      │
│           microbit | circuitpython | home)│
└──────────────────────────────────────────┘
     │
     ▼
┌──────────────────┐
│  Codegen Plugin  │  AST → target source code
│  (extends Base)  │
└──────────────────┘
     │
     ▼
 emitted file(s)
```

Every backend receives the same validated AST. The only thing that varies is the `Codegen` plugin that walks it.

---

## BaseCodegen Architecture

`BaseCodegen` is the abstract class all backends extend. It provides:

| Method | Responsibility |
|--------|----------------|
| `emit(node)` | dispatch an AST node to the right `visit_*` method |
| `indent()` / `dedent()` | track indentation level for emitted source |
| `write(line)` | append a line to the output buffer at the current indent |
| `header()` | emit boilerplate imports / includes (abstract — override per backend) |
| `footer()` | emit closing boilerplate (abstract) |
| `visit_Move(node)` | default motor-move implementation (can be overridden) |
| `visit_Say(node)` | default speak/display implementation (can be overridden) |
| `visit_Wait(node)` | default delay implementation |
| `visit_If(node)` | standard conditional walk |
| `visit_Loop(node)` | standard loop walk |
| `visit_EventHandler(node)` | wraps a block in the target's event model |

Because `visit_Move`, `visit_Say`, and `visit_Wait` have sensible defaults, a minimal backend only needs to override `header()`, `footer()`, and any hardware-specific nodes.

---

## Supported Targets

| Target flag | Language | Hardware |
|-------------|----------|----------|
| `esp32` | MicroPython (uasyncio) | M5Stack Core S3 SE |
| `arduino` | C++ (Arduino framework) | Uno / Nano / Mega |
| `pico` | MicroPython | Raspberry Pi Pico W |
| `microbit` | MicroPython | BBC micro:bit V2 |
| `circuitpython` | CircuitPython | Adafruit Circuit Playground Bluefruit |
| `home` | JSON (HomeProgram) | Applaa Home GuardrailLayer |

---

## Plugin System

Each backend lives in its own module under `appyscript/codegen/`:

```
appyscript/
  codegen/
    base.py          ← BaseCodegen
    esp32.py         ← ESP32Codegen(BaseCodegen)
    arduino.py       ← ArduinoCodegen(BaseCodegen)
    pico.py          ← PicoCodegen(BaseCodegen)
    microbit.py      ← MicrobitCodegen(BaseCodegen)
    circuitpython.py ← CircuitPythonCodegen(BaseCodegen)
    home.py          ← HomeCodegen(BaseCodegen)
    registry.py      ← BACKENDS dict
```

`registry.py` maps CLI target strings to codegen classes:

```python
# appyscript/codegen/registry.py
from .esp32 import ESP32Codegen
from .arduino import ArduinoCodegen
from .pico import PicoCodegen
from .microbit import MicrobitCodegen
from .circuitpython import CircuitPythonCodegen
from .home import HomeCodegen

BACKENDS = {
    "esp32":         ESP32Codegen,
    "arduino":       ArduinoCodegen,
    "pico":          PicoCodegen,
    "microbit":      MicrobitCodegen,
    "circuitpython": CircuitPythonCodegen,
    "home":          HomeCodegen,
}
```

The CLI resolves `--target` against this dict:

```python
codegen_class = BACKENDS[args.target]
output = codegen_class(ast).generate()
```

---

## How to Add a Custom Backend

**1. Create the codegen module.**

```python
# appyscript/codegen/myboard.py
from .base import BaseCodegen

class MyBoardCodegen(BaseCodegen):

    def header(self):
        self.write("from myboard_robot import Robot")
        self.write("robot = Robot()")
        self.write("")

    def footer(self):
        self.write("robot.run()")

    def visit_Move(self, node):
        direction = node.direction   # 'forward' | 'backward' | 'left' | 'right'
        speed     = node.speed       # 0–100
        duration  = node.duration    # seconds, may be None
        if duration:
            self.write(f"robot.move('{direction}', speed={speed}, secs={duration})")
        else:
            self.write(f"robot.move('{direction}', speed={speed})")
```

**2. Register it.**

```python
# appyscript/codegen/registry.py
from .myboard import MyBoardCodegen

BACKENDS["myboard"] = MyBoardCodegen
```

**3. Test it.**

```bash
appyscript compile --target myboard hello.appy --out hello_myboard.py
```

The MCP server exposes all registered backends automatically — no further wiring needed.

---

## Compile via MCP

Any AI connected to the AppyScript MCP server can compile to any backend:

```json
{
  "tool": "appyscript.compile",
  "input": {
    "source": "move forward for 2 seconds\nsay 'done'",
    "target": "esp32"
  }
}
```

The response contains the emitted source as a string, ready to flash.
