// AppyScript → MicroPython (Raspberry Pi Pico W) — v3

import type { Program, Block, Statement, Trigger, SensorName } from '../ast'
import { BaseCodegen } from '../codegen/base'
import type { HardwareProfile, GenerateResult } from '../plugins'

const PICO_SENSORS: Record<SensorName, string> = {
  distance:'robot.sensor.distance()', light:'robot.sensor.ldr()',
  temperature:'robot.sensor.temperature()', touch:'robot.sensor.touch()', acceleration:'0',
}

class PicoCodegen extends BaseCodegen {
  protected sensorCall(s: SensorName) { return PICO_SENSORS[s] ?? `robot.sensor.${s}()` }

  generate(program: Program, profile: HardwareProfile): GenerateResult {
    this.lines = []; this.indentLevel = 0; this.definedFunctions.clear()
    this.emitHeader(profile.name, profile.runtime)
    this.emit('from applaa_robot_pico import Robot, wait_ms')
    this.emit('import uasyncio as asyncio')
    this.emit('from machine import Pin, PWM, ADC')
    this.emit('import random')
    this.emitBlank()
    this.emit('robot = Robot()')
    this.emitBlank()

    const defines  = program.blocks.filter(b => b.kind === 'define')
    const whens    = program.blocks.filter(b => b.kind === 'when')
    const forevers = program.blocks.filter(b => b.kind === 'forever')

    for (const b of defines) {
      if (b.kind !== 'define') continue
      this.definedFunctions.add(b.name)
      this.emit(`def ${b.name}():`, b.loc?.line)
      this.indent(); this.emitStatements(b.body); this.dedent(); this.emitBlank()
    }

    for (const b of whens) { if (b.kind === 'when') this.emitWhenHandler(b) }

    for (const b of forevers) {
      if (b.kind !== 'forever') continue
      this.emit('async def _forever_loop():', b.loc?.line)
      this.indent(); this.emit('while True:'); this.indent()
      this.emitStatements(b.body); this.emit('await asyncio.sleep_ms(10)')
      this.dedent(); this.dedent(); this.emitBlank()
    }

    this.emit('async def main():')
    this.indent(); this.emit('tasks = []')
    for (const b of whens) {
      if (b.kind === 'when') this.emit(`tasks.append(asyncio.create_task(_handler_${this.trigName(b.trigger)}()))`)
    }
    if (forevers.length > 0) this.emit('tasks.append(asyncio.create_task(_forever_loop()))')
    this.emit('await asyncio.gather(*tasks)')
    this.dedent(); this.emitBlank(); this.emit('asyncio.run(main())')
    return this.result()
  }

  private emitWhenHandler(b: Extract<Block, { kind:'when' }>) {
    const name = this.trigName(b.trigger)
    this.emit(`async def _handler_${name}():`, b.loc?.line)
    this.indent()
    const { condition, interval } = this.trigToPolling(b.trigger)
    if (condition) {
      this.emit('while True:'); this.indent()
      if (interval) {
        this.emitStatements(b.body); this.emit(`await asyncio.sleep_ms(${interval})`)
      } else {
        this.emit(`if ${condition}:`); this.indent()
        this.emitStatements(b.body); this.dedent()
        this.emit('await asyncio.sleep_ms(50)')
      }
      this.dedent()
    } else { this.emitStatements(b.body) }
    this.dedent(); this.emitBlank()
  }

  private trigName(t: any): string {
    switch (t.kind) {
      case 'button_a': return 'button_a'; case 'button_b': return 'button_b'
      case 'shaken': return 'shaken'; case 'tilted': return `tilted${t.direction ? '_' + t.direction : ''}`
      case 'start': return 'start'; case 'timer': return `timer_${this.durationMs(t.interval)}ms`
      case 'received': return 'received'; case 'sensor': return `sensor_${t.sensor}`
      default: return 'unknown'
    }
  }

  private trigToPolling(t: any): { condition?: string; interval?: number } {
    switch (t.kind) {
      case 'button_a': return { condition: 'robot.button_a.value() == 0' }
      case 'button_b': return { condition: 'robot.button_b.value() == 0' }
      case 'shaken':   return { condition: 'robot.sensor.shaken()' }
      case 'tilted':   return { condition: 'robot.sensor.tilted()' }
      case 'start':    return {}
      case 'timer':    return { condition: 'True', interval: this.durationMs(t.interval) }
      case 'received': return { condition: 'robot.radio.received()' }
      case 'sensor':   return { condition: `${this.sensorCall(t.sensor)} ${t.op} ${t.threshold}` }
      default:         return {}
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
        const sp = stmt.speed ?? 50, ms = stmt.duration ? this.durationMs(stmt.duration) : 0
        const duty = Math.round(sp * 655.35)
        this.emit(`robot.drive(direction="${stmt.direction}", duty=${duty})`, loc)
        if (ms > 0) { this.emit(`await asyncio.sleep_ms(${ms})`); this.emit('robot.stop()') }
        break
      }
      case 'turn':        this.emit(`robot.turn(direction="${stmt.direction}", degrees=${stmt.degrees})`, loc); break
      case 'stop':        this.emit('robot.stop()', loc); break
      case 'say':         this.emit(`print(${this.emitStringValue(stmt.text)})`, loc); break
      case 'play':        this.emit(`robot.buzzer.play(${JSON.stringify(stmt.sound)})`, loc); break
      case 'show':        this.emit(`print("expression: ${stmt.expression}")`, loc); break
      case 'show_text':   this.emit(`print(${this.emitStringValue(stmt.text)})`, loc); break
      case 'show_number': this.emit(`print(${this.emitValue(stmt.value)})`, loc); break
      case 'wait':        this.emit(`await asyncio.sleep_ms(${this.durationMs(stmt.duration)})`, loc); break
      case 'send':        this.emit(`robot.radio.send(str(${this.emitValue(stmt.message)}))`, loc); break
      case 'let':         this.emit(`${stmt.name} = ${this.emitValue(stmt.value)}`, loc); break
      case 'set':         this.emit(`${stmt.name} = ${this.emitValue(stmt.value)}`, loc); break
      case 'save': this.emit(`robot.nvm.save(${JSON.stringify(stmt.name)}, ${stmt.name})`, loc); break
      case 'load': this.emit(`${stmt.name} = robot.nvm.load(${JSON.stringify(stmt.name)}, 0)`, loc); break
      case 'remember':    this.emit(`robot.nvm.save(${JSON.stringify(stmt.name)}, ${stmt.name})`, loc); break
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
        this.emitStatements(stmt.body); this.emit('await asyncio.sleep_ms(10)'); this.dedent(); break
    }
  }
}

export const picoBackend = {
  targetId: 'pico', name: 'Raspberry Pi Pico W MicroPython Backend', version: '3.0.0',
  generate(p: Program, prof: HardwareProfile): GenerateResult { return new PicoCodegen().generate(p, prof) },
}

export function generatePico(program: Program): string {
  return picoBackend.generate(program, {
    id:'pico', name:'Raspberry Pi Pico W', runtime:'MicroPython', description:'',
    sensors:{ distance:true, light:true, temperature:true, touch:true, acceleration:false },
    memory:{ flashKB:2048, ramKB:264 }, supportsAsync:true, hasDisplay:false, hasRadio:true,
  }).code
}
