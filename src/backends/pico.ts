// AppyScript → Raspberry Pi Pico W MicroPython — v5

import type { Program, Block, Statement, Trigger, SensorName } from '../ast'
import { BaseCodegen } from '../codegen/base'
import type { HardwareProfile, GenerateResult } from '../plugins'

const S: Record<SensorName,string> = {
  distance:'robot.sensor.distance()', light:'robot.sensor.ldr()',
  temperature:'robot.sensor.temperature()', touch:'robot.sensor.touch()', acceleration:'0',
}

class Gen extends BaseCodegen {
  protected sensorCall(s: SensorName) { return S[s] }

  generate(program: Program, profile: HardwareProfile): GenerateResult {
    this.lines=[]; this.indentLevel=0; this.definedFunctions.clear()
    this.emitHeader(profile.name, profile.runtime)
    this.emit('from applaa_robot_pico import Robot')
    this.emit('import uasyncio as asyncio, random')
    this.emit('from machine import Pin, PWM, ADC')
    this.emitBlank(); this.emit('robot = Robot()'); this.emitBlank()

    const defines  = program.blocks.filter(b=>b.kind==='define')
    const whens    = program.blocks.filter(b=>b.kind==='when')
    const forevers = program.blocks.filter(b=>b.kind==='forever')

    for (const b of defines) {
      if (b.kind!=='define') continue
      this.definedFunctions.add(b.name)
      this.emit(`def ${b.name}():`,b.loc?.line); this.indent(); this.stmts(b.body); this.dedent(); this.emitBlank()
    }
    for (const b of whens) { if (b.kind==='when') this.handler(b) }
    for (const b of forevers) {
      if (b.kind!=='forever') continue
      this.emit('async def _forever_loop():', b.loc?.line); this.indent()
      this.emit('while True:'); this.indent(); this.stmts(b.body); this.emit('await asyncio.sleep_ms(10)')
      this.dedent(); this.dedent(); this.emitBlank()
    }
    this.emit('async def main():'); this.indent(); this.emit('tasks = []')
    for (const b of whens) if (b.kind==='when') this.emit(`tasks.append(asyncio.create_task(_handler_${this.tname(b.trigger)}()))`)
    if (forevers.length>0) this.emit('tasks.append(asyncio.create_task(_forever_loop()))')
    this.emit('await asyncio.gather(*tasks)'); this.dedent()
    this.emitBlank(); this.emit('asyncio.run(main())')
    return this.result()
  }

  private handler(b: Extract<Block,{kind:'when'}>) {
    const name=this.tname(b.trigger)
    this.emit(`async def _handler_${name}():`,b.loc?.line); this.indent()
    const {cond,ms}=this.tpoll(b.trigger)
    if (cond) {
      this.emit('while True:'); this.indent()
      if (ms) { this.stmts(b.body); this.emit(`await asyncio.sleep_ms(${ms})`) }
      else    { this.emit(`if ${cond}:`); this.indent(); this.stmts(b.body); this.dedent(); this.emit('await asyncio.sleep_ms(50)') }
      this.dedent()
    } else { this.stmts(b.body) }
    this.dedent(); this.emitBlank()
  }

  private tname(t: Trigger): string {
    switch(t.kind) {
      case 'button_a': return 'button_a'; case 'button_b': return 'button_b'
      case 'shaken': return 'shaken'; case 'tilted': return `tilted${t.direction?'_'+t.direction:''}`
      case 'start': return 'start'; case 'timer': return `timer_${this.durationMs(t.interval)}ms`
      case 'received': return 'received'; case 'sensor': return `sensor_${t.sensor}`
      default: return 'unknown'
    }
  }

  private tpoll(t: Trigger): {cond?:string; ms?:number} {
    switch(t.kind) {
      case 'button_a': return {cond:'robot.button_a.value()==0'}
      case 'button_b': return {cond:'robot.button_b.value()==0'}
      case 'shaken':   return {cond:'robot.sensor.shaken()'}
      case 'tilted':   return {cond:'robot.sensor.tilted()'}
      case 'start':    return {}
      case 'timer':    return {cond:'True', ms:this.durationMs(t.interval)}
      case 'received': return {cond:'robot.radio.received()'}
      case 'sensor':   return {cond:`${this.sensorCall(t.sensor)} ${t.op} ${t.threshold}`}
      default: return {}
    }
  }

