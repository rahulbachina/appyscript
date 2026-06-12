---
title: Examples
nav_order: 3
---

# AppyScript Home Examples

Six complete working programs. Each can be saved as a `.appy` file and compiled with:

```bash
appyscript compile <filename>.appy --target home
```

---

## 1. Goodnight Mode

Dims all lights to a low warm setting, turns off the living room, and says goodnight.

```appyscript
-- goodnight.appy
-- Run this when it's time for bed.

when start
  set bedroom_light to "warm"
  set bedroom_light to 15
  set hallway_lamp to 10
  set living_room to "off"
  set kitchen_light to "off"
  say "Goodnight! Sleep well."
end
```

**What happens:**
- `bedroom_light` is set to warm white at 15% brightness.
- `hallway_lamp` is left on at 10% so nobody trips in the dark.
- Living room and kitchen lights turn off.
- A notification is delivered to the Applaa app.

**Devices used:** `bedroom_light` (Tier 1), `hallway_lamp` (Tier 1), `living_room` (Tier 1), `kitchen_light` (Tier 1)

---

## 2. Morning Routine

Gradually brightens the bedroom light and plays a wake-up message, then brings lights to full after one minute.

```appyscript
-- morning.appy
-- Activate this to start a gentle wake-up sequence.

when start
  set bedroom_light to "cool"
  set bedroom_light to 20
  say "Good morning! Time to wake up."
end

when timer 1m
  set bedroom_light to 100
  set kitchen_light to 80
  say "Lights are up. Breakfast time!"
end
```

**What happens:**
- At start: bedroom light turns on at 20% cool white with a spoken notification.
- After 1 minute: bedroom goes to full brightness, kitchen comes on at 80%.

**Note:** The `when timer 1m` block fires every minute, not just once. If you want a one-shot sequence, stop the program after the first timer fires from the Applaa app.

**Devices used:** `bedroom_light` (Tier 1), `kitchen_light` (Tier 1)

---

## 3. Party Lights

Cycles through colours every 10 seconds across three rooms.

```appyscript
-- party.appy
-- Disco mode. Tier 1 only — no PIN needed.

when start
  set living_room to "purple"
  set kitchen_light to "cyan"
  set hallway_lamp to "pink"
  say "Party mode on!"
end

when timer 10s
  set living_room to "magenta"
  set kitchen_light to "lime"
  set hallway_lamp to "orange"
end

when timer 20s
  set living_room to "blue"
  set kitchen_light to "red"
  set hallway_lamp to "yellow"
end
```

**What happens:**
- Start: purple / cyan / pink.
- Every 10 seconds: magenta / lime / orange.
- Every 20 seconds: blue / red / yellow.

Because both timers run independently, after 20 seconds the 10-second timer fires twice and the 20-second timer fires once, creating an overlapping colour sequence.

**Devices used:** `living_room` (Tier 1), `kitchen_light` (Tier 1), `hallway_lamp` (Tier 1)

---

## 4. Study Mode

Sets focused, cool-white lighting for studying, with a reminder every 25 minutes (Pomodoro-style).

```appyscript
-- study.appy
-- 25-minute focus blocks with break reminders.

when start
  set desk_lamp to "cool"
  set desk_lamp to 90
  set bedroom_light to 40
  say "Focus mode on. Good luck!"
end

when timer 25m
  say "25 minutes done. Take a 5 minute break!"
  set desk_lamp to "warm"
  set desk_lamp to 60
end
```

**What happens:**
- Start: desk lamp to cool white at 90%, bedroom ambient at 40%.
- Every 25 minutes: a break reminder notification, desk lamp shifts to warm white at 60% to signal rest time.

**Devices used:** `desk_lamp` (Tier 1), `bedroom_light` (Tier 1)

---

## 5. Bedtime Alarm

Sends a bedtime warning 10 minutes before lights out, then turns everything off.

```appyscript
-- bedtime_alarm.appy
-- Activate at 9:50 PM for a 10:00 PM lights-out.

when start
  say "Bedtime in 10 minutes. Start wrapping up!"
  set living_room to "warm"
  set living_room to 40
end

when timer 10m
  say "Lights out! Time for bed."
  set living_room to "off"
  set kitchen_light to "off"
  set hallway_lamp to 5
  set bedroom_light to "warm"
  set bedroom_light to 10
end
```

**What happens:**
- Start: 10-minute warning notification, living room dims to warm 40%.
- After 10 minutes: lights-out notification, living room and kitchen off, hallway stays at 5% for safety, bedroom set to a very dim warm glow.

**Devices used:** `living_room` (Tier 1), `kitchen_light` (Tier 1), `hallway_lamp` (Tier 1), `bedroom_light` (Tier 1)

---

## 6. Room-by-Room Control

Sets each room in the house to a different scene at once, useful as a "reset to normal" program after a party or special mode.

```appyscript
-- reset_home.appy
-- Reset every room to a sensible default state.

when start
  -- Living room: bright and neutral
  set living_room to "white"
  set living_room to 80

  -- Kitchen: full brightness for cooking
  set kitchen_light to "cool"
  set kitchen_light to 100
  set kitchen_spot_1 to 100

  -- Bedroom: calm and warm
  set bedroom_light to "warm"
  set bedroom_light to 50

  -- Hallway: mid brightness
  set hallway_lamp to 60

  -- Desk: off (not in use)
  set desk_lamp to "off"

  say "Home reset to default settings."
end
```

**What happens:**
- Each room gets an independent colour and brightness setting in one `when start` block.
- All commands execute immediately and in order.
- A confirmation notification is sent when done.

**Devices used:** `living_room`, `kitchen_light`, `kitchen_spot_1`, `bedroom_light`, `hallway_lamp`, `desk_lamp` — all Tier 1.
