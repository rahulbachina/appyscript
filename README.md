# AppyScript v2

**The first English-first programming language for educational robotics.**

Write code that reads like a story. Compile it to any robot chip.

```appyscript
when distance < 30cm
  say "INTRUDER ALERT!"
  show angry
  spin right 180°
  wait 1s
  show alert
end
```

→ Compiles to **MicroPython** (ESP32 / Pico / micro:bit), **Arduino C++**, or **CircuitPython** (Adafruit).

---

## Why AppyScript?

Current robotic languages stop kids from building the robots they imagine.
MicroPython, Arduino C++, Scratch — all have a learning cliff between "I have an idea" and "it works."

AppyScript removes that cliff. If you can describe what you want the robot to do, you can write AppyScript.

**Invented by [Applaa](https://applaa.com) · Open to everyone · MIT licence.**

---

## Quick start

```bash
npm install appyscript
npx appyscript compile guard_robot.appy --target esp32
npx appyscript simulate guard_robot.appy --sensor-distance=20
```

Or use the **TypeScript/Node.js API**:

```typescript
import { compile, simulate } from 'appyscript'

const result = compile(source, 'esp32')
if (result.ok) {
  console.log(result.code)          // MicroPython, ready to flash
  console.log(result.warnings)      // Lint warnings
  console.log(result.sourceMap)     // Source map for debugging
}

// Run without hardware
const sim = simulate(ast, { sensors: { distance: 20 } })
console.log(sim.events)             // Everything the robot would do
console.log(sim.finalState)         // Final position, expression, variables
```

---

## Language syntax

AppyScript uses `end` to close blocks — no indentation rules, no semicolons, no braces.

### Event handlers

```appyscript
when button_a pressed
  say "Hello!"
  show happy
end

when distance < 30cm
  say "Too close!"
  show angry
end

when shaken
  show dizzy
  spin right 360°
end

every 5s
  say "Still guarding..."
end
```

### Actions

| Action          | Example                      |
|-----------------|------------------------------|
| Move            | `move forward at 50% for 2s` |
| Turn            | `turn left 90°`              |
| Stop            | `stop`                       |
| Say             | `say "Hello World"`          |
| Show expression | `show happy`                 |
| Show text       | `show text "Score: "`        |
| Play sound      | `play "success"`             |
| Wait            | `wait 500ms`                 |

### Sensors

```appyscript
if distance < 20cm
  show alert
end

if light < 30%
  show sleep
end

if temperature > 35
  say "It's hot!"
end
```

### Variables

```appyscript
let score = 0
set score to score + 1
change score by 1
remember score        # saves to device memory
```

### Loops and control

```appyscript
repeat 3 times
  spin right 90°
  wait 500ms
end

while distance > 50cm
  move forward at 30%
  wait 10ms
end

if light < 20%
  show sleep
else
  show happy
end
```

### Custom behaviours

```appyscript
define celebrate
  show excited
  say "Yay!"
  spin right 360°
end

when button_a pressed
  do celebrate
end
```

### Expressions

`happy` · `sad` · `thinking` · `excited` · `angry` · `alert` · `sleep` · `calm` · `confused` · `dizzy`

---

## Supported hardware

| Target ID        | Hardware                          | Language      |
|------------------|-----------------------------------|---------------|
| `esp32`          | ESP32 / M5Stack Core S3 SE        | MicroPython   |
| `arduino`        | Arduino Uno / Nano / Mega         | C++           |
| `pico`           | Raspberry Pi Pico W               | MicroPython   |
| `microbit`       | BBC micro:bit V2                  | MicroPython   |
| `circuitpython`  | Adafruit Circuit Playground Bluefruit | CircuitPython |

```bash
appyscript list-targets   # see all targets with capabilities
appyscript hardware-info --target microbit  # sensor availability, memory
```

---

## CLI reference

```bash
# Compile to hardware code
appyscript compile <file.appy> --target esp32
appyscript compile <file.appy> --target pico --strict --source-map

# Validate syntax + semantics + lint
appyscript validate <file.appy>

# Plain English summary
appyscript explain <file.appy>

# Simulate without hardware
appyscript simulate <file.appy>
appyscript simulate <file.appy> --sensor-distance=20 --button-a
appyscript simulate <file.appy> --shaken --max-ticks=100

# List targets and keywords
appyscript list-targets
appyscript list-keywords
```

### Flags

| Flag | Description |
|------|-------------|
| `--target <id>` | Hardware target (esp32, arduino, pico, microbit, circuitpython) |
| `--strict` | Treat warnings as errors |
| `--source-map` | Emit `.map` file linking generated code to `.appy` source |
| `--sensor-<name>=<N>` | Override sensor value in simulation |
| `--button-a / --button-b` | Press buttons in simulation |
| `--shaken / --tilted` | Fire gesture events in simulation |
| `--max-ticks=<N>` | Limit simulation iterations (default 50) |

---

## API reference

### `compile(source, target, options?)`

```typescript
const result = compile(source, 'esp32', {
  skipSemantic: false,  // run semantic analyser (default: true)
  skipLint: false,      // run linter (default: false)
  sourceMap: true,      // include source map
  strict: false,        // warnings are errors
})

result.ok               // boolean
result.code             // generated code string
result.errors           // Diagnostic[] — errors only
result.warnings         // Diagnostic[] — warnings only
result.diagnostics      // Diagnostic[] — all
result.formattedDiagnostics  // human-readable string with source context
result.sourceMap        // SourceMap | undefined
result.ast              // Program | undefined (for tooling)
```

### `validate(source)`

```typescript
const { valid, errors, warnings } = validate(source)
```

### `simulate(ast, options?)`

```typescript
const result = simulate(ast, {
  sensors:       { distance: 20, light: 80 },
  buttons:       { a: true, b: false },
  triggerEvents: ['shaken'],
  maxTicks:      50,
})

result.success          // boolean
result.events           // SimEvent[] — everything the robot did
result.finalState       // RobotState — position, expression, variables
result.executionTrace   // ExecutionTraceEntry[] — per-statement trace
```

### Plugin API — custom backends

```typescript
import { registry } from 'appyscript'

registry.register({
  targetId: 'my_robot',
  name:     'My Custom Robot Backend',
  version:  '1.0.0',
  generate(program, profile): GenerateResult {
    // Your codegen here
    return { code: '...' }
  },
})

// Now works with compile(), CLI, and MCP server
compile(source, 'my_robot')
```

---

## MCP Server (for AI agents)

Any AI agent — Claude, GPT, Gemini — can generate AppyScript using the built-in MCP server.

```bash
npm run mcp
```

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "appyscript": {
      "command": "npx",
      "args": ["appyscript", "--mcp"]
    }
  }
}
```

### MCP Tools (v2)

| Tool | Description |
|------|-------------|
| `appyscript_compile` | Compile source → hardware code with rich diagnostics |
| `appyscript_validate` | Validate syntax + semantics + lint |
| `appyscript_explain` | Plain English program summary |
| `appyscript_simulate` | Run without hardware — inject sensor values |
| `appyscript_hardware_info` | Sensor availability and memory for a target |
| `appyscript_list_targets` | All supported platforms |
| `appyscript_list_keywords` | Full keyword list |

---

## VSCode extension

Copy the `vscode/` folder to your extension directory, or install from the VSCode marketplace (coming soon).

**Features:**
- Syntax highlighting for `.appy` files
- `end`-block folding
- 12 code snippets (`guard`, `dance`, `when-button`, `forever`, `define`, ...)
- Auto-indent on `when`, `if`, `repeat`, `while`, `forever`, `define`

---

## Diagnostics

AppyScript v2 provides rich error messages with source context:

```
✖ error [E020] Behaviour "celebrate" is not defined
  → guard_robot.appy:8:3

     8 │   do celebrate
          ~~~~~~~~~~~~
  ℹ Add a "define celebrate" block, or check the spelling
  💡 Fix: Add: define celebrate\n  ...\nend

