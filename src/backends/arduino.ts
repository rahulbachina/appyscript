// AppyScript → Arduino C++ — v5

import type { Program, Block, Statement, Trigger, SensorName } from '../ast'
import { BaseCodegen } from '../codegen/base'
import type { HardwareProfile, GenerateResult } from '../plugins'

const S: Record<SensorName,string> = {
  distance:'robot.distance()', light:'robot.light()', temperature:'robot.temperature()',
  touch:'robot.touch()', acceleration:'robot.accelerationMagnitude()',
}

class Gen extends BaseCodegen {
  protected sensorCall(s: SensorName) { return S[s] }
  // C++ overrides
  protected boolLit(_v: boolean): string { return _v ? 'true' : 'false' }
  protected notKw()  { return '!' }
  protected andKw()  { return '&&' }
  protected orKw()   { return '||' }
  protected listLiteral() { return 'std::vector<String>()' }
  protected wrapStr(s: string)    { return `String(${s})` }
  protected wrapStrCpp(s: string) { return `String(${s})` }

  // C++ overrides for new math builtins
  protected emitValue(v: any): string {
    switch(v.kind) {
      case 'round':  return `round(${this.emitValue(v.value)})`
      case 'abs':    return `abs(${this.emitValue(v.value)})`
      case 'min':    return `min(${this.emitValue(v.left)}, ${this.emitValue(v.right)})`
      case 'max':    return `max(${this.emitValue(v.left)}, ${this.emitValue(v.right)})`
      case 'length': return `String(${this.emitValue(v.value)}).length()`
      case 'list_size': return `${v.list}.size()`
      case 'list_item': return `${v.list}[${this.emitValue(v.index)} - 1]`
      case 'random': return `(rand() % (${this.emitValue(v.max)} - ${this.emitValue(v.min)} + 1) + ${this.emitValue(v.min)})`
      case 'ask':    return `""  // ask not supported on Arduino — use Serial manually`
      default: return super.emitValue(v)
    }
  }

  generate(program: Program, profile: HardwareProfile): GenerateResult {
    this.lines=[]; this.indentLevel=0; this.definedFunctions.clear()
    this.emitCHeader(profile.name)
    this.emit('#include <AppyRobot.h>'); this.emit('#include <vector>'); this.emit('#include <stdlib.h>')
    this.emitBlank(); this.emit('AppyRobot robot;'); this.emitBlank()

    const defines  = program.blocks.filter(b=>b.kind==='define')
    const whens    = program.blocks.filter(b=>b.kind==='when')
    const forevers = program.blocks.filter(b=>b.kind==='forever')
    const starts   = whens.filter(b=>b.kind==='when'&&b.trigger.kind==='start')
    const polls    = whens.filter(b=>b.kind==='when'&&b.trigger.kind!=='start')

    for (const b of defines) if (b.kind==='define') { this.definedFunctions.add(b.name); this.emit(`void ${b.name}();`) }
    if (defines.length) this.emitBlank()

    // setup()
    this.emit('void setup() {', starts[0]?.loc?.line); this.indent()
    this.emit('Serial.begin(115200); srand(analogRead(0)); robot.begin();')
    for (const b of starts) if (b.kind==='when') for (const s of b.body) this.flat(s)
    this.dedent(); this.emit('}'); this.emitBlank()

    // loop()
    this.emit('void loop() {'); this.indent()
    for (const b of polls) {
      if (b.kind!=='when') continue
      const cond=this.tcond(b.trigger); if (!cond) continue
      this.emit(`if (${cond}) {`,b.loc?.line); this.indent(); for (const s of b.body) this.flat(s); this.dedent(); this.emit('}')
    }
    for (const b of forevers) if (b.kind==='forever') for (const s of b.body) this.flat(s)
    this.emit('delay(50);'); this.dedent(); this.emit('}'); this.emitBlank()

    // Behaviours
    for (const b of defines) {
      if (b.kind!=='define') continue
      this.emit(`void ${b.name}() {`,b.loc?.line); this.indent()
      for (const s of b.body) this.flat(s)
      this.dedent(); this.emit('}'); this.emitBlank()
    }
    return this.result()
  }

