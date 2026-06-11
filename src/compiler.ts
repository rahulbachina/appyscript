// AppyScript Compiler — main entry point
// compile(source, target) → { code, errors }

import { tokenize, LexError } from './lexer'
import { parse, ParseError } from './parser'
import { generateESP32 } from './backends/esp32'
import { generateArduino } from './backends/arduino'
import { generateMicrobit } from './backends/microbit'

export type Target = 'esp32' | 'arduino' | 'pico' | 'microbit'

export interface CompileResult {
  ok: boolean
  code?: string
  errors?: CompileError[]
}

export interface CompileError {
  message: string
  line?: number
  col?: number
}

export interface TargetInfo {
  id: Target
  name: string
  runtime: string
  description: string
}

export const TARGETS: TargetInfo[] = [
  {
    id: 'esp32',
    name: 'ESP32 / M5Stack',
    runtime: 'MicroPython',
    description: 'M5Stack Core S3 SE, ESP32-S3 dev boards. WiFi + display + speaker built in.',
  },
  {
    id: 'arduino',
    name: 'Arduino',
    runtime: 'C++',
    description: 'Arduino Uno, Nano, Mega. Most common beginner robotics boards globally.',
  },
  {
    id: 'pico',
    name: 'Raspberry Pi Pico W',
    runtime: 'MicroPython',
    description: 'RP2040 dual-core. WiFi. £4 chip. Popular in UK schools.',
  },
  {
    id: 'microbit',
    name: 'BBC micro:bit V2',
    runtime: 'MicroPython',
    description: '5×5 LED matrix, 2 buttons, accelerometer. Used by 5M+ UK students.',
  },
]

export const KEYWORDS = [
  'when', 'on', 'forever', 'define', 'do',
  'if', 'else', 'repeat', 'times', 'while', 'until',
  'and', 'or', 'not', 'let', 'set', 'to', 'remember',
  'move', 'turn', 'spin', 'stop', 'say', 'play', 'show', 'wait', 'send',
  'forward', 'backward', 'back', 'left', 'right',
  'at', 'for', 'full', 'slow', 'fast', 'half',
  'button_a', 'button_b', 'shaken', 'tilted', 'start', 'timer', 'received',
  'distance', 'light', 'temperature', 'touch', 'acceleration',
  'happy', 'sad', 'thinking', 'excited', 'angry', 'alert', 'sleep', 'calm', 'confused', 'dizzy',
  'yes', 'no', 'true', 'false',
]

export function compile(source: string, target: Target): CompileResult {
  try {
    const tokens = tokenize(source)
    const ast = parse(tokens)

    let code: string
    switch (target) {
      case 'esp32': code = generateESP32(ast); break
      case 'arduino': code = generateArduino(ast); break
      case 'microbit': code = generateMicrobit(ast); break
      case 'pico':
        // Pico uses the same MicroPython structure as ESP32 with different prelude imports
        code = generateESP32(ast).replace(
          /from applaa_robot import Robot, wait_ms/,
          'from applaa_robot_pico import Robot, wait_ms'
        )
        break
    }

    return { ok: true, code }
  } catch (err) {
    if (err instanceof LexError || err instanceof ParseError) {
      return {
        ok: false,
        errors: [{ message: err.message, line: err.line, col: err.col }],
      }
    }
    return {
      ok: false,
      errors: [{ message: String(err) }],
    }
  }
}

export function validate(source: string): { valid: boolean; errors: CompileError[] } {
  const result = compile(source, 'esp32')
  return { valid: result.ok, errors: result.errors ?? [] }
}

export function explain(source: string): string {
  try {
    const tokens = tokenize(source)
    const ast = parse(tokens)
    const lines: string[] = []

    for (const block of ast.blocks) {
      if (block.kind === 'when') {
        lines.push(`• When ${describeTrigger(block.trigger)}: runs ${block.body.length} action(s)`)
      } else if (block.kind === 'forever') {
        lines.push(`• Runs forever: loops ${block.body.length} action(s) continuously`)
      } else if (block.kind === 'define') {
        lines.push(`• Custom behaviour "${block.name}": ${block.body.length} action(s)`)
      }
    }

    return lines.join('\n') || 'Empty program'
  } catch {
    return 'Could not explain — program has errors'
  }
}

function describeTrigger(trigger: { kind: string; [key: string]: unknown }): string {
  switch (trigger.kind) {
    case 'button_a': return 'Button A is pressed'
    case 'button_b': return 'Button B is pressed'
    case 'shaken': return 'the robot is shaken'
    case 'tilted': return 'the robot is tilted'
    case 'start': return 'the program starts'
    case 'timer': return `a timer fires`
    case 'received': return 'a wireless message is received'
    case 'sensor': {
      const s = trigger as { sensor: string; op: string; threshold: number; unit?: string }
      return `${s.sensor} ${s.op} ${s.threshold}${s.unit ?? ''}`
    }
    default: return trigger.kind
  }
}
