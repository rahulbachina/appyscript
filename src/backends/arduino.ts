// AppyScript → Arduino C++ — v3

import type { Program, Block, Statement, Trigger, SensorName } from '../ast'
import { BaseCodegen } from '../codegen/base'
import type { HardwareProfile, GenerateResult } from '../plugins'

const ARD_SENSORS: Record<SensorName, string> = {
  distance:'robot.distance()', light:'robot.light()', temperature:'robot.temperature()',
  touch:'robot.touch()', acceleration:'robot.accelerationMagnitude()',
}

class ArduinoCodegen extends BaseCodegen {
  protected sensorCall(s: SensorName) { return ARD_SENSORS[s] ?? `robot.sensor_${s}()` }
  protected emitListLiteral()    { return 'std::vector<String>()' }
  protected emitListSize(l: string) { return `${l}.size()` }
  protected emitListItem(l: string, i: any) { return `${l}[${this.emitValue(i)} - 1]` }
  protected emitRandom(mn: any, mx: any) { return `(rand() % (${this.emitValue(mx)} - ${this.emitValue(mn)} + 1) + ${this.emitValue(mn)})` }
  protected boolLiteral(v: boolean) { return v ? 'true' : 'false' }
  protected notKeyword() { return '!' }
  protected andKeyword() { return '&&' }
  protected orKeyword()  { return '||' }

  generate(program: Program, profile: HardwareProfile): GenerateResult {
    this.lines = []; this.indentLevel = 0; this.definedFunctions.clear()
    this.emitCHeader(profile.name)
    this.emit('#include <AppyRobot.h>')
    this.emit('#include <vector>')
    this.emit('#include <stdlib.h>')
    this.emitBlank()
    this.emit('AppyRobot robot;')
    this.emitBlank()

    const defines  = program.blocks.filter(b => b.kind === 'define')
    const whens    = program.blocks.filter(b => b.kind === 'when')
    const forevers = program.blocks.filter(b => b.kind === 'forever')
    const starts   = whens.filter(b => b.kind === 'when' && b.trigger.kind === 'start')
    const polls    = whens.filter(b => b.kind === 'when' && b.trigger.kind !== 'start')

    // Forward declarations
    for (const b of defines) {
      if (b.kind === 'define') { this.definedFunctions.add(b.name); this.emit(`void ${b.name}();`) }
    }
    if (defines.length) this.emitBlank()

    // setup()
    this.emit('void setup() {', starts[0]?.loc?.line)
    this.indent(); this.emit('Serial.begin(115200); srand(analogRead(0));'); this.emit('robot.begin();')
    for (const b of starts) { if (b.kind === 'when') { for (const s of b.body) this.flatEmit(s) } }
    this.dedent(); this.emit('}'); this.emitBlank()

    // loop()
    this.emit('void loop() {')
    this.indent()
    for (const b of polls) {
      if (b.kind !== 'when') continue
      const cond = this.trigCond(b.trigger)
      if (!cond) continue
      this.emit(`if (${cond}) {`, b.loc?.line); this.indent()
      for (const s of b.body) this.flatEmit(s)
      this.dedent(); this.emit('}')
    }
    for (const b of forevers) { if (b.kind === 'forever') { for (const s of b.body) this.flatEmit(s) } }
    this.emit('delay(50);')
    this.dedent(); this.emit('}'); this.emitBlank()

    // User behaviours
    for (const b of defines) {
      if (b.kind !== 'define') continue
      this.emit(`void ${b.name}() {`, b.loc?.line)
      this.indent()
      for (const s of b.body) this.flatEmit(s)
      this.dedent(); this.emit('}'); this.emitBlank()
    }

    return this.result()
  }

  private trigCond(t: any): string | null {
    switch (t.kind) {
      case 'button_a': return 'robot.buttonA()'
      case 'button_b': return 'robot.buttonB()'
      case 'shaken':   return 'robot.shaken()'
      case 'tilted':   return 'robot.tilted()'
      case 'received': return 'robot.radioReceived()'
      case 'sensor':   return `${this.sensorCall(t.sensor)} ${t.op} ${t.threshold}`
      default: return null
    }
  }

  private flatEmit(stmt: Statement) {
    const loc = stmt.loc?.line
    switch (stmt.kind) {
      case 'if':
        this.emit(`if (${this.emitCondition(stmt.condition)}) {`, loc); this.indent()
        for (const s of stmt.then) this.flatEmit(s)
        this.dedent()
        if (stmt.else) { this.emit('} else {'); this.indent(); for (const s of stmt.else) this.flatEmit(s); this.dedent() }
        this.emit('}'); break
      case 'repeat':
        this.emit(`for (int _i = 0; _i < ${this.emitValue(stmt.count)}; _i++) {`, loc); this.indent()
        for (const s of stmt.body) this.flatEmit(s)
        this.dedent(); this.emit('}'); break
      case 'while':
        this.emit(`while (${this.emitCondition(stmt.condition)}) {`, loc); this.indent()
        for (const s of stmt.body) this.flatEmit(s)
        this.emit('delay(10);'); this.dedent(); this.emit('}'); break
      default: {
        const line = this.flatLine(stmt)
        if (line) this.emit(line, loc)
      }
    }
  }

  private flatLine(stmt: Statement): string | null {
    switch (stmt.kind) {
      case 'move': {
        const sp = stmt.speed ?? 50, ms = stmt.duration ? this.durationMs(stmt.duration) : 0
        return ms > 0 ? `robot.move("${stmt.direction}", ${sp}); delay(${ms}); robot.stop();` : `robot.move("${stmt.direction}", ${sp});`
      }
      case 'turn':        return `robot.turn("${stmt.direction}", ${stmt.degrees});`
      case 'stop':        return 'robot.stop();'
      case 'say':         return `Serial.println(${this.emitStringValueCpp(stmt.text)});`
      case 'play':        return `robot.playSound(${JSON.stringify(stmt.sound)});`
      case 'show':        return `robot.showExpression(${JSON.stringify(stmt.expression)});`
      case 'show_text':   return `robot.showText(${this.emitStringValueCpp(stmt.text)});`
      case 'show_number': return `robot.showNumber(${this.emitValue(stmt.value)});`
      case 'wait':        return `delay(${this.durationMs(stmt.duration)});`
      case 'send':        return `robot.radioSend(String(${this.emitValue(stmt.message)}));`
      case 'let':         return `auto ${stmt.name} = ${this.emitValue(stmt.value)};`
      case 'set':         return `${stmt.name} = ${this.emitValue(stmt.value)};`
      case 'remember':    return `robot.eepromWrite(${JSON.stringify(stmt.name)}, ${stmt.name});`
      case 'list_add':    return `${stmt.list}.push_back(${this.emitValue(stmt.value)});`
      case 'do':          return `${stmt.name}();`
      default: return null
    }
  }
}

export const arduinoBackend = {
  targetId: 'arduino', name: 'Arduino C++ Backend', version: '3.0.0',
  generate(p: Program, prof: HardwareProfile): GenerateResult { return new ArduinoCodegen().generate(p, prof) },
}

export function generateArduino(program: Program): string {
  return arduinoBackend.generate(program, {
    id:'arduino', name:'Arduino', runtime:'C++', description:'',
    sensors:{ distance:true, light:true, temperature:true, touch:true, acceleration:false },
    memory:{ flashKB:32, ramKB:2 }, supportsAsync:false, hasDisplay:false, hasRadio:false,
  }).code
}