  private tcond(t: Trigger): string|null {
    switch(t.kind) {
      case 'button_a': return 'robot.buttonA()'; case 'button_b': return 'robot.buttonB()'
      case 'shaken': return 'robot.shaken()'; case 'tilted': return 'robot.tilted()'
      case 'received': return 'robot.radioReceived()'
      case 'sensor': return `${this.sensorCall(t.sensor)} ${t.op} ${t.threshold}`
      default: return null
    }
  }

  private flat(s: Statement) {
    const l=s.loc?.line
    switch(s.kind) {
      case 'if':
        this.emit(`if (${this.emitCond(s.condition)}) {`,l); this.indent(); for (const x of s.then) this.flat(x); this.dedent()
        if (s.else) { this.emit('} else {'); this.indent(); for (const x of s.else) this.flat(x); this.dedent() }
        this.emit('}'); break
      case 'repeat':
        this.emit(`for (int _i=0;_i<${this.emitValue(s.count)};_i++) {`,l); this.indent(); for (const x of s.body) this.flat(x); this.dedent(); this.emit('}'); break
      case 'while':
        this.emit(`while (${this.emitCond(s.condition)}) {`,l); this.indent(); for (const x of s.body) this.flat(x); this.emit('delay(10);'); this.dedent(); this.emit('}'); break
      case 'wait_until':
        this.emitWaitUntilCpp(s.condition, l); break
      default: {
        const line=this.line(s); if (line) this.emit(line, l); break
      }
    }
  }

  private line(s: Statement): string|null {
    switch(s.kind) {
      case 'move': {
        const sp=s.speed??50, ms=s.duration?this.durationMs(s.duration):0
        return ms>0?`robot.move("${s.direction}",${sp}); delay(${ms}); robot.stop();`:`robot.move("${s.direction}",${sp});`
      }
      case 'turn':       return `robot.turn("${s.direction}",${s.degrees});`
      case 'stop':       return 'robot.stop();'
      case 'stop_all':   return 'robot.stop_all();'
      case 'say':        return `Serial.println(${this.emitStrCpp(s.text)});`
      case 'play':       return `robot.playSound(${JSON.stringify(s.sound)});`
      case 'show':       return `robot.showExpression(${JSON.stringify(s.expression)});`
      case 'show_text':  return `robot.showText(${this.emitStrCpp(s.text)});`
      case 'show_number':return `robot.showNumber(${this.emitValue(s.value)});`
      case 'wait':       return `delay(${this.durationMs(s.duration)});`
      case 'send':       return `robot.radioSend(String(${this.emitValue(s.message)}));`
      case 'let':        return `auto ${s.name} = ${this.emitValue(s.value)};`
      case 'set':        return `${s.name} = ${this.emitValue(s.value)};`
      case 'remember':   return `robot.eepromWrite(${JSON.stringify(s.name)}, ${s.name});`
      case 'save':       return `robot.eepromWrite(${JSON.stringify(s.name)}, ${s.name});`
      case 'load':       return `${s.name} = robot.eepromRead(${JSON.stringify(s.name)});`
      case 'list_add':   return `${s.list}.push_back(${this.emitValue(s.value)});`
      case 'do':         return `${s.name}();`
      default: return null
    }
  }
}

export const arduinoBackend = {
  targetId:'arduino', name:'Arduino C++ Backend', version:'5.0.0',
  generate(p: Program, prof: HardwareProfile): GenerateResult { return new Gen().generate(p,prof) },
}
export function generateArduino(p: Program): string { return arduinoBackend.generate(p,{id:'arduino',name:'Arduino',runtime:'C++',description:'',sensors:{distance:true,light:true,temperature:true,touch:true,acceleration:false},memory:{flashKB:32,ramKB:2},supportsAsync:false,hasDisplay:false,hasRadio:false}).code }
