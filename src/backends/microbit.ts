// AppyScript → MicroPython (BBC micro:bit V2) — v3

import type { Program, Block, Statement, Trigger, SensorName } from '../ast'
import { BaseCodegen, MICROBIT_IMAGES } from '../codegen/base'
import type { HardwareProfile, GenerateResult } from '../plugins'

const MB_SENSORS: Record<SensorName, string> = {
  distance:'999', light:'display.read_light_level()', temperature:'temperature()',
  touch:'pin_logo.is_touched()', acceleration:'abs(accelerometer.get_z())',
}

class MicrobitCodegen extends BaseCodegen {
  protected sensorCall(s: SensorName) { return MB_SENSORS[s] ?? '0' }

  generate(program: Program, profile: HardwareProfile): GenerateResult {
    this.lines = []; this.indentLevel = 0; this.definedFunctions.clear()
    this.emitHeader(profile.name, profile.runtime)
    this.emit('from microbit import *')
    this.emit('import utime, random')
    this.emitBlank()

    const defines  = program.blocks.filter(b => b.kind === 'define')
    const whens    = program.blocks.filter(b => b.kind === 'when')
    const forevers = program.blocks.filter(b => b.kind === 'forever')
    const starts   = whens.filter(b => b.kind === 'when' && b.trigger.kind === 'start')
    const polls    = whens.filter(b => b.kind === 'when' && b.trigger.kind !== 'start')

    for (const b of defines) {
      if (b.kind !== 'define') continue
      this.definedFunctions.add(b.name)
      this.emit(`def ${b.name}():`, b.loc?.line)
      this.indent(); this.emitStatements(b.body); this.dedent(); this.emitBlank()
    }

    for (const b of starts) { if (b.kind === 'when') this.emitStatements(b.body) }

    if (polls.length > 0 || forevers.length > 0) {
      this.emit('while True:'); this.indent()
      for (const b of polls) {
        if (b.kind !== 'when') continue
        const cond = this.trigCond(b.trigger)
        if (!cond) continue
        this.emit(`if ${cond}:`, b.loc?.line); this.indent()
        this.emitStatements(b.body); this.dedent()
      }
      for (const b of forevers) { if (b.kind === 'forever') this.emitStatements(b.body) }
      this.emit('sleep(50)'); this.dedent()
    }
    return this.result()
  }

  private trigCond(t: any): string | null {
    switch (t.kind) {
      case 'button_a': return 'button_a.is_pressed()'
      case 'button_b': return 'button_b.is_pressed()'
      case 'shaken':   return 'accelerometer.is_gesture("shake")'
      case 'tilted':
        if (t.direction === 'left')  return 'accelerometer.is_gesture("left")'
        if (t.direction === 'right') return 'accelerometer.is_gesture("right")'
        return 'accelerometer.is_gesture("face up")'
      case 'sensor':   return `${this.sensorCall(t.sensor)} ${t.op} ${t.threshold}`
      default: return null
    }
  }

  private emitStatements(stmts: Statement[]) {
    if (stmts.length === 0) { this.emit('pass'); return }
    for (const s of stmts) this.emitStatement(s)
  }

  private emitStatement(stmt: Statement) {
    const loc = stmt.loc?.line
    switch (stmt.kind) {
      case 'move': {
        const duty = Math.round((stmt.speed ?? 50) * 10.23)
        this.emit(`pin0.write_analog(${duty})   # ${stmt.direction}`, loc)
        if (stmt.duration) { this.emit(`sleep(${this.durationMs(stmt.duration)})`); this.emit('pin0.write_analog(0)'); this.emit('pin1.write_analog(0)') }
        break
      }
      case 'turn':        this.emit(`# turn ${stmt.direction} ${stmt.degrees}°`, loc); break
      case 'stop':        this.emit('pin0.write_analog(0)', loc); this.emit('pin1.write_analog(0)'); break
      case 'say':         this.emit(`display.scroll(${this.emitStringValue(stmt.text)})`, loc); break
      case 'play':        this.emit(`audio.play(audio.SoundEffect(freq_start=440, freq_end=440, duration=500))`, loc); break
      case 'show':        this.emit(`display.show(${MICROBIT_IMAGES[stmt.expression] ?? 'Image.HAPPY'})`, loc); break
      case 'show_text':   this.emit(`display.scroll(${this.emitStringValue(stmt.text)})`, loc); break
      case 'show_number': this.emit(`display.scroll(str(${this.emitValue(stmt.value)}))`, loc); break
      case 'wait':        this.emit(`sleep(${this.durationMs(stmt.duration)})`, loc); break
      case 'send':        this.emit(`radio.send(str(${this.emitValue(stmt.message)}))`, loc); break
      case 'let':         this.emit(`${stmt.name} = ${this.emitValue(stmt.value)}`, loc); break
      case 'set':         this.emit(`${stmt.name} = ${this.emitValue(stmt.value)}`, loc); break
      case 'remember':    this.emit(`# remember — micro:bit uses RAM only`, loc); break
      case 'list_add':    this.emit(`${stmt.list}.append(${this.emitValue(stmt.value)})`, loc); break
      case 'do':          this.emit(this.definedFunctions.has(stmt.name) ? `${stmt.name}()` : `# Warning: '${stmt.name}' not defined`, loc); break
      case 'if':
        this.emit(`if ${this.emitCondition(stmt.condition)}:`, loc); this.indent()
        this.emitStatements(stmt.then); this.dedent()
        if (stmt.else) { this.emit('else:'); this.indent(); this.emitStatements(stmt.else); this.dedent() }
        break
      case 'repeat':
        this.emit(`for _i in range(${this.emitValue(stmt.count)}):`, loc)
        this.indent(); this.emitStatements(stmt.body); this.dedent(); break
      case 'while':
        this.emit(`while ${this.emitCondition(stmt.condition)}:`, loc); this.indent()
        this.emitStatements(stmt.body); this.emit('sleep(10)'); this.dedent(); break
    }
  }
}

export const microbitBackend = {
  targetId: 'microbit', name: 'BBC micro:bit V2 MicroPython Backend', version: '3.0.0',
  generate(p: Program, prof: HardwareProfile): GenerateResult { return new MicrobitCodegen().generate(p, prof) },
}

export function generateMicrobit(program: Program): string {
  return microbitBackend.generate(program, {
    id:'microbit', name:'BBC micro:bit V2', runtime:'MicroPython', description:'',
    sensors:{ distance:false, light:true, temperature:true, touch:true, acceleration:true },
    memory:{ flashKB:512, ramKB:128 }, supportsAsync:false, hasDisplay:true, hasRadio:true,
  }).code
}
