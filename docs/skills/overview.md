---
title: Skills Overview
nav_order: 1
parent: Skills
---

# AppyScript Skills Overview

Skills are portable, agent-readable instruction files that teach AI coding agents how to work with specific robotics hardware, algorithms, and AppyScript patterns. They follow the **Open Agent Skills** format — a plain Markdown file with a YAML frontmatter header — so they work identically across Claude Code, Cursor, Codex, and any other agent that reads instruction files.

## What a Skill Is

A skill is a single `SKILL.md` file that an AI agent loads as a system-level instruction. It contains:

- A description of the domain (e.g. "PID control for motor speed")
- AppyScript syntax examples for that domain
- Hardware-specific gotchas, wiring notes, and safe defaults
- Trigger conditions that tell the agent when to apply the skill automatically

Because skills are plain Markdown, you can read, edit, and version-control them like any other source file.

## Open Agent Skills Format

Every skill file starts with a YAML frontmatter block:

```yaml
---
name: pid-control
version: 1.0.0
description: PID controller implementation for motor and servo control in AppyScript
triggers:
  - pid
  - motor speed
  - proportional integral derivative
targets:
  - arduino-avr
  - esp32
  - raspberry-pi-pico
author: rahulbachina
license: MIT
---
```

| Field | Required | Purpose |
|-------|----------|---------| 
| `name` | yes | Unique identifier, used in CLI commands |
| `version` | yes | Semver string |
| `description` | yes | One-line summary shown in `skills list` |
| `triggers` | yes | Keywords that activate the skill automatically |
| `targets` | no | Hardware platforms this skill applies to |
| `author` | no | GitHub username |
| `license` | no | Defaults to MIT |

Everything after the frontmatter is free-form Markdown. Write it as if you are briefing a senior engineer who has never touched your hardware before.

## The Robotics Skills DB

The canonical skill registry lives at **[github.com/rahulbachina/robotics-skills](https://github.com/rahulbachina/robotics-skills)** and currently contains 62 community-maintained skills organised into the following clusters:

| Cluster | Skills |
|---------|--------|
| **chips** | arduino-avr, esp32, m5stack, microbit, raspberry-pi-pico |
| **sensors** | distance, IMU, colour, touch, gas, light, temperature |
| **actuators** | servo, DC motor, stepper, solenoid, pneumatic |
| **displays** | OLED, TFT, LED matrix, e-ink |
| **comms** | BLE, Wi-Fi, MQTT, I2C, SPI, UART |
| **algorithms** | pid-control, differential-drive, obstacle-state-machines |
| **appyscript** | core syntax, loops, events, functions |
| **product** | project scaffolding, README templates |
| **meta** | multi-skill composition, skill authoring |
| **perception** | slam, camera-vision, lidar, sensor-fusion |
| **navigation** | path planning, waypoints, map building |
| **control** | motion profiles, trajectory tracking |
| **behavior** | behavior-trees, task-planning |
| **ai-ml** | on-device inference, gesture recognition |
| **ros2** | nodes, topics, services, launch files |
| **safety** | collision-avoidance, estop-architecture, guardrails-ai-robots |
| **diagnostics** | logging, health checks, telemetry |
| **hardware-pro** | advanced PCB integration, custom shields |

## How AI Agents Use Skills

When a skill is installed for an agent, it is placed in the agent's native instruction path. The agent reads it at session start and uses the trigger keywords to decide when to apply it.

**Example flow for Claude Code + pid-control:**

1. You install the skill: `appyscript skills add pid-control --agent claude`
2. Claude Code loads `~/.claude/skills/pid-control/SKILL.md` on startup.
3. You ask: *"make the robot hold 200 RPM"*
4. Claude detects the trigger keyword `motor speed`, activates the PID skill, and generates correct AppyScript with tuned Kp/Ki/Kd defaults for your target chip.

Skills do not execute code. They are read-only instructions that shift the agent's output toward correct, hardware-safe AppyScript without you having to repeat context in every prompt.
