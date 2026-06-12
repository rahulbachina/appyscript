---
title: Hello Robot
parent: Getting Started
nav_order: 3
---

# Hello Robot

In this guide you will build a guard robot that detects intruders, shouts an alert, pulls an angry face, and spins to face the threat.

## What the robot will do

When the distance sensor reads less than 30 cm the robot will:

1. Say `"INTRUDER ALERT!"` over its speaker
2. Show an angry expression on its display
3. Spin right 180°

## Hardware you need

- An ESP32-based robot with:
  - An ultrasonic or time-of-flight distance sensor (e.g. HC-SR04)
  - A speaker or buzzer
  - An LED matrix or OLED display
  - Two drive motors

## The program

Create a file called `guard-robot.appy`:

```appy
# guard-robot.appy — Intruder detection guard robot

when ready
  say "Guard robot is online. Watching..."
end

when distance < 30
  say "INTRUDER ALERT!"
  show angry
  spin right 180
end
```

## Line-by-line walkthrough

### `when ready`

```appy
when ready
  say "Guard robot is online. Watching..."
end
```

This block runs once when the board boots. `say` prints to the serial console **and** speaks through the speaker if one is connected. The `end` keyword closes the block — no indentation rules to worry about.

---

### `when distance < 30`

```appy
when distance < 30
```

AppyScript polls the distance sensor automatically. Whenever the reading drops below 30 cm, this block fires. You do not need to write a loop or configure the sensor pin — AppyScript handles the wiring for standard sensor layouts.

---

### `say "INTRUDER ALERT!"`

```appy
  say "INTRUDER ALERT!"
```

Sends the text to the serial console and to the speaker. On boards without a speaker the message is serial-only — no crash, no error.

---

### `show angry`

```appy
  show angry
```

Displays a built-in angry emoji on the LED matrix or OLED screen. Other built-in expressions include `happy`, `sad`, `confused`, and `sleeping`.

---

### `spin right 180`

```appy
  spin right 180
end
```

Turns the robot clockwise 180 degrees using the drive motors. `spin left 90` would turn anti-clockwise 90 degrees. The `end` keyword closes the `when distance < 30` block.

---

## Compile and flash

```bash
appyscript compile guard-robot.appy --target esp32
appyscript flash build/guard-robot_esp32.py
```

Open the serial monitor and walk toward the robot:

```bash
appyscript monitor
```

Expected output when you get within 30 cm:

```
Guard robot is online. Watching...
INTRUDER ALERT!
```

The display will show an angry face and the robot will spin to face you.

## Extending the guard robot

Here are a few ideas to try next:

```appy
# Sound a siren for 3 seconds before speaking
when distance < 30
  beep 440 for 3
  say "INTRUDER ALERT!"
  show angry
  spin right 180
end
```

```appy
# Different reactions at different distances
when distance < 60
  say "Someone is close..."
  show confused
end

when distance < 30
  say "INTRUDER ALERT!"
  show angry
  spin right 180
end
```

## Key concepts covered

| Concept | What you learned |
|---------|------------------|
| `end` blocks | Groups code without whitespace rules |
| `when ready` | Boot-time initialisation |
| `when <condition>` | Reactive event triggers |
| `say` | Serial + speaker output |
| `show` | Built-in display expressions |
| `spin` | Motor control with direction and degrees |

## Next Steps

- Add the `pid-control` skill for smoother motor movement: `appyscript skills add pid-control --agent claude`
- Explore other sensor events in the [Language Reference](../reference/language.md)
- Connect your robot to Applaa Home: `appyscript compile guard-robot.appy --target applaa-home`
