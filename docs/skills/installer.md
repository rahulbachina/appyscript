---
title: Skills Installer
nav_order: 2
parent: Skills
---

# AppyScript Skills Installer

The `appyscript skills` CLI lets you browse the [Robotics Skills DB](https://github.com/rahulbachina/robotics-skills), install skills into your AI agent of choice, and scaffold new skills.

## Commands

### List available skills

```bash
appyscript skills list
```

Prints the full skill registry with name, cluster, version, and description. Pipe through `grep` to filter by cluster or keyword:

```bash
appyscript skills list | grep safety
```

### Install a skill

```bash
appyscript skills add <name> --agent claude|cursor|codex
```

**Examples:**

```bash
appyscript skills add pid-control --agent claude
appyscript skills add behavior-trees --agent cursor
appyscript skills add estop-architecture --agent codex
```

The `--agent` flag controls where the skill file is written. See the per-agent paths below.

## Per-Agent Install Paths

### Claude Code (`--agent claude`)

The skill is copied to Claude Code's global skills directory:

```
~/.claude/skills/<name>/SKILL.md
```

Claude Code picks up every file under `~/.claude/skills/` at session start. No further configuration is needed.

### Cursor (`--agent cursor`)

The skill is written as a Cursor rule file in the current project:

```
.cursor/rules/<name>.mdc
```

The installer converts the YAML frontmatter to Cursor's MDC format automatically. The `description` field becomes the rule description and `triggers` become the rule's glob/keyword activators.

Commit `.cursor/rules/` to version control to share the skills with your team.

### Codex (`--agent codex`)

Two things happen:

1. The skill file is copied to the current directory:
   ```
   ./<name>.SKILL.md
   ```
2. The skill's `name` and `description` are appended to `AGENTS.md` in the current directory (created if absent), so Codex discovers it through its standard agent file lookup.

## Creating Your Own Skill

A skill is a single Markdown file. The minimum required structure is:

```markdown
---
name: my-skill
version: 1.0.0
description: One sentence explaining what this skill teaches the agent.
triggers:
  - keyword one
  - keyword two
targets:
  - esp32
---

# My Skill

Write your instructions here as if briefing a senior engineer.
Include AppyScript code examples, wiring diagrams in ASCII,
hardware-specific limits, and anything the agent would otherwise
have to guess.

## Example

```appyscript
// example code block
```
```

### Frontmatter field reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | Lowercase, hyphen-separated. Must be unique in the registry. |
| `version` | string | yes | Semver (e.g. `1.0.0`). Bump the patch version for corrections, minor for new examples, major for breaking changes. |
| `description` | string | yes | Shown in `skills list`. Keep it under 100 characters. |
| `triggers` | list | yes | Keywords the agent matches against user prompts to auto-activate the skill. Be specific — broad triggers cause unwanted activations. |
| `targets` | list | no | Hardware platforms. Use the chip names from the DB clusters: `arduino-avr`, `esp32`, `m5stack`, `microbit`, `raspberry-pi-pico`. Omit for platform-agnostic skills. |
| `author` | string | no | Your GitHub username. |
| `license` | string | no | Defaults to `MIT`. |
| `cluster` | string | no | One of the cluster names from the Skills DB (chips, sensors, actuators, etc.). Required if you intend to submit to the registry. |

### Submitting to the Robotics Skills DB

1. Fork [github.com/rahulbachina/robotics-skills](https://github.com/rahulbachina/robotics-skills).
2. Add your skill file under the appropriate cluster directory: `skills/<cluster>/<name>/SKILL.md`.
3. Open a pull request. The CI checks frontmatter validity and runs a trigger uniqueness lint.
