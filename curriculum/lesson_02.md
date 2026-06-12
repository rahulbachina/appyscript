# Lesson 2 — Push My Buttons

**Goal:** Make your robot react when you press its buttons or give it a shake.

## New words

| Keyword | What it does |
|---------|--------------|
| `when button_a pressed` | Runs its block when you press button A |
| `when button_b pressed` | Runs its block when you press button B |
| `when shaken` | Runs its block when you shake the robot |
| `play "..."` | Plays a sound, like `play "success"` |

These are called **events** — bits of code that wait patiently and only run
when something *happens*.

## Build it

### Step 1 — One button, one job

Last lesson everything happened at `when start`. Now let's give button A a job:

```
when button_a pressed
  say "You pressed A!"
  show happy
end
```

Run it. Nothing happens... until you press A. The robot is *listening*.

### Step 2 — Two buttons, two moods

You can have lots of event blocks in one program. Add button B:

```
when button_a pressed
  say "You pressed A!"
  show happy
end

when button_b pressed
  say "Hey, that was B!"
  show angry
end
```

Press A, then B. Each button runs its own block. They never get mixed up.

### Step 3 — Shake it!

Robots can feel a shake too. Let's add a wake-up greeting and a shake reaction
to finish our program:

```
when start
  show calm
  say "Press my buttons... or shake me!"
end

when button_a pressed
  say "You pressed A!"
  show happy
end

when button_b pressed
  say "Hey, that was B!"
  show angry
end

when shaken
  show dizzy
  play "success"
  say "Whoa! Everything is spinning!"
end
```

One program, four events. Your robot now has a personality!

## Try it

1. **Secret handshake:** Make button A show `thinking`, wait 1 second, then
   show `excited` and say a secret password.
2. **Grumpy sleeper:** Make `when shaken` show `angry` and say "Five more
   minutes!" — like waking someone up on a school morning.

## Watch out

Watch your spelling on event names — it's `button_a` with an underscore,
not `button a` or `buttonA`:

```
when button a pressed
  say "Hello"
end
```

AppyScript will say something like:

> **Oops!** Line 1: I don't recognise `button a`. Did you mean `button_a`?

When you see "Did you mean…?", the fix is usually one tiny typo away.

## Mini quiz

1. What do we call code that waits for something to happen?
2. Which event runs when you wobble the robot about?
3. Can one program have both a `when button_a pressed` block and a
   `when button_b pressed` block? (yes or no)

*Answers (turn the page upside-down!):*

ʇuǝʌǝ uɐ ˙Ɩ&nbsp;&nbsp;&nbsp;uǝʞɐɥs uǝɥʍ ˙ᄅ&nbsp;&nbsp;&nbsp;sǝʎ ˙Ɛ

---
Next: [Lesson 3 — On the Move](lesson_03.md)
