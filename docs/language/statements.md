---
title: Statements
parent: Language Reference
nav_order: 3
---

# Statements

This page lists every AppyScript statement with its syntax and a short example.

---

## Movement

### `move forward <distance>`

Moves the robot forward by the given distance.

```
move forward 30cm
move forward 1m
```

### `move backward <distance>`

Moves the robot backward by the given distance.

```
move backward 20cm
```

### `move left <distance>`

Strafes or steers the robot to the left.

```
move left 15cm
```

### `move right <distance>`

Strafes or steers the robot to the right.

```
move right 15cm
```

### `turn left <angle>`

Rotates the robot counter-clockwise by the given angle.

```
turn left 90°
turn left 45°
```

### `turn right <angle>`

Rotates the robot clockwise by the given angle.

```
turn right 90°
turn right 180°
```

### `stop`

Halts all movement immediately. Also exits a `forever` loop when reached.

```
stop
```

---

## Output

### `say "<text>"`

Speaks the text aloud using the robot's speaker or text-to-speech engine.

```
say "Hello!"
say 'Nice job'
```

### `play "<sound>"`

Plays a named sound clip.

```
play "beep"
play "fanfare"
play "alert"
```

### `show <emotion>`

Displays an emotion face or icon on the robot's screen or LED matrix.

Available emotions: `happy`, `sad`, `angry`, `alert`, `calm`, `confused`, `dizzy`, `excited`, `sleep`, `thinking`.

```
show happy
show confused
show alert
```

### `show_text "<text>"`

Scrolls or displays a short text string on the robot's screen.

```
show_text "Score: 10"
show_text "GO!"
```

---

## Timing

### `wait <duration>`

Pauses execution for the given duration.

```
wait 2s
wait 500ms
```

---

## Variables

### `let <name> = <value>`

Declares a new variable and assigns it an initial value.

```
let score = 0
let name = "Alex"
let active = true
```

### `set <name> to <value>`

Updates the value of an existing variable.

```
set score to score + 1
set active to false
```

### `remember <name>`

Persists the variable's current value so it survives a program restart or power cycle.

```
let high_score = 0
-- ... update high_score during the game ...
remember high_score
```

---

## Control flow

### `if <condition> ... end`

Runs the body only when the condition is true.

```
if score > 10
    say "Great score!"
end
```

### `if <condition> ... else ... end`

Runs the first body when true, the second body when false.

```
if distance < 20cm
    stop
else
    move forward 10cm
end
```

### `repeat <N> times ... end`

Runs the body exactly N times.

```
repeat 4 times
    move forward 20cm
    turn right 90°
end
```

### `while <condition> ... end`

Runs the body repeatedly as long as the condition is true.

```
while distance > 30cm
    move forward 5cm
end
stop
```

### `forever ... end`

Runs the body in an infinite loop.

```
forever
    show happy
    wait 1s
    show calm
    wait 1s
end
```

### `match <expression> ... end` (v2)

Tests an expression against a series of `case` branches and runs the first matching one.

```
match distance
    case < 10cm
        stop
        say "Too close!"
    case > 50cm
        move forward 20cm
end
```

Branches are evaluated top-to-bottom. Only the first matching branch runs.

---

## Custom actions

### `define <name> ... end`

Defines a reusable block of statements.

```
define wave
    turn left 30°
    turn right 60°
    turn left 30°
end
```

### `do <name>`

Calls a previously defined action.

```
do wave
```

`do` can appear inside triggers, loops, other `define` blocks, or at the top level.

---

## Messaging

### `send <message>`

Broadcasts a message to other robots or listeners on the same network channel.

```
send "start"
send "player_scored"
```

Paired with the `received` trigger — see the Triggers and Conditions page.
