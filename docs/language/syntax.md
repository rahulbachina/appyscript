---
title: Syntax
parent: Language Reference
nav_order: 1
---

# AppyScript Syntax

AppyScript is an English-first programming language designed for educational robotics. It reads like plain instructions, so beginners can focus on logic rather than punctuation.

## General rules

- **Case-insensitive.** `Move Forward`, `move forward`, and `MOVE FORWARD` are all the same.
- **One statement per line.** Each instruction occupies its own line.
- **Whitespace is insignificant** beyond separating words. Extra spaces and blank lines are ignored.
- **No semicolons or braces.** Blocks are closed with `end`, not punctuation.

## Comments

Begin a comment with `--`. Everything from `--` to the end of the line is ignored by the interpreter.

```
-- This is a comment
move forward 30cm  -- inline comment
```

## End-block syntax

AppyScript uses explicit `end` keywords to close every block. There is no indentation rule — indentation is recommended for readability but has no effect on execution.

### Block forms

| Block type | Opens with | Closes with |
|---|---|---|
| Trigger handler | `when <trigger>` | `end` |
| Forever loop | `forever` | `end` |
| Conditional | `if <condition>` | `end` |
| Conditional with else | `if <condition> ... else` | `end` |
| Count loop | `repeat <N> times` | `end` |
| While loop | `while <condition>` | `end` |
| Custom action | `define <name>` | `end` |
| Match block | `match <expression>` | `end` |

### Example — nested blocks

```
when button_a
    repeat 3 times
        move forward 20cm
        turn right 90°
    end
end
```

### Example — define and call

```
define celebrate
    say "Hooray!"
    show excited
    play "fanfare"
end

when shaken
    do celebrate
end
```

## Trigger handlers

A `when` block runs its body every time the named trigger fires. Multiple `when` blocks for the same trigger are allowed and run in order.

```
when start
    say "Ready!"
end
```

## Forever loop

`forever` repeats its body indefinitely until the program stops or a `stop` statement is reached.

```
forever
    move forward 10cm
    wait 1s
end
```

## Program structure

A program is a flat list of trigger handlers and `define` blocks. There is no required entry point — the `when start` trigger fires automatically when the program begins.

```
-- Optional startup block
when start
    say "Hello!"
end

-- Reusable actions
define spin
    turn right 360°
end

-- React to events
when button_a
    do spin
end
```
