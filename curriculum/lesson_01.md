# Lesson 1 — Hello, Appy!

**Goal:** Make your robot wake up, say hello and show how it feels.

## New words

| Keyword | What it does |
|---------|--------------|
| `when start` | Runs the code inside as soon as your robot switches on |
| `say "..."` | Makes the robot speak (or print) the words in quotes |
| `show happy` | Shows a feeling on the robot's face (happy, sad, excited…) |
| `show text "..."` | Shows words on the robot's screen |
| `wait 500ms` | Pauses for a little while (ms = milliseconds, s = seconds) |
| `end` | Closes a block — every `when` needs one! |

## Build it

### Step 1 — Wake up and say hello

Every AppyScript program is made of **blocks**. A block opens with a header
(like `when start`) and closes with `end`. Type this in:

```
when start
  say "Hello! I am Appy!"
end
```

Press run. Your robot should greet you. You just wrote your first program!

### Step 2 — Show a feeling

Robots have faces too. Let's add an expression after the hello:

```
when start
  say "Hello! I am Appy!"
  show happy
end
```

Try swapping `happy` for `excited`, `sleepy`-feeling `sleep`, or `dizzy`.
The full list is: happy, sad, thinking, excited, angry, alert, sleep, calm,
confused, dizzy.

### Step 3 — A proper wake-up routine

Real wake-ups take time. Use `wait` to add pauses, and `show text` to put
words on the screen:

```
when start
  show sleep
  wait 1s
  say "Yawn... good morning!"
  show happy
  wait 500ms
  show text "Appy is awake!"
end
```

Run it and watch your robot slowly come to life. Lovely!

## Try it

1. **Moody robot:** Change the program so Appy wakes up *confused*, waits 2
   seconds, then becomes *excited* and says something silly.
2. **Countdown:** Use `show text` and `wait 1s` to count down "3", "2", "1",
   then say "Blast off!"

## Watch out

A very common slip is forgetting the `end` at the bottom of a block:

```
when start
  say "Hello!"
```

If you do this, AppyScript will tell you something like:

> **Oops!** Your `when start` block on line 1 never closes. Add `end` at the bottom.

Every block that opens must close — `when`, `if`, `repeat`, all of them.

## Mini quiz

1. Which keyword runs code as soon as the robot switches on?
2. What must every block finish with?
3. Which is longer: `wait 2s` or `wait 500ms`?

*Answers (turn the page upside-down!):*

ʇɹɐʇs uǝɥʍ ˙Ɩ&nbsp;&nbsp;&nbsp;puǝ ˙ᄅ&nbsp;&nbsp;&nbsp;sᄅ ʇıɐʍ ˙Ɛ

---
Next: [Lesson 2 — Push My Buttons](lesson_02.md)
