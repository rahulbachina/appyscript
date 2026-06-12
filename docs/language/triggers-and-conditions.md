---
title: Triggers and Conditions
parent: Language Reference
nav_order: 4
---

# Triggers and Conditions

Triggers define **when** a block of code runs. Conditions define **whether** control-flow statements like `if` and `while` proceed.

---

## Triggers

Triggers appear in `when <trigger>` blocks. The body runs each time the trigger fires.

### Event triggers

| Trigger | Fires when |
|---|---|
| `start` | The program begins running |
| `button_a` | Button A is pressed |
| `button_b` | Button B is pressed |
| `shaken` | The robot is shaken |
| `tilted` | The robot is tilted |
| `received` | A message arrives via `send` |
| `timer <duration>` | The given time has elapsed since the program started (or since the last fire for repeating timers) |

```
when start
    say "Ready!"
end

when button_a
    do celebrate
end

when shaken
    show dizzy
end

when timer 5s
    say "Five seconds have passed"
end

when received
    say "Got a message!"
end
```

### Sensor triggers

Sensor triggers fire whenever the named sensor reading crosses the threshold. They are written as `when <sensor> <operator> <value>`.

| Trigger example | Fires when |
|---|---|
| `when distance < 30cm` | Distance sensor reads below 30 cm |
| `when distance > 50cm` | Distance sensor reads above 50 cm |
| `when light > 80%` | Light sensor reads above 80 % |
| `when light < 20%` | Light sensor reads below 20 % |
| `when temperature > 25` | Temperature sensor reads above 25 °C |
| `when temperature < 10` | Temperature sensor reads below 10 °C |

```
when distance < 30cm
    stop
    say "Obstacle!"
end

when light > 80%
    show alert
end

when temperature > 25
    say "It is warm"
end
```

---

## Sensor names

| Sensor name | What it measures | Typical unit |
|---|---|---|
| `distance` | Distance to nearest object | `cm` or `m` |
| `light` | Ambient light level | `%` |
| `temperature` | Ambient temperature | °C (bare number) |

Additional sensors may be available depending on the connected hardware. Refer to your robot's documentation for a full list.

---

## Conditions

Conditions are boolean expressions used in `if`, `while`, and sensor triggers.

### Comparison operators

| Operator | Meaning |
|---|---|
| `<` | Less than |
| `>` | Greater than |
| `==` | Equal to |
| `<=` | Less than or equal to |
| `>=` | Greater than or equal to |

```
if score >= 10
    say "You win!"
end

while distance > 20cm
    move forward 5cm
end
```

### Variable comparisons

Conditions can compare a variable to a literal value or to another variable.

```
if lives == 0
    say "Game over"
end

if score > high_score
    set high_score to score
end
```

### Logical operators

Conditions can be combined with `and`, `or`, and `not`.

| Operator | Meaning |
|---|---|
| `and` | Both sides must be true |
| `or` | At least one side must be true |
| `not` | Inverts the truth value |

```
if distance < 10cm and speed > 50%
    stop
end

if score > 5 or lives > 1
    say "Keep going!"
end

if not done
    move forward 10cm
end
```

Parentheses can be used for grouping when mixing `and` and `or`.

```
if (score > 10 or bonus == true) and lives > 0
    say "Still in the game!"
end
```

### Bare boolean variable

A variable that holds a boolean can be used as a condition directly.

```
let ready = true

if ready
    do launch
end

while not done
    move forward 5cm
end
```
