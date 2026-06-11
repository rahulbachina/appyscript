# AppyScript

**The first English-first programming language for educational robotics.**

Write code that reads like a story. Compile it to any robot chip.

```
when distance < 30cm
  say "INTRUDER ALERT!"
  show angry
  spin right 180°
end
```

→ Compiles to MicroPython for ESP32 / Pico / micro:bit, or Arduino C++ for Uno/Nano.

---

## Why AppyScript?

Current robotic languages stop kids from building the robots they imagine.
MicroPython, Arduino C++, Scratch — all have a learning cliff between "I have an idea" and "it works."

AppyScript removes that cliff. If you can describe what you want the robot to do, you can write AppyScript.

**Invented by [Applaa](https://applaa.com) · Open to everyone.**

---

## Language Syntax

AppyScript uses `end` to close blocks — no indentation rules, no semicolons, no braces.

### Event Handlers

```
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

| Action | Example |
|--------|---------|
| Move | `move forward at 50% for 2s` |
| Turn | `turn left 90°` |
| Stop | `stop` |
| Say | `say "Hello World"` |
| Show expression | `show happy` |
| Show text | `show text "Score: "` |
| Play sound | `play "success"` |
| Wait | `wait 500ms` |

### Expressions

`happy` · `sad` · `thinking` · `excited` · `angry` · `alert` · `sleep` · `calm` · `confused` · `dizzy`

### Sensors

```
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

```
let score = 0
set score to score + 1
change score by 1
remember score        # saves to device memory
```

### Loops and Control

```
repeat 3 times
  spin right 90°
  wait 500ms
end

while distance > 50cm
  move forward at 30%
end

if light < 20%
  show sleep
else
  show happy
end
```

### Custom Behaviours

```
define celebrate
  show excited
  say "Yay!"
  spin right 360°
end

when button_a pressed
  do celebrate
end
```

### Run Forever

```
forever
  if distance < 30cm
    show alert
  end
  wait 100ms
end
```

---

## Supported Hardware

| Target ID | Hardware | Language |
|-----------|----------|----------|
| `esp32` | ESP32 / M5Stack Core S3 SE | MicroPython |
| `arduino` | Arduino Uno / Nano / Mega | C++ |
| `pico` | Raspberry Pi Pico W | MicroPython |
| `microbit` | BBC micro:bit V2 | MicroPython |

More backends welcome via pull request.

---

## Installation

```bash
npm install appyscript
```

Or use the CLI:

```bash
npx appyscript compile guard_robot.appy --target esp32
```

---

## Usage (Node.js / TypeScript)

```typescript
import { compile, validate } from 'appyscript'

const source = `
when button_a pressed
  say "Hello!"
  show happy
end
`

const result = compile(source, 'esp32')
if (result.ok) {
  console.log(result.code)  // MicroPython ready to flash
}
```

---

## MCP Server (for AI agents)

Any AI agent (Claude, GPT, Gemini) can generate AppyScript using the MCP server:

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

**MCP Tools:**
- `appyscript_compile(source, target)` — compile to hardware code
- `appyscript_validate(source)` — check syntax
- `appyscript_explain(source)` — plain English description
- `appyscript_list_targets()` — available hardware platforms
- `appyscript_list_keywords()` — all valid keywords

---

## Examples

- [Hello World](examples/hello_world.appy) — first program
- [Guard Robot](examples/guard_robot.appy) — distance sensor + reactions
- [Dance Robot](examples/dance.appy) — shake to trigger, custom behaviours
- [Times Tables](examples/times_tables.appy) — interactive quiz

---

## Contributing

AppyScript is open to the global education community.

To add a new hardware backend: create `src/backends/<chipname>.ts` following the pattern in `esp32.ts`.

---

## License

MIT — invented by Applaa, given to the world.
