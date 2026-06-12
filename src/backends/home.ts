// AppyScript → Home Automation (Applaa Home backend)
// Compiles AppyScript to a JSON plan of device commands + automations.
// The Applaa Builder runtime executes each command through GuardrailLayer.

import type { Program, Block, Statement, Value, Duration, Trigger } from '../ast'
import type { HardwareProfile, GenerateResult } from '../plugins'

// ── Output types (also consumed by Applaa Builder) ───────────────────────────

export interface HomeDeviceCommand {
  device: string          // AppyScript variable name, e.g. "bedroom_light"
  action: 'set_state'
  params: {
    on?: boolean
    brightness?: number   // 0–100
    color?: string        // named colour or hex
  }
}

export interface HomeNotification {
  text: string
}

export interface HomeAutomation {
  id: string
  trigger:
    | { kind: 'start' }
    | { kind: 'interval'; ms: number }
  commands: HomeDeviceCommand[]
  notifications: HomeNotification[]
}

export interface HomeProgram {
  /** Commands to execute immediately when the program runs */
  immediate: HomeDeviceCommand[]
  /** Text/speech notifications that accompany immediate commands */
  notifications: HomeNotification[]
  /** Automations with triggers (interval, etc.) */
  automations: HomeAutomation[]
}

// ── Colour names AppyScript recognises ───────────────────────────────────────

const NAMED_COLOURS = new Set([
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white',
  'warm', 'cool', 'cyan', 'magenta', 'lime', 'teal',
])

// ── Statement → commands ──────────────────────────────────────────────────────

function valueToDeviceParams(value: Value): HomeDeviceCommand['params'] | null {
  if (value.kind === 'bool') {
    return { on: value.value }
  }
  if (value.kind === 'string') {
    const v = value.value.toLowerCase()
    if (v === 'on')  return { on: true }
    if (v === 'off') return { on: false }
    if (NAMED_COLOURS.has(v)) return { color: v }
    if (/^#[0-9a-f]{3,6}$/i.test(v)) return { color: v }
  }
  if (value.kind === 'number') {
    // Treat plain numbers as brightness %. Clamp to 0-100.
    const pct = Math.min(100, Math.max(0, value.value))
    return { brightness: pct }
  }
  return null
}

function statementsToOutput(
  stmts: Statement[],
  cmds: HomeDeviceCommand[],
  notes: HomeNotification[],
) {
  for (const stmt of stmts) {
    if (stmt.kind === 'set') {
      const params = valueToDeviceParams(stmt.value)
      if (params) cmds.push({ device: stmt.name, action: 'set_state', params })
    } else if (stmt.kind === 'say') {
      notes.push({ text: stmt.text })
    } else if (stmt.kind === 'if') {
      // Flatten if-branch into immediate — home has no runtime conditions
      statementsToOutput(stmt.then, cmds, notes)
      if (stmt.else) statementsToOutput(stmt.else, cmds, notes)
    } else if (stmt.kind === 'repeat') {
      statementsToOutput(stmt.body, cmds, notes)
    }
    // move/turn/stop/show/wait → robot ops, silently ignored in home context
  }
}

function durationToMs(d: Duration): number {
  if (d.unit === 'ms') return d.value
  if (d.unit === 's')  return d.value * 1000
  if (d.unit === 'm')  return d.value * 60_000
  return d.value * 1000
}

// ── Main backend ──────────────────────────────────────────────────────────────

export function generateHome(program: Program, _profile: HardwareProfile): GenerateResult {
  const result: HomeProgram = { immediate: [], notifications: [], automations: [] }
  let autoIndex = 0

  for (const block of program.blocks) {
    if (block.kind === 'when') {
      const trigger: Trigger = block.trigger

      if (trigger.kind === 'start') {
        // when start → run immediately
        statementsToOutput(block.body, result.immediate, result.notifications)

      } else if (trigger.kind === 'timer') {
        // when timer 5s → repeating automation
        const cmds: HomeDeviceCommand[] = []
        const notes: HomeNotification[] = []
        statementsToOutput(block.body, cmds, notes)
        result.automations.push({
          id: `auto_${autoIndex++}`,
          trigger: { kind: 'interval', ms: durationToMs(trigger.interval) },
          commands: cmds,
          notifications: notes,
        })

      } else {
        // button / sensor / etc → not applicable in home; treat as immediate
        statementsToOutput(block.body, result.immediate, result.notifications)
      }

    } else if (block.kind === 'forever') {
      // forever → repeating automation at 1-minute intervals by default
      const cmds: HomeDeviceCommand[] = []
      const notes: HomeNotification[] = []
      statementsToOutput(block.body, cmds, notes)
      result.automations.push({
        id: `auto_${autoIndex++}`,
        trigger: { kind: 'interval', ms: 60_000 },
        commands: cmds,
        notifications: notes,
      })

    } else if (block.kind === 'define') {
      // function definitions are ignored in home context
    }
  }

  return { code: JSON.stringify(result, null, 2) }
}

export const homeBackend = {
  targetId: 'home',
  name: 'Applaa Home',
  version: '1.0.0',
  generate: generateHome,
}