  private stmts(ss: Statement[]) {
    if (ss.length===0) { this.emit('pass'); return }
    for (const s of ss) this.stmt(s)
  }

  private stmt(s: Statement) {
    const l=s.loc?.line
    switch(s.kind) {
      case 'move': {
        const duty=Math.round((s.speed??50)*655.35), ms=s.duration?this.durationMs(s.duration):0
        this.emit(`robot.drive(direction="${s.direction}", duty=${duty})`,l)
        if (ms>0) { this.emit(`await asyncio.sleep_ms(${ms})`); this.emit('robot.stop()') }
        break }
      case 'turn':       this.emit(`robot.turn(direction="${s.direction}", degrees=${s.degrees})`,l); break
      case 'stop':       this.emit('robot.stop()',l); break
      case 'stop_all':   this.emit('robot.stop_all()',l); break
      case 'say':        this.emit(`print(${this.emitStr(s.text)})`,l); break
      case 'play':       this.emit(`robot.buzzer.play(${JSON.stringify(s.sound)})`,l); break
      case 'show':       this.emit(`print("expression: ${s.expression}")`,l); break
      case 'show_text':  this.emit(`print(${this.emitStr(s.text)})`,l); break
      case 'show_number':this.emit(`print(${this.emitValue(s.value)})`,l); break
      case 'wait':       this.emit(`await asyncio.sleep_ms(${this.durationMs(s.duration)})`,l); break
      case 'wait_until': this.emitWaitUntilAsync(s.condition, l); break
      case 'send':       this.emit(`robot.radio.send(str(${this.emitValue(s.message)}))`,l); break
      case 'let':        this.emit(`${s.name} = ${this.emitValue(s.value)}`,l); break
      case 'set':        this.emit(`${s.name} = ${this.emitValue(s.value)}`,l); break
      case 'remember':   this.emit(`robot.nvm.save(${JSON.stringify(s.name)}, ${s.name})`,l); break
      case 'save':       this.emit(`robot.nvm.save(${JSON.stringify(s.name)}, ${s.name})`,l); break
      case 'load':       this.emit(`${s.name} = robot.nvm.load(${JSON.stringify(s.name)}, 0)`,l); break
      case 'list_add':   this.emit(`${s.list}.append(${this.emitValue(s.value)})`,l); break
      case 'do':         this.emit(this.definedFunctions.has(s.name)?`${s.name}()`:`# '${s.name}' not defined`,l); break
      case 'if':
        this.emit(`if ${this.emitCond(s.condition)}:`,l); this.indent(); this.stmts(s.then); this.dedent()
        if (s.else) { this.emit('else:'); this.indent(); this.stmts(s.else); this.dedent() }; break
      case 'repeat':
        this.emit(`for _i in range(${this.emitValue(s.count)}):`,l); this.indent(); this.stmts(s.body); this.dedent(); break
      case 'while':
        this.emit(`while ${this.emitCond(s.condition)}:`,l); this.indent()
        this.stmts(s.body); this.emit('await asyncio.sleep_ms(10)'); this.dedent(); break
    }
  }
}

export const picoBackend = {
  targetId:'pico', name:'Raspberry Pi Pico W MicroPython Backend', version:'5.0.0',
  generate(p: Program, prof: HardwareProfile): GenerateResult { return new Gen().generate(p,prof) },
}
export function generatePico(p: Program): string { return picoBackend.generate(p,{id:'pico',name:'Raspberry Pi Pico W',runtime:'MicroPython',description:'',sensors:{distance:true,light:true,temperature:true,touch:true,acceleration:false},memory:{flashKB:2048,ramKB:264},supportsAsync:true,hasDisplay:false,hasRadio:true}).code }
