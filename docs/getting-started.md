# Getting Started with AppyScript

Get your robot moving in 10 minutes.

---

## Step 1 — Install AppyScript

```bash
npm install -g appyscript
```

Verify:
```bash
appyscript --help
```

---

## Step 2 — Write your first program

Create a file called `hello.appy`:

```appyscript
when start
  say "Hello World!"
  show happy
end

when button_a pressed
  move forward at 50% for 2s
  say "I moved!"
  show excited
end
```

---

## Step 3 — Choose your target

| Hardware | Target ID | What you need |
|---|---|---|
| ESP32 / M5Stack | `esp32` | MicroPython firmware |
| Raspberry Pi Pico W | `pico` | MicroPython firmware |
| BBC micro:bit | `microbit` | MicroPython (built-in) |
| Arduino Uno/Nano | `arduino` | Arduino IDE |
| Adafruit Circuit Playground | `circuitpython` | CircuitPython firmware |

---

## Step 4 — Compile

```bash
appyscript compile hello.appy --target esp32
```

This creates `hello.py` — ready to flash.

---

## Step 5 — Upload the runtime library

Before running your program, upload the Applaa runtime to your robot:

**ESP32 (Thonny or mpremote):**
```bash
mpremote cp runtime/esp32/applaa_robot.py :applaa_robot.py
mpremote cp hello.py :main.py
mpremote reset
```

**Pico W:**
```bash
mpremote cp runtime/pico/applaa_robot_pico.py :applaa_robot_pico.py
mpremote cp hello.py :main.py
mpremote reset
```

**Arduino:**
1. Copy `runtime/arduino/AppyRobot.h` next to `hello.ino`
2. Open `hello.ino` in Arduino IDE
3. Upload to board

**micro:bit:**
```bash
# In Thonny: Tools → Open MicroPython REPL → paste hello.py
```

---

## Step 6 — Your robot runs!

Press **Button A** on your robot. It should move forward for 2 seconds, say "I moved!", and show an excited face.

---

## What's next?

- [Language Reference](language-reference.md) — every keyword explained
- [Examples](../examples/) — 14 ready-to-run programs
- [Hardware Wiring](hardware/wiring.md) — circuit diagrams
- [Playground](https://appyscript.dev/playground) — try in your browser

---

## Troubleshooting

**"ModuleNotFoundError: No module named 'applaa_robot'"**
→ Upload the runtime library first (Step 5)

**Robot doesn't move**
→ Check motor wiring matches the default pin config in the runtime library
→ Or pass a custom config: `robot = Robot({'motor_a_fwd': 13})`

**Compilation error**
```bash
appyscript validate hello.appy
```
This shows exactly which line has the error and suggests a fix.

**Test without hardware**
```bash
appyscript simulate hello.appy
```
