// AppyScript → Arduino C++ — v2
// Refactored to extend BaseCodegen.

import type { Program, Block, Statement, Trigger, Value, Condition, SensorName, Duration } from '../ast'
import { BaseCodegen } from '../codegen/base'
import type { HardwareProfile, GenerateResult } from '../plugins'

const ARDUINO_SENSORS: Record<SensorName, string> = {
  distance:     'robot.distance()',
  light:        'robot.light()',
  temperature:  'robot.temperature()',
  touch:        'robot.touch()',
  acceleration: 'robot.accelerationMagnitude()',
}

class ArduinoCodegen extends BaseCodegen {
  protected sensorCall(sensor: SensorName): string {
    return ARDUINO_SENSORS[sensor] ?? `robot.sensor_${sensor}()`
  }

  protected boolLiteral(v: boolean): string { return v ? 'true' : 'false' }
  protected notKeyword(): string  { return '!' }
  protected andKeyword(): string  { return '&&' }
  protected orKeyword(): string   { return '||' }

  generate(program: Program, profile: HardwareProfile): GenerateResult {
    this.lines = []; this.indentLevel = 0; this.definedFunctions.clear()

    const defines      = program.blocks.filter(b => b.kind === 'define')
    const whenBlocks   = program.blocks.filter(b => b.kind === 'when')
    const foreverBlocks = program.blocks.filter(b => b.kind === 'forever')
    const startBlocks  = whenBlocks.filter(b => b.kind === 'when' && b.trigger.kind === 'start')
    const nonStartWhen = whenBlocks.filter(b => b.kind === 'when' && b.trigger.kind !== 'start')

    this.emitCHeader(profile.name)
    this.emit('#include <AppyRobot.h>')
    this.emitBlank()
    this.emit('AppyRobot robot;')
    this.emitBlank()

    // Variable declarations (C++ requires forward-declarations of globals)
    // We emit them as extern — the user initialises them in setup()
    this.emit('// User variables — declared at global scope for loop() access')
    this.emit('// (AppyScript will generate these from your "let" statements)')
    this.emitBlank()

    // Forward declarations of user behaviours
    for (const block of defines) {
      if (block.kind === 'define') {
        this.emit(`void ${block.name}();`)
      }
    }
    if (defines.length > 0) this.emitBlank()

    // setup()
    this.emit('void setup() {', startBlocks[0]?.loc?.line)
    this.indent()
    this.emit('Serial.begin(115200);')
    this.emit('robot.begin();')
    for (const b of startBlocks) {
      if (b.kind !== 'when') continue
      for (const stmt of b.body) {
        const line = this.flatStatement(stmt)
        if (line) this.emit(line, stmt.loc?.line)
      }
    }
    this.dedent()
    this.emit('}')
    this.emitBlank()

    // loop()
    this.emit('void loop() {')
    this.indent()
    for (const block of nonStartWhen) {
      if (block.kind !== 'when') continue
      const cond = this.triggerCondition(block.trigger)
      if (!cond) continue
      this.emit(`if (${cond}) {`, block.loc?.line)
      this.indent()
      for (const stmt of block.body) {
        this.flatStatementEmit(stmt)
      }
      this.dedent()
      this.emit('}')
    }
    for (const block of foreverBlocks) {
      if (block.kind !== 'forever') continue
      for (const stmt of block.body) this.flatStatementEmit(stmt)
    }
    this.emit('delay(50);')
    this.dedent()
    this.emit('}')
    this.emitBlank()

    // User-defined behaviours as C functions
    for (const block of defines) {
      if (block.kind !== 'define') continue
      this.definedFunctions.add(block.name)
      this.emit(`void ${block.name}() {`, block.loc?.line)
      this.indent()
      for (const stmt of block.body) this.flatStatementEmit(stmt)
      this.dedent()
      this.emit('}')
      this.emitBlank()
    }

    return this.result()
  }

