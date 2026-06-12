# Lesson 3 — On the Move

**Goal:** Drive your robot forwards, backwards, round corners and in spins —
and know exactly how fast and how far.

## New words

| Keyword | What it does |
|---------|--------------|
| `move forward at 50% for 2s` | Drives forwards at half speed for 2 seconds |
| `back at 60% for 1s` | Drives backwards at 60% speed for 1 second |
| `turn left 90°` | Turns left a quarter turn (degrees, like a compass) |
| `turn right 90°` | Turns right a quarter turn |
| `spin right 180°` | Spins on the spot half way round |
| `stop` | Stops all the motors right now |

**Units to remember:** `%` is speed (100% = flat out), `s` is seconds,
`°` is degrees (90° = quarter turn, 180° = half, 360° = all the way round).

## Build it

### Step 1 — First drive

Put your robot on the floor (not the table — trust us). Then:

```
when button_a pressed
  say "Here I go!"
  move forward at 50% for 2s
  stop
end
```

Press A and watch it trundle off. Try changing `50%` to `30%` (gentle) or
`80%` (zoomy) and `2s` to other times.

### Step 2 — There and back

Add a turn so the robot comes home again:

```
when button_a pressed
  say "Here I go!"
  move forward at 50% for 2s
  turn right 180°
  move forward at 50% for 2s
  say "I'm back!"
  show happy
end
```

A 180° turn faces the robot the opposite way — so driving forward again
brings it back to you.

### Step 3 — The victory spin

Let's finish with a celebration on button B:

```
when button_a pressed
  say "Here I go!"
  move forward at 50% for 2s
  turn right 180°
  move forward at 50% for 2s
  say "I'm back!"
  show happy
end

when button_b pressed
  show excited
  spin right 360°
  play "success"
  say "Ta-daa!"
end
```

`spin` twirls on the spot, while `turn` is for steering round corners.

## Try it

1. **Letter L:** Make the robot drive the shape of a capital L — forward,
   turn left 90°, forward again.
2. **Wiggle walk:** Make the robot wiggle: turn left 30°, turn right 60°,
   turn left 30°, then drive forward. Does it look like a happy puppy?

## Watch out

Speeds need a `%` and times need an `s` or `ms`. If you write:

```
move forward at 50 for 2
```

AppyScript will say something like:

> **Oops!** Line 1: I need units! Try `at 50%` for the speed and `for 2s` for the time.

Numbers without units are like saying "I'll be there in 5" — five *what*?!

## Mini quiz

1. How many degrees is a full spin all the way round?
2. Which command halts the motors immediately?
3. What does the `%` control — speed or time?

*Answers (turn the page upside-down!):*

09Ɛ ˙Ɩ&nbsp;&nbsp;&nbsp;doʇs ˙ᄅ&nbsp;&nbsp;&nbsp;pǝǝds ˙Ɛ

---
Next: [Lesson 4 — Round and Round](lesson_04.md)
