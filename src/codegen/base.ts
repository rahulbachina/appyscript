// AppyScript BaseCodegen — v5 (final)

import type { Program, Value, Condition, Duration, SensorName, FaceExpression } from '../ast'
import { SourceMap } from '../sourcemap'
import type { HardwareProfile, GenerateResult } from '../plugins'

export function durationMs(d: Duration): number {
  return d.unit==='ms' ? d.value : d.unit==='s' ? d.value*1000 : d.value*60000
}

export abstract class BaseCodegen {
  protected lines: string[] = []
  protected indentLevel = 0
  protected definedFunctions = new Set<string>()
  protected sourceMap = new SourceMap()

  protected abstract sensorCall(sensor: SensorName): string
  abstract generate(program: Program, profile: HardwareProfile): GenerateResult

  protected emit(line: string, srcLine?: number) {
    if (srcLine !== undefined) this.sourceMap.record(this.lines.length+1, srcLine)
    this.lines.push('    '.repeat(this.indentLevel) + line)
  }
  protected emitBlank() { this.lines.push('') }
  protected indent()    { this.indentLevel++ }
  protected dedent()    { this.indentLevel = Math.max(0, this.indentLevel-1) }
  protected durationMs(d: Duration) { return durationMs(d) }

  // ── Values ────────────────────────────────────────────────────────────────────

  protected emitValue(v: Value): string {
    switch (v.kind) {
      case 'number':    return String(v.value)
      case 'string':    return JSON.stringify(v.value)
      case 'bool':      return this.boolLit(v.value)
      case 'variable':  return v.name
      case 'sensor':    return this.sensorCall(v.sensor)
      case 'list':      return this.listLiteral()
      case 'list_item': return `${v.list}[${this.emitValue(v.index)} - 1]`
      case 'list_size': return `len(${v.list})`
      case 'ask':       return `input(${this.emitStr(v.prompt)})`
      case 'round':     return `round(${this.emitValue(v.value)})`
      case 'abs':       return `abs(${this.emitValue(v.value)})`
      case 'min':       return `min(${this.emitValue(v.left)}, ${this.emitValue(v.right)})`
      case 'max':       return `max(${this.emitValue(v.left)}, ${this.emitValue(v.right)})`
      case 'length':    return `len(str(${this.emitValue(v.value)}))`
      case 'random':    return `random.randint(${this.emitValue(v.min)}, ${this.emitValue(v.max)})`
      case 'binary':    return `(${this.emitValue(v.left)} ${v.op} ${this.emitValue(v.right)})`
    }
  }

  // String-context emission: wraps non-strings in str()
  protected emitStr(v: Value): string {
    if (v.kind==='string') return JSON.stringify(v.value)
    if (v.kind==='binary' && v.op==='+')
      return `${this.wrapStr(this.emitStr(v.left))} + ${this.wrapStr(this.emitStr(v.right))}`
    return this.wrapStr(this.emitValue(v))
  }
  protected wrapStr(s: string)    { return `str(${s})` }
  protected wrapStrCpp(s: string) { return `String(${s})` }

  // For say/show_text in Arduino
  protected emitStrCpp(v: Value): string {
    if (v.kind==='string') return JSON.stringify(v.value)
    if (v.kind==='binary' && v.op==='+')
      return `${this.wrapStrCpp(this.emitStrCpp(v.left))} + ${this.wrapStrCpp(this.emitStrCpp(v.right))}`
    return this.wrapStrCpp(this.emitValue(v))
  }

  // ── Conditions ────────────────────────────────────────────────────────────────

  protected emitCond(c: Condition): string {
    switch (c.kind) {
      case 'sensor':   return `${this.sensorCall(c.sensor)} ${c.op} ${c.threshold}`
      case 'variable': return `${c.name} ${c.op} ${this.emitValue(c.value)}`
      case 'bool':     return this.boolLit(c.value)
      case 'not':      return `${this.notKw()}(${this.emitCond(c.condition)})`
      case 'and':      return `(${this.emitCond(c.left)}) ${this.andKw()} (${this.emitCond(c.right)})`
      case 'or':       return `(${this.emitCond(c.left)}) ${this.orKw()} (${this.emitCond(c.right)})`
    }
  }

  // Override in C++ backends
  protected boolLit(_v: boolean): string { return _v ? 'True' : 'False' }
  protected notKw()  { return 'not ' }
  protected andKw()  { return 'and' }
  protected orKw()   { return 'or' }
  protected listLiteral() { return '[]' }

  // ── wait_until helpers (one per runtime style) ────────────────────────────────

  // MicroPython async (ESP32, Pico)
  protected emitWaitUntilAsync(condition: Condition, loc?: number) {
    this.emit(`while not (${this.emitCond(condition)}):`, loc)
    this.indent(); this.emit('await asyncio.sleep_ms(50)'); this.dedent()
  }

  // MicroPython sync (micro:bit, CircuitPython)
  protected emitWaitUntilSync(condition: Condition, loc?: number) {
    this.emit(`while not (${this.emitCond(condition)}):`, loc)
    this.indent(); this.emit('sleep(50)'); this.dedent()
  }

  // Arduino C++
  protected emitWaitUntilCpp(condition: Condition, loc?: number) {
    this.emit(`while (!(${this.emitCond(condition)})) {`, loc)
    this.indent(); this.emit('delay(50);'); this.dedent(); this.emit('}')
  }

  // ── Boilerplate ───────────────────────────────────────────────────────────────

  protected emitHeader(target: string, runtime: string) {
    this.emit(`# Generated by AppyScript — https://github.com/rahulbachina/appyscript`)
    this.emit(`# Target: ${target} (${runtime})`); this.emitBlank()
  }
  protected emitCHeader(target: string) {
    this.emit(`// Generated by AppyScript — https://github.com/rahulbachina/appyscript`)
    this.emit(`// Target: ${target} (Arduino C++)`); this.emitBlank()
  }
  protected result(): GenerateResult {
    return { code:this.lines.join('\n'), sourceMap:this.sourceMap.size>0?this.sourceMap:undefined }
  }
}

export const MICROBIT_IMAGES: Record<FaceExpression, string> = {
  happy:'Image.HAPPY', sad:'Image.SAD', thinking:'Image.SURPRISED',
  excited:'Image.YES', angry:'Image.ANGRY', alert:'Image.SURPRISED',
  sleep:'Image.ASLEEP', calm:'Image.CALM', confused:'Image.CONFUSED', dizzy:'Image.ROLL',
}
