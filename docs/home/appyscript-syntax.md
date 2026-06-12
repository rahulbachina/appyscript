---
title: AppyScript Home Syntax
nav_order: 2
---

# AppyScript Home Syntax

This page is the complete language reference for AppyScript's `home` target. Everything here applies when you compile with `--target home`.

---

## Program Structure

An AppyScript home program is made up of one or more **event blocks**. Each block starts with `when <event>` and ends with `end`. Commands inside the block run when the event fires.

```appyscript
when start
  -- commands here run immediately when the program starts
end

when timer 30s
  -- commands here run every 30 seconds
end
```

Comments start with `--` and run to the end of the line.

---

## Supported Events

### `when start`

Fires once when the program is activated. Use this for setup — setting an initial state, playing a welcome sound, or sending a notification.

```appyscript
when start
  set living_room to "on"
  say "Program started."
end
```

### `when timer <duration>`

Fires repeatedly on an interval. Duration is a plain number followed by `s` (seconds) or `m` (minutes).

```appyscript
when timer 10s
  set kitchen_spot_1 to 50
end

when timer 5m
  say "Five minutes have passed."
end
```

The minimum interval is 5 seconds. Intervals shorter than 5 seconds are rejected at compile time.

---

## Commands

### `set <device> to <value>`

Sets a device to a state. The value can be:

- A **named colour** string: `"blue"`, `"warm"`, etc.
- A **brightness** number: any integer from `0` to `100`.
- An **on/off** string: `"on"` or `"off"`.

```appyscript
set bedroom_light to "blue"       -- named colour
set kitchen_light to 80            -- brightness (0-100)
set living_room to "off"           -- off
set hallway_lamp to "on"           -- on
```

All three value types are mutually exclusive per command. You cannot set brightness and colour in a single `set` statement — use separate commands if needed.

### `say <text>`

Delivers a text notification to the Applaa app and, if a speaker device is connected and in scope, speaks the text aloud.

```appyscript
say "Good evening!"
say "Time to wake up!"
```

Text must be a quoted string. Maximum length is 200 characters.

---

## Device Naming Convention

Device names in AppyScript are **slugged**: lowercase letters, digits, and underscores only. Spaces become underscores. All other characters are removed.

| Display Name | AppyScript Identifier |
|---|---|
| Bedroom Light | `bedroom_light` |
| Kitchen Spot 1 | `kitchen_spot_1` |
| Living Room | `living_room` |
| Front Door Lock | `front_door_lock` |
| Main Speaker | `main_speaker` |

Device names must match the slugged names registered in your Applaa Home device list. If a device name is not recognised at runtime, the command is skipped and a warning is logged.

---

## Colour Reference

The following named colours are supported in `set` statements. They map to specific hue/saturation values in the backend.

| Name | Description |
|------|-------------|
| `"red"` | Pure red |
| `"orange"` | Warm orange |
| `"yellow"` | Bright yellow |
| `"green"` | Mid green |
| `"blue"` | Mid blue |
| `"purple"` | Deep purple |
| `"pink"` | Soft pink |
| `"white"` | Neutral white |
| `"warm"` | Warm white (like incandescent) |
| `"cool"` | Cool white (like daylight) |
| `"cyan"` | Cyan / aqua |
| `"magenta"` | Magenta / fuchsia |
| `"lime"` | Bright lime green |
| `"teal"` | Teal / blue-green |

Unrecognised colour strings are rejected at compile time.

---

## Brightness Values

Brightness is a plain integer with no quotes, in the range `0` to `100`.

- `0` — off (equivalent to `"off"`)
- `1`–`10` — very dim
- `50` — half brightness
- `100` — full brightness

```appyscript
set desk_lamp to 30     -- dim reading light
set ceiling to 100      -- full brightness
set night_light to 5    -- barely on
```

Values outside `0`–`100` are rejected at compile time.

---

## Compiled Output: HomeProgram JSON

Running `appyscript compile home.appy --target home` produces a `HomeProgram` JSON object with three top-level keys:

```json
{
  "immediate": [
    { "device": "bedroom_light", "action": "set_state", "params": { "color": "blue" } }
  ],
  "notifications": [
    { "text": "Good evening!" }
  ],
  "automations": [
    {
      "id": "auto_0",
      "trigger": { "kind": "interval", "ms": 30000 },
      "commands": [
        { "device": "bedroom_light", "action": "set_state", "params": { "color": "warm" } }
      ],
      "notifications": []
    }
  ]
}
```

### `immediate`

Array of commands from `when start` blocks. Executed once when the program is activated.

Each entry: `{ "device": string, "action": "set_state", "params": { ... } }`

Params for colour: `{ "color": "<name>" }`
Params for brightness: `{ "brightness": <0-100> }`
Params for on/off: `{ "state": "on" | "off" }`

### `notifications`

Array of `say` commands from `when start` blocks. Delivered to the Applaa app immediately on activation.

Each entry: `{ "text": string }`

### `automations`

Array of timer-triggered blocks. Each automation has:

- `id` — unique string, auto-generated (`auto_0`, `auto_1`, ...)
- `trigger.kind` — `"interval"` for timer events
- `trigger.ms` — interval in milliseconds
- `commands` — array of device commands (same shape as `immediate`)
- `notifications` — array of `say` entries from inside the timer block

---

## Compile Command

```bash
appyscript compile home.appy --target home
```

Outputs the `HomeProgram` JSON to stdout. Pipe to a file:

```bash
appyscript compile home.appy --target home > home_program.json
```

Compile errors print to stderr and exit with code 1. Successful compilation exits with code 0.
