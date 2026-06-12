---
title: Values and Units
parent: Language Reference
nav_order: 2
---

# Values and Units

AppyScript supports four value types: **numbers** (optionally with units), **strings**, **booleans**, and **variables**.

## Numbers

Plain numbers are written as decimal literals.

```
5
3.14
100
```

### Unit suffixes

A unit suffix attached directly to a number gives it a physical meaning. The interpreter uses the unit to convert and validate the value in context.

| Unit | Meaning | Example |
|---|---|---|
| `cm` | Centimetres (distance) | `30cm` |
| `m` | Metres (distance) | `2m` |
| `%` | Percentage (light level, speed, volume) | `80%` |
| `s` | Seconds (duration) | `2s` |
| `ms` | Milliseconds (duration) | `500ms` |
| `°` | Degrees (angle) | `90°` |

Unit suffixes are written with no space between the number and the suffix.

```
move forward 30cm
turn left 90°
wait 2s
wait 500ms
set speed to 50%
```

### Unit equivalence

`1m` and `100cm` represent the same distance. `2s` and `2000ms` represent the same duration. The interpreter normalises both forms.

## Strings

Strings are sequences of characters enclosed in either single or double quotes. Both forms are equivalent.

```
say "Hello, world!"
say 'Nice to meet you'
```

To include a quote character inside a string, use the opposite quote style.

```
say "It's working!"
say 'She said "wow"'
```

Strings are used with `say`, `play`, `show_text`, and `send`.

## Booleans

Boolean values are written as `true` or `false` (case-insensitive).

```
let moving = true
if moving
    stop
end
```

## Variables

Variables are named values. Names are case-insensitive, may contain letters, digits, and underscores, and must start with a letter.

```
let score = 0
let player_name = "Alex"
let done = false
```

See the Statements page for `let`, `set`, and `remember`.

## Using values in conditions

Unit-bearing numbers can appear directly in conditions.

```
when distance < 30cm
    stop
end

when light > 80%
    say "Too bright!"
end
```

## Arithmetic

Basic arithmetic expressions are supported inside `let` and `set` assignments.

```
let total = score + 10
let half = total / 2
set count to count - 1
```

Supported operators: `+`, `-`, `*`, `/`.
