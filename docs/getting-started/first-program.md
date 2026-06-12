---
title: First Program
parent: Getting Started
nav_order: 2
---

# First Program

In this guide you will write a one-line AppyScript program, compile it for an ESP32, and flash it to the board.

## Why AppyScript uses `end` blocks

Most text languages use indentation or curly braces to group code. AppyScript uses `end` keywords instead. That means a misplaced space or tab can **never** break your program — a common frustration for beginners with Python.

```appy
# Python-style indentation errors are impossible in AppyScript
if distance < 30
  say "hello"   # indentation is just for readability
end
```

## Step 1 — Create hello.appy

Create a new file called `hello.appy` and add the following:

```appy
# hello.appy — My first AppyScript program

when ready
  say "Hello from AppyScript!"
end
```

**What each line does:**

| Line | Meaning |
|------|---------|
| `when ready` | Run this block once when the board finishes booting |
| `say "..."` | Print a message over the serial console |
| `end` | Close the `when ready` block |

## Step 2 — Compile for ESP32

Run the compiler and choose ESP32 as the target:

```bash
appyscript compile hello.appy --target esp32
```

The compiler will:

1. Parse `hello.appy`
2. Type-check your program
3. Emit MicroPython code into a `build/` folder

You will see output similar to:

```
✓ Parsed hello.appy
✓ Type-check passed
✓ Compiled → build/hello_esp32.py
  Target : ESP32 / MicroPython
  Warnings: 0
  Errors  : 0
```

## Step 3 — Flash to the board

Connect your ESP32 via USB, then flash the compiled file:

```bash
appyscript flash build/hello_esp32.py
```

AppyScript will auto-detect the serial port. If more than one port is found it will list them and ask you to choose.

After flashing, open the serial monitor:

```bash
appyscript monitor
```

You should see:

```
Hello from AppyScript!
```

## Compiling for other boards

The same source file compiles to any supported target — no changes needed:

```bash
appyscript compile hello.appy --target arduino
appyscript compile hello.appy --target pico
appyscript compile hello.appy --target microbit
appyscript compile hello.appy --target circuitpython
appyscript compile hello.appy --target applaa-home
```

## Next Steps

Now that your board is talking back to you, head to [Hello Robot](hello-robot.md) to build your first reactive robot guard.
