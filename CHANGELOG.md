# Changelog

All notable changes to AppyScript are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [1.0.0] — Unreleased (coming soon)

### 🎉 First public release

AppyScript is the first English-first programming language for educational robotics.
Write code that reads like a story. Compile to any robot chip.

### Language features
- Event handlers: `when button_a pressed`, `when distance < 30cm`, `every 5s`
- Actions: `move`, `turn`, `stop`, `say`, `show`, `play`, `wait`
- Control flow: `if/else`, `repeat`, `while`, `forever`, `match/case`
- Variables: `let`, `set`, `change`, `save`, `load`
- Template strings: `"Hello {name}!"`
- User input: `ask "Your name?"`
- Math helpers: `round`, `abs`, `min of X and Y`, `max of X and Y`
- Lists: `let x = list`, `add X to list`, `item N of list`
- Random: `pick random 1 to 6`
- String helpers: `length of name`
- `wait until condition` — natural pause until sensor condition met
- `stop all` — emergency stop all motors

### Targets
- ESP32 / M5Stack (MicroPython + uasyncio)
- Raspberry Pi Pico W (MicroPython + uasyncio)
- BBC micro:bit V2 (MicroPython)
- Arduino Uno / Nano / Mega (C++)
- Adafruit Circuit Playground Bluefruit (CircuitPython)

### Tooling
- CLI: `compile`, `validate`, `explain`, `simulate`, `list-targets`
- MCP Server: 7 tools for AI agents (Claude, GPT, etc.)
- VSCode extension: syntax highlighting, folding, 12 snippets
- Simulation engine: run without hardware, inject sensors/buttons

### Examples
- 14 example programs covering all language features