  private triggerCondition(trigger: Trigger): string | null {
    switch (trigger.kind) {
      case 'button_a':  return 'robot.buttonA()'
      case 'button_b':  return 'robot.buttonB()'
      case 'shaken':    return 'robot.shaken()'
      case 'tilted':    return 'robot.tilted()'
      case 'received':  return 'robot.radioReceived()'
      case 'sensor': {
        return `${this.sensorCall(trigger.sensor)} ${trigger.op} ${trigger.threshold}`
      }
      default: return null
    }
  }

  // For loop() and setup() we need single-line statements
  private flatStatementEmit(stmt: Statement) {
    const loc = stmt.loc?.line
    switch (stmt.kind) {
      case 'if': {
        this.emit(`if (${this.emitCondition(stmt.condition)}) {`, loc)
        this.indent()
        for (const s of stmt.then) this.flatStatementEmit(s)
        this.dedent()
        if (stmt.else) {
          this.emit('} else {')
          this.indent()
          for (const s of stmt.else) this.flatStatementEmit(s)
          this.dedent()
        }
        this.emit('}')
        return
      }
      case 'repeat': {
        this.emit(`for (int _i = 0; _i < ${this.emitValue(stmt.count)}; _i++) {`, loc)
        this.indent()
        for (const s of stmt.body) this.flatStatementEmit(s)
        this.dedent()
        this.emit('}')
        return
      }
      case 'while': {
        this.emit(`while (${this.emitCondition(stmt.condition)}) {`, loc)
        this.indent()
        for (const s of stmt.body) this.flatStatementEmit(s)
        this.emit('delay(10);')
        this.dedent()
        this.emit('}')
        return
      }
      default: {
        const line = this.flatStatement(stmt)
        if (line) this.emit(line, loc)
      }
    }
  }

  private flatStatement(stmt: Statement): string | null {
    switch (stmt.kind) {
      case 'move': {
        const speed = stmt.speed ?? 50
        const ms = stmt.duration ? this.durationMs(stmt.duration) : 0
        if (ms > 0) return `robot.move("${stmt.direction}", ${speed}); delay(${ms}); robot.stop();`
        return `robot.move("${stmt.direction}", ${speed});`
      }
      case 'turn':      return `robot.turn("${stmt.direction}", ${stmt.degrees});`
      case 'stop':      return 'robot.stop();'
      case 'say':       return `Serial.println(${JSON.stringify(stmt.text)}); robot.beep(440, 200);`
      case 'play':      return `robot.playSound(${JSON.stringify(stmt.sound)});`
      case 'show':      return `robot.showExpression(${JSON.stringify(stmt.expression)});`
      case 'show_text': return `robot.showText(${JSON.stringify(stmt.text)});`
      case 'show_number': return `robot.showNumber(${this.emitValue(stmt.value)});`
      case 'wait':      return `delay(${this.durationMs(stmt.duration)});`
      case 'send':      return `robot.radioSend(String(${this.emitValue(stmt.message)}));`
      case 'let':       return `int ${stmt.name} = ${this.emitValue(stmt.value)};`
      case 'set':       return `${stmt.name} = ${this.emitValue(stmt.value)};`
      case 'remember':  return `robot.eepromWrite(${JSON.stringify(stmt.name)}, ${stmt.name});`
      case 'do':        return `${stmt.name}();`
      default:          return null  // handled by flatStatementEmit
    }
  }
}

export const arduinoBackend = {
  targetId: 'arduino',
  name: 'Arduino C++ Backend',
  version: '2.0.0',
  generate(program: Program, profile: HardwareProfile): GenerateResult {
    return new ArduinoCodegen().generate(program, profile)
  },
}

/** @deprecated */
export function generateArduino(program: Program): string {
  return arduinoBackend.generate(program, {
    id: 'arduino', name: 'Arduino', runtime: 'C++',
    description: '', sensors: { distance: true, light: true, temperature: true, touch: true, acceleration: false },
    memory: { flashKB: 32, ramKB: 2 }, supportsAsync: false, hasDisplay: false, hasRadio: false,
  }).code
}