⚠ warning [W001] "forever" loop has no "wait" — it will run at full CPU speed
  → guard_robot.appy:12:1
  ℹ Add "wait 10ms" or "wait 100ms" at the end of the loop

1 error, 1 warning
```

### Error codes

| Code | Severity | Description |
|------|----------|-------------|
| E020 | Error | Undefined `do` target — behaviour never defined |
| E021 | Warning | Variable used before declaration with `let` |
| E022 | Error | Duplicate `define` block name |
| E023 | Error | Sensor not available on target hardware |
| W001 | Warning | `forever` loop without `wait` |
| W002 | Warning | Redundant `stop` before `move` |
| W004 | Warning | `define` block never called |
| W006 | Warning | `while` loop without `wait` |
| W007 | Warning | Duplicate event handler |

---

## Contributing

AppyScript is open to the global education community.

**Add a new hardware backend:**
1. Create `src/backends/<chipname>.ts` extending `BaseCodegen`
2. Register it with `registry.register(myBackend)` in `compiler.ts`
3. Add a `HardwareProfile` to `HARDWARE_PROFILES` in `plugins.ts`
4. Add tests in `src/test/compiler.test.ts`

```bash
npm run build    # TypeScript → dist/
npm test         # 42 tests
```

---

## Examples

- [Hello World](examples/hello_world.appy) — first program
- [Guard Robot](examples/guard_robot.appy) — distance sensor + reactions
- [Dance Robot](examples/dance.appy) — shake to trigger, custom behaviours
- [Times Tables](examples/times_tables.appy) — interactive quiz

---

## Architecture

```
src/
├── lexer.ts              Tokeniser (case-insensitive, unit suffixes)
├── parser.ts             Recursive descent → AST (with source locations)
├── ast.ts                AST type definitions + SourceLocation
├── diagnostics.ts        DiagnosticBag, codes, pretty-printer
├── plugins.ts            HardwareProfile, BackendPlugin, PluginRegistry
├── sourcemap.ts          Source map (generated → .appy line mapping)
├── compiler.ts           5-stage pipeline: lex→parse→semantic→lint→codegen
├── index.ts              Public API
├── analysis/
│   ├── semantic.ts       Semantic analyser (undefined vars, hardware checks)
│   └── linter.ts         Lint rules (no-wait loops, redundant stops, ...)
├── codegen/
│   └── base.ts           BaseCodegen (shared emit/value/condition logic)
├── backends/
│   ├── esp32.ts          MicroPython async (ESP32, M5Stack)
│   ├── pico.ts           MicroPython async (Raspberry Pi Pico W)
│   ├── microbit.ts       MicroPython polling (BBC micro:bit)
│   ├── arduino.ts        C++ polling (Arduino Uno/Nano/Mega)
│   └── circuitpython.ts  CircuitPython (Adafruit Circuit Playground)
├── simulation/
│   └── simulator.ts      JS execution engine (no hardware needed)
├── mcp/
│   └── server.ts         MCP server (7 tools for AI agents)
└── test/
    └── compiler.test.ts  42 tests (Node.js built-in runner)
```

---

## Licence

MIT — invented by Applaa, given to the world.
