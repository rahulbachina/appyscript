// AppyScript → CircuitPython (Adafruit boards — Circuit Playground, CLUE, PyBadge)
// CircuitPython uses `import board`, `import time`, `import digitalio` etc.
// No asyncio — simple polling loop like micro:bit.

import type { Program, Block, Statement, Trigger, SensorName, FaceExpression } from '../ast'
import { BaseCodegen, MICROBIT_IMAGES } from '../codegen/base'
import type { HardwareProfile, GenerateResult } from '../plugins'

const CP_SENSORS: Record<SensorName, string> = {
  distance:     '0',                                 // needs external HC-SR04
  light:        'cp.light',                          // Circuit Playground built-in
  temperature:  'cp.temperature',
  touch:        'cp.touch_A1',                       // capacitive touch pad
  acceleration: 'abs(cp.acceleration[2])',           // Z-axis
}

// Circuit Playground Bluefruit pixel colours for expressions
const CP_PIXELS: Record<FaceExpression, string> = {
  happy:    '(0, 255, 0)',     // green
  sad:      '(0, 0, 255)',     // blue
  thinking: '(128, 0, 128)',  // purple
  excited:  '(255, 165, 0)',  // orange
  angry:    '(255, 0, 0)',     // red
  alert:    '(255, 255, 0)',   // yellow
  sleep:    '(0, 0, 16)',      // dim blue
  calm:     '(0, 128, 128)',   // teal
  confused: '(255, 20, 147)', // deep pink
  dizzy:    '(255, 255, 255)', // white
}

class CircuitPythonCodegen extends BaseCodegen {
  protected sensorCall(sensor: SensorName): string {
    return CP_SENSORS[sensor] ?? '0'
  }

  generate(program: Program, profile: HardwareProfile): GenerateResult {
    this.lines = []; this.indentLevel = 0; this.definedFunctions.clear()

    this.emitHeader(profile.name, profile.runtime)
    this.emit('import time')
    this.emit('import board')
    this.emit('import digitalio')
    this.emit('from adafruit_circuitplayground import cp')
    this.emitBlank()
    this.emit('# AppyScript robot interface for Circuit Playground')
    this.emitBlank()

    const defines      = program.blocks.filter(b => b.kind === 'define')
    const whenBlocks   = program.blocks.filter(b => b.kind === 'when')
    const foreverBlocks = program.blocks.filter(b => b.kind === 'forever')
    const startBlocks  = whenBlocks.filter(b => b.kind === 'when' && b.trigger.kind === 'start')
    const pollBlocks   = whenBlocks.filter(b => b.kind === 'when' && b.trigger.kind !== 'start')

    for (const block of defines) {
      if (block.kind !== 'define') continue
      this.definedFunctions.add(block.name)
      this.emit(`def ${block.name}():`, block.loc?.line)
      this.indent()
      this.emitStatements(block.body)
      this.dedent()
      this.emitBlank()
    }

    for (const b of startBlocks) {
      if (b.kind === 'when') this.emitStatements(b.body)
    }

    if (pollBlocks.length > 0 || foreverBlocks.length > 0) {
      this.emit('while True:')
      this.indent()

      for (const block of pollBlocks) {
        if (block.kind !== 'when') continue
        const cond = this.triggerCondition(block.trigger)
        if (!cond) continue
        this.emit(`if ${cond}:`, block.loc?.line)
        this.indent()
        this.emitStatements(block.body)
        this.dedent()
      }

      for (const block of foreverBlocks) {
        if (block.kind !== 'forever') continue
        this.emitStatements(block.body)
      }

      this.emit('time.sleep(0.05)')
      this.dedent()
    }

    return this.result()
  }

