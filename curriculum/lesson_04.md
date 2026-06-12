# Lesson 4 — Round and Round

**Goal:** Stop copying and pasting! Use loops to repeat things — a few times,
or forever.

## New words

| Keyword | What it does |
|---------|--------------|
| `repeat 4 times ... end` | Runs the code inside exactly 4 times |
| `forever ... end` | Runs the code inside over and over, without stopping |

## Build it

### Step 1 — The long way (don't do this!)

To drive in a square, you *could* write this:

```
when button_a pressed
  move forward at 50% for 1s
  turn right 90°
  move forward at 50% for 1s
  turn right 90°
  move forward at 50% for 1s
  turn right 90°
  move forward at 50% for 1s
  turn right 90°
end
```

It works… but it's the same two lines four times. Programmers are
(proudly!) too lazy for that.

### Step 2 — The loop way

A square is just "forward, turn right 90°" repeated 4 times:

```
when button_a pressed
  say "Watch me drive a square!"
  repeat 4 times
    move forward at 50% for 1s
    turn right 90°
  end
  show happy
end
```

Notice the `repeat` block has its own `end`, *inside* the button block.
Blocks can live inside blocks, like boxes inside boxes.

### Step 3 — A heartbeat that never stops

`forever` repeats until you switch the robot off. Perfect for things that
should always be happening, like blinking:

```
when start
  forever
    show happy
    wait 1s
    show calm
    wait 1s
  end
end

when button_a pressed
  say "Watch me drive a square!"
  repeat 4 times
    move forward at 50% for 1s
    turn right 90°
  end
  show happy
end
```

Now your robot gently "breathes" between faces all the time, AND still does
its square dance when you press A. Events and forever loops are good friends.

## Try it

1. **Triangle time:** A triangle needs 3 sides and 120° turns. Change the
   square code into a triangle. (Why 120°? Because 3 × 120° = 360°!)
2. **Disco mode:** Use `forever` to flash between `excited` and `dizzy`
   every 300ms, with `play "success"` each time round. Instant robot disco.

## Watch out

Loops inside events mean TWO `end`s — one for the loop, one for the event.
If you only write one:

```
when button_a pressed
  repeat 4 times
    move forward at 50% for 1s
end
```

AppyScript will say something like:

> **Oops!** Your `repeat` block on line 2 never closes. You have 2 open blocks but only 1 `end`.

Count your opens, count your `end`s — they must match.

## Mini quiz

1. Which loop runs an exact number of times?
2. Which loop never stops on its own?
3. To drive a square, how many times do we repeat "forward, turn 90°"?

*Answers (turn the page upside-down!):*

ʇɐǝdǝɹ ˙Ɩ&nbsp;&nbsp;&nbsp;ɹǝʌǝɹoɟ ˙ᄅ&nbsp;&nbsp;&nbsp;ㄣ ˙Ɛ

---
Next: [Lesson 5 — Robot Senses](lesson_05.md)
