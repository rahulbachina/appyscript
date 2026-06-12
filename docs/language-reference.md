# AppyScript Language Reference

Complete reference for every keyword, statement, and expression.

---

## Program structure

An AppyScript program is made of **blocks**. Each block starts with a keyword and ends with `end`.

```appyscript
when button_a pressed   ← block header
  say "Hello!"          ← statements inside
  show happy
end                     ← closes the block
```

---

## Event handlers

### `when button_a pressed` / `when button_b pressed`
Runs when a button is pressed.

### `when shaken`
Runs when the robot is shaken (needs accelerometer).

### `when tilted` / `when tilted left` / `when tilted right`
Runs when the robot is tilted.

### `when distance < 30cm`
Runs when a sensor condition is met. Supports: `distance`, `light`, `temperature`, `touch`, `acceleration`.
Operators: `<` `>` `<=` `>=` `==`

### `when start`
Runs once at program startup.

### `every 5s` / `every 500ms`
Runs on a repeating timer. Units: `ms`, `s`, `m`.

### `when received`
Runs when a wireless message is received.

---

## Blocks

### `forever`
Runs its body in an infinite loop.
```appyscript
forever
  move forward at 30%
  wait 100ms
end
```

### `define name`
Defines a reusable behaviour.
```appyscript
define celebrate
  show excited
  play "success"
end
```

---

## Actions

| Statement | Example | What it does |
|---|---|---|
| `move forward at N% for Xs` | `move forward at 50% for 2s` | Move in a direction |
| `move backward` | `move backward at 30%` | |
| `move left` / `move right` | `move left at 50%` | Tank turn |
| `turn left Ndegrees` | `turn left 90` | Pivot turn |
| `turn right Ndegrees` | `turn right 180` | |
| `spin left Ndegrees` | `spin left 360` | Same as turn |
| `stop` | `stop` | Stop motors |
| `stop all` | `stop all` | Emergency stop everything |
| `say "text"` | `say "Hello {name}!"` | Speak or display text |
| `show expression` | `show happy` | Show an emotion |
| `show text "..."` | `show text "Score: {score}"` | Display text |
| `play "sound"` | `play "success"` | Play a sound |
| `wait 2s` | `wait 500ms` | Pause |
| `wait until condition` | `wait until distance < 20cm` | Pause until true |
| `send value` | `send "hello"` | Wireless broadcast |
| `do name` | `do celebrate` | Call a behaviour |

**Expressions for `show`:** `happy` `sad` `thinking` `excited` `angry` `alert` `sleep` `calm` `confused` `dizzy`

**Sounds for `play`:** `success` `fail` `beep` `tada` `alert`

**Speed shortcuts:** `full` (100%) · `half` (50%) · `slow` (30%)

---

## Control flow

### `if / else`
```appyscript
if distance < 30cm
  show alert
else
  show calm
end
```

### `repeat N times`
```appyscript
repeat 3 times
  spin right 90
  wait 500ms
end
```

### `while condition`
```appyscript
while distance > 50cm
  move forward at 30%
  wait 10ms
end
```

### `match / case`
Clean multi-branch matching for sensors or variables:
```appyscript
match distance
  case < 15cm
    show angry
  case 15 to 40cm
    show calm
  case > 40cm
    show happy
end
```

---

## Variables

```appyscript
let score = 0          # declare
set score to score + 1 # update
change score by 1      # shorthand for +1
remember score         # save to session
save score             # save to flash (survives power-off)
load score             # restore from flash
```

---

## Values and expressions

| Expression | Example | Result |
|---|---|---|
| Number | `42` `3.14` | Number |
| String | `"Hello"` | Text |
| Boolean | `yes` `no` `true` `false` | True/False |
| Variable | `score` | Variable's value |
| Sensor | `distance` `light` `temperature` | Current reading |
| Math | `score + 1` `distance * 2` | Arithmetic |
| Template string | `"Score: {score}"` | String with variable |
| `ask "prompt"` | `let name = ask "Name?"` | User input |
| `pick random X to Y` | `pick random 1 to 6` | Random number |
| `round X` | `round distance` | Nearest integer |
| `abs X` | `abs temperature` | Absolute value |
| `min of X and Y` | `min of distance and 80` | Smaller of two |
| `max of X and Y` | `max of light and 20` | Larger of two |
| `length of X` | `length of name` | String/list length |

---

## Lists

```appyscript
let items = list            # empty list
add "apple" to items        # append
add "banana" to items
let first = item 1 of items # get (1-indexed)
let n = size of items       # count: 2
```

---

## Conditions

```appyscript
distance < 30cm        # sensor comparison
score > 10             # variable comparison
answer == "yes"        # equality
not distance < 30cm    # negation
distance < 30 and light > 50  # both true
distance < 30 or light > 80   # either true
```

---

## Comments

```appyscript
# This is a comment — ignored by the compiler
```

---

## Units

| Unit | Meaning | Example |
|---|---|---|
| `s` | seconds | `2s` `0.5s` |
| `ms` | milliseconds | `500ms` `100ms` |
| `m` | minutes | `1m` |
| `cm` | centimetres | `30cm` `20cm` |
| `%` | percent | `50%` |
| `°` | degrees | `90°` (ignored, just style) |

---

## Sensor names

| Name | What it reads |
|---|---|
| `distance` | Distance in cm (HC-SR04) |
| `light` | Light level 0–100 |
| `temperature` | Temperature in °C |
| `touch` | Touch pad (0 or 1) |
| `acceleration` | Total acceleration magnitude |
