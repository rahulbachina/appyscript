// AppyScript → CircuitPython (Adafruit Circuit Playground Bluefruit) — v5

import type { Program, Block, Statement, Trigger, SensorName, FaceExpression } from '../ast'
import { BaseCodegen } from '../codegen/base'
import type { HardwareProfile, GenerateResult } from '../plugins'

const S: Record<SensorName,string> = {
  distance:'0', light:'cp.light', temperature:'cp.temperature',
  touch:'cp.touch_A1', acceleration:'abs(cp.acceleration[2])',
}
const PIXELS: Record<FaceExpression,string> = {
  happy:'(0,255,0)', sad:'(0,0,255)', thinking:'(128,0,128)', excited:'(255,165,0)',
  angry:'(255,0,0)', alert:'(255,255,0)', sleep:'(0,0,16)', calm:'(0,128,128)',
  confused:'(255,20,147)', dizzy:'(255,255,255)',
}

class Gen extends BaseCodegen {
  protected sensorCall(s: SensorName) { return S[s] }

  generate(program: Program, profile: HardwareProfile): GenerateResult {
    this.lines=[]; this.indentLevel=0; this.definedFunctions.clear()
    this.emitHeader(profile.name, profile.runtime)
    this.emit('import time, random'); this.emit('from adafruit_circuitplayground import cp')
    this.emitBlank()

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
      this.emit('time.sleep(0.05)'); this.dedent()
    }
    return this.result()
  }

  private tcond(t: Trigger): string|null {
    switch(t.kind) {
      case 'button_a': return 'cp.button_a'; case 'button_b': return 'cp.button_b'
      case 'shaken':   return 'cp.shake(shake_threshold=20)'
      case 'tilted':   return 'abs(cp.acceleration[0]) > 5'
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
      case 'move':       this.emit(`# move ${s.direction} at ${s.speed??50}% — connect motor driver`,l); break
      case 'turn':       this.emit(`# turn ${s.direction} ${s.degrees}°`,l); break
      case 'stop':       this.emit('# stop motors',l); break
      case 'stop_all':   this.emit('cp.pixels.fill((0,0,0))',l); this.emit('# stop all motors'); break
      case 'say':        this.emit(`print(${this.emitStr(s.text)})`,l); this.emit('cp.play_tone(440, 0.2)'); break
      case 'play':       this.emit(`cp.play_tone(440, 0.5)   # play "${s.sound}"`,l); break
      case 'show':       this.emit(`cp.pixels.fill(${PIXELS[s.expression]??'(0,255,0)'})   # ${s.expression}`,l); break
      case 'show_text':  this.emit(`print(${this.emitStr(s.text)})`,l); break
      case 'show_number':this.emit(`print(${this.emitValue(s.value)})`,l); break
      case 'wait':       this.emit(`time.sleep(${this.durationMs(s.duration)/1000})`,l); break
      case 'wait_until': this.emitWaitUntilSync(s.condition, l); break
      case 'let':        this.emit(`${s.name} = ${this.emitValue(s.value)}`,l); break
      case 'set':        this.emit(`${s.name} = ${this.emitValue(s.value)}`,l); break
      case 'remember':   this.emit(`# remember — use storage module`,l); break
      case 'save':       this.emit(`# save ${s.name} — use storage module`,l); break
      case 'load':       this.emit(`# load ${s.name} — use storage module`,l); break
      case 'list_add':   this.emit(`${s.list}.append(${this.emitValue(s.value)})`,l); break
      case 'do':         this.emit(this.definedFunctions.has(s.name)?`${s.name}()`:`# '${s.name}' not defined`,l); break
      case 'send':       this.emit(`# radio.send(${this.emitValue(s.message)}) — configure BLE`,l); break
      case 'if':
        this.emit(`if ${this.emitCond(s.condition)}:`,l); this.indent(); this.stmts(s.then); this.dedent()
        if (s.else) { this.emit('else:'); this.indent(); this.stmts(s.else); this.dedent() }; break
      case 'repeat':
        this.emit(`for _i in range(${this.emitValue(s.count)}):`,l); this.indent(); this.stmts(s.body); this.dedent(); break
      case 'while':
        this.emit(`while ${this.emitCond(s.condition)}:`,l); this.indent()
        this.stmts(s.body); this.emit('time.sleep(0.01)'); this.dedent(); break
    }
  }
}

export const circuitpythonBackend = {
  targetId:'circuitpython', name:'CircuitPython (Adafruit) Backend', version:'5.0.0',
  generate(p: Program, prof: HardwareProfile): GenerateResult { return new Gen().generate(p,prof) },
}
