---
title: Applaa Home
nav_order: 1
---

# Applaa Home

## What Is Applaa Home?

Applaa Home lets kids write real code that controls real devices in their home — lights, speakers, cameras, thermostats, and more. Programs are written in AppyScript, compiled to a `HomeProgram` JSON structure, and executed by the Applaa Home backend.

The backend translates AppyScript commands into device-specific API calls (Philips Hue, Tesla, smart locks, etc.) via a local MCP server running on the home network.

---

## The "Home Is a Robot" Thesis

Most smart home tools treat the home as a settings panel — you tap a button and a light turns on. Applaa Home treats the home as a programmable robot.

A robot has:
- **State** — what devices are currently doing
- **Triggers** — events that make it act (startup, timers, voice)
- **Actions** — things it does in response (set a light, play a sound, speak)

AppyScript maps directly onto this model:

```appyscript
when start
  set bedroom_light to "blue"
  say "Good morning!"
end

when timer 30s
  set bedroom_light to "warm"
end
```

This is not a metaphor. The compiled output is a `HomeProgram` that the backend interprets as event-driven automation — the same mental model as a robot control loop.

The goal is for a child to write a 10-line AppyScript program and have it physically change their environment within seconds. The home becomes the output device.

---

## Safety Architecture

Applaa Home uses a three-tier safety model. Every device in the system is assigned a tier. The tier determines who can control it and how.

### Tier 1 — Play

**Devices:** lights, speakers

Kids can control these freely with no parent approval required. A rate limit of 10 commands per minute per device prevents runaway loops from flickering lights or blasting audio.

### Tier 2 — Family

**Devices:** cameras (view only), thermostat, Tesla (read-only telemetry)

A parent PIN is required once per grant session. After a parent approves, the child's program can interact with these devices until the session ends or the parent revokes access.

### Tier 3 — Guarded

**Devices:** locks, alarm system, Tesla commands (unlock, drive, climate control)

A parent PIN is required **per action**, not per session. Only a parent account can initiate Tier 3 commands. Child programs that reference Tier 3 devices will compile successfully but will be blocked at execution time unless a parent is present and confirms each action.

### Summary Table

| Tier | Devices | Who Can Use | Auth Required |
|------|---------|-------------|---------------|
| 1 — Play | Lights, speakers | Kids | None (rate-limited) |
| 2 — Family | Cameras (view), thermostat, Tesla read | Kids + parents | Parent PIN once per grant |
| 3 — Guarded | Locks, alarm, Tesla commands | Parents only | Parent PIN per action |

---

## How a Program Runs

1. A `.appy` file is written in Applaa Builder or the AppyScript editor.
2. `appyscript compile home.appy --target home` produces a `HomeProgram` JSON object.
3. The Applaa Home backend (local MCP server) receives the `HomeProgram`.
4. `immediate` commands execute at once.
5. `notifications` are delivered to the device running Applaa.
6. `automations` are registered as recurring triggers (timers, etc.) and run for as long as the program is active.

See [AppyScript Syntax](appyscript-syntax.md) for the full language reference, and [Examples](examples.md) for complete working programs.