  private triggerCondition(trigger: Trigger): string | null {
    switch (trigger.kind) {
      case 'button_a':  return 'cp.button_a'
      case 'button_b':  return 'cp.button_b'
      case 'shaken':    return 'cp.shake(shake_threshold=20)'
      case 'tilted':    return 'abs(cp.acceleration[0]) > 5'
      case 'received':  return 'False  # radio requires BLE setup'
      case 'sensor':
        return `${this.sensorCall(trigger.sensor)} ${trigger.op} ${trigger.threshold}`
      default: return null
    }
  }

  private emitStatements(stmts: Statement[]) {
    if (stmts.length === 0) { this.emit('pass'); return }
    for (const stmt of stmts) this.emitStatement(stmt)
  }

  private emitStatement(stmt: Statement) {
    const loc = stmt.loc?.line
    switch (stmt.kind) {
      case 'move':
        // Circuit Playground has no motors built-in; assume DC motors via PWM
        this.emit(`# move ${stmt.direction} at ${stmt.speed ?? 50}%`, loc)
        this.emit(`# Connect motors to A1/A2 with a motor driver`)
        break
      case 'turn':
        this.emit(`# turn ${stmt.direction} ${stmt.degrees}°`, loc)
        break
      case 'stop':
        this.emit('# stop motors', loc)
        break
      case 'say':
        // Circuit Playground: print to serial + beep
        this.emit(`print(${JSON.stringify(stmt.text)})`, loc)
        this.emit('cp.play_tone(440, 0.2)')
        break
      case 'play':
        this.emit(`# play "${stmt.sound}"`, loc)
        this.emit('cp.play_tone(440, 0.5)')
        break
      case 'show': {
        const colour = CP_PIXELS[stmt.expression] ?? '(0, 255, 0)'
        this.emit(`cp.pixels.fill(${colour})   # ${stmt.expression}`, loc)
        break
      }
      case 'show_text':
        this.emit(`print(${JSON.stringify(stmt.text)})`, loc)
        break
      case 'show_number':
        this.emit(`print(${this.emitValue(stmt.value)})`, loc)
        break
      case 'wait':
        this.emit(`time.sleep(${this.durationMs(stmt.duration) / 1000})`, loc)
        break
      case 'let':
        this.emit(`${stmt.name} = ${this.emitValue(stmt.value)}`, loc)
        break
      case 'set':
        this.emit(`${stmt.name} = ${this.emitValue(stmt.value)}`, loc)
        break
      case 'save': this.emit(`# save ${stmt.name} — use storage module`, loc); break
      case 'load': this.emit(`# load ${stmt.name} — use storage module`, loc); break
      case 'remember':
        this.emit(`# remember — use storage module for persistence`, loc)
        this.emit(`# import storage; storage.getmount("/").readonly = False`)
        break
      case 'send':
        this.emit(`# send — BLE radio not yet configured`, loc)
        break
      case 'do':
        this.emit(this.definedFunctions.has(stmt.name) ? `${stmt.name}()` : `# Warning: '${stmt.name}' not defined`, loc)
        break
      case 'if':
        this.emit(`if ${this.emitCondition(stmt.condition)}:`, loc)
        this.indent(); this.emitStatements(stmt.then); this.dedent()
        if (stmt.else) {
          this.emit('else:')
          this.indent(); this.emitStatements(stmt.else); this.dedent()
        }
        break
      case 'repeat':
        this.emit(`for _i in range(${this.emitValue(stmt.count)}):`, loc)
        this.indent(); this.emitStatements(stmt.body); this.dedent()
        break
      case 'while':
        this.emit(`while ${this.emitCondition(stmt.condition)}:`, loc)
        this.indent()
        this.emitStatements(stmt.body)
        this.emit('time.sleep(0.01)')
        this.dedent()
        break
    }
  }
}

export const circuitpythonBackend = {
  targetId: 'circuitpython',
  name: 'CircuitPython (Adafruit) Backend',
  version: '1.0.0',
  generate(program: Program, profile: HardwareProfile): GenerateResult {
    return new CircuitPythonCodegen().generate(program, profile)
  },
}
