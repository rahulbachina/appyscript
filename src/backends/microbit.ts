// AppyScript → BBC micro:bit V2 MicroPython — v5

import type { Program, Block, Statement, Trigger, SensorName } from '../ast'
import { BaseCodegen, MICROBIT_IMAGES } from '../codegen/base'
import type { HardwareProfile, GenerateResult } from '../plugins'

const S: Record<SensorName,string> = {
  distance:'999', light:'display.read_light_level()', temperature:'temperature()',
  touch:'pin_logo.is_touched()', acceleration:'abs(accelerometer.get_z())',
}

class Gen extends BaseCodegen {
  protected sensorCall(s: SensorName) { return S[s] }

  generate(program: Program, profile: HardwareProfile): GenerateResult {
    this.lines=[]; this.indentLevel=0; this.definedFunctions.clear()
    this.emitHeader(profile.name, profile.runtime)
    this.emit('from microbit import *'); this.emit('import utime, random'); this.emitBlank()

    const defines  = program.blocks.filter(b=>b.kind==='define')
    const whens    = program.blocks.filter(b=>b.kind==='when')
    const forevers = program.blocks.filter(b=>b.kind==='forever')
    const starts   = whens.filter(b=>b.kind==='when'&&b.trigger.kind==='start')
    const polls    = whens.filter(b=>b.kind==='when'&&b.trigger.kind!=='start')

    for (const b of defines) {
      if (b.kind!=='define') continue
      this.definedFunctions.add(b.name)
      this.emit(`def ${b.name}():`,b.loc?.line); this.indent(); this.stmts(b.body); this.dedent(); this.emitBlank()
    }
    for (const b of starts) if (b.kind==='when') this.stmts(b.body)

    if (polls.length>0||forevers.length>0) {
      this.emit('while True:'); this.indent()
      for (const b of polls) {
        if (b.kind!=='when') continue
        const cond=this.tcond(b.trigger); if (!cond) continue
        this.emit(`if ${cond}:`,b.loc?.line); this.indent(); this.stmts(b.body); this.dedent()
      }
      for (const b of forevers) if (b.kind==='forever') this.stmts(b.body)
      this.emit('sleep(50)'); this.dedent()
    }
    return this.result()
  }

  private tcond(t: Trigger): string|null {
    switch(t.kind) {
      case 'button_a': return 'button_a.is_pressed()'
      case 'button_b': return 'button_b.is_pressed()'
      case 'shaken':   return 'accelerometer.is_gesture("shake")'
      case 'tilted':   return t.direction==='left'?'accelerometer.is_gesture("left")':t.direction==='right'?'accelerometer.is_gesture("right")':'accelerometer.is_gesture("face up")'
      case 'sensor':   return `${this.sensorCall(t.sensor)} ${t.op} ${t.threshold}`
      default: return null
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
        const duty=Math.round((s.speed??50)*10.23)
        this.emit(`pin0.write_analog(${duty})   # ${s.direction}`,l)
        if (s.duration) { this.emit(`sleep(${this.durationMs(s.duration)})`); this.emit('pin0.write_analog(0)'); this.emit('pin1.write_analog(0)') }
        break }
      case 'turn':       this.emit(`# turn ${s.direction} ${s.degrees}°`,l); break
      case 'stop':       this.emit('pin0.write_analog(0)',l); this.emit('pin1.write_analog(0)'); break
      case 'stop_all':   this.emit('pin0.write_analog(0)',l); this.emit('pin1.write_analog(0)'); this.emit('display.show(Image.SURPRISED)'); break
      case 'say':        this.emit(`display.scroll(${this.emitStr(s.text)})`,l); break
      case 'play':       this.emit(`audio.play(audio.SoundEffect(freq_start=440,freq_end=440,duration=500))`,l); break
      case 'show':       this.emit(`display.show(${MICROBIT_IMAGES[s.expression]??'Image.HAPPY'})`,l); break
      case 'show_text':  this.emit(`display.scroll(${this.emitStr(s.text)})`,l); break
      case 'show_number':this.emit(`display.scroll(str(${this.emitValue(s.value)}))`,l); break
      case 'wait':       this.emit(`sleep(${this.durationMs(s.duration)})`,l); break
      case 'wait_until': this.emitWaitUntilSync(s.condition, l); break
      case 'send':       this.emit(`radio.send(str(${this.emitValue(s.message)}))`,l); break
      case 'let':        this.emit(`${s.name} = ${this.emitValue(s.value)}`,l); break
      case 'set':        this.emit(`${s.name} = ${this.emitValue(s.value)}`,l); break
      case 'remember':   this.emit(`# remember ${s.name} — add storage module`,l); break
      case 'save':       this.emit(`# save ${s.name} — add storage module`,l); break
      case 'load':       this.emit(`# load ${s.name} — add storage module`,l); break
      case 'list_add':   this.emit(`${s.list}.append(${this.emitValue(s.value)})`,l); break
      case 'do':         this.emit(this.definedFunctions.has(s.name)?`${s.name}()`:`# '${s.name}' not defined`,l); break
      case 'if':
        this.emit(`if ${this.emitCond(s.condition)}:`,l); this.indent(); this.stmts(s.then); this.dedent()
        if (s.else) { this.emit('else:'); this.indent(); this.stmts(s.else); this.dedent() }; break
      case 'repeat':
        this.emit(`for _i in range(${this.emitValue(s.count)}):`,l); this.indent(); this.stmts(s.body); this.dedent(); break
      case 'while':
        this.emit(`while ${this.emitCond(s.condition)}:`,l); this.indent()
        this.stmts(s.body); this.emit('sleep(10)'); this.dedent(); break
    }
  }
}

export const microbitBackend = {
  targetId:'microbit', name:'BBC micro:bit V2 MicroPython Backend', version:'5.0.0',
  generate(p: Program, prof: HardwareProfile): GenerateResult { return new Gen().generate(p,prof) },
}
export function generateMicrobit(p: Program): string { return microbitBackend.generate(p,{id:'microbit',name:'BBC micro:bit V2',runtime:'MicroPython',description:'',sensors:{distance:false,light:true,temperature:true,touch:true,acceleration:true},memory:{flashKB:512,ramKB:128},supportsAsync:false,hasDisplay:true,hasRadio:true}).code }
