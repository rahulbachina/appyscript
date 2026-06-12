// AppyScript BaseCodegen — v3
// Added: emitValue for random/list/list_item/list_size, emitStringValue for say/show

import type { Program, Value, Condition, Duration, SensorName, FaceExpression } from '../ast'
import { SourceMap } from '../sourcemap'
import type { HardwareProfile, GenerateResult } from '../plugins'

export function durationMs(d: Duration): number {
  if (d.unit === 'ms') return d.value
  if (d.unit === 's')  return d.value * 1000
  return d.value * 60000
}
export function durationS(d: Duration): number { return durationMs(d) / 1000 }

export abstract class BaseCodegen {
  protected lines: string[] = []
  protected indentLevel = 0
  protected definedFunctions = new Set<string>()
  protected sourceMap = new SourceMap()

  protected abstract sensorCall(sensor: SensorName): string
  abstract generate(program: Program, profile: HardwareProfile): GenerateResult

  protected emit(line: string, sourceLine?: number) {
    if (sourceLine !== undefined) this.sourceMap.record(this.lines.length + 1, sourceLine)
    this.lines.push('    '.repeat(this.indentLevel) + line)
  }

  protected emitBlank()  { this.lines.push('') }
  protected indent()     { this.indentLevel++ }
  protected dedent()     { this.indentLevel = Math.max(0, this.indentLevel - 1) }

  // ── Values ────────────────────────────────────────────────────────────────────

  protected emitValue(value: Value): string {
    switch (value.kind) {
      case 'number':    return String(value.value)
      case 'string':    return JSON.stringify(value.value)
      case 'bool':      return this.boolLiteral(value.value)
      case 'variable':  return value.name
      case 'sensor':    return this.sensorCall(value.sensor)
      case 'list':      return this.emitListLiteral()
      case 'list_item': return this.emitListItem(value.list, value.index)
      case 'list_size': return this.emitListSize(value.list)
      case 'random':    return this.emitRandom(value.min, value.max)
      case 'ask':
        return this.emitAsk(value.prompt)
      case 'binary':
        return `(${this.emitValue(value.left)} ${value.op} ${this.emitValue(value.right)})`
    }
  }

  /** Emit a value coerced to a string — for say/show_text */
  protected emitStringValue(value: Value): string {
    if (value.kind === 'string')  return JSON.stringify(value.value)
    if (value.kind === 'number')  return JSON.stringify(String(value.value))
    // Concatenation: "text" + variable → str(text) + str(var)
    if (value.kind === 'binary' && value.op === '+') {
      return `${this.strCast(this.emitStringValue(value.left))} + ${this.strCast(this.emitStringValue(value.right))}`
    }
    return this.strCast(this.emitValue(value))
  }

  /** Same but for Arduino (String() instead of str()) */
  protected emitStringValueCpp(value: Value): string {
    if (value.kind === 'string')  return JSON.stringify(value.value)
    if (value.kind === 'number')  return `String(${value.value})`
    if (value.kind === 'binary' && value.op === '+') {
      return `${this.strCastCpp(this.emitStringValueCpp(value.left))} + ${this.strCastCpp(this.emitStringValueCpp(value.right))}`
    }
    return this.strCastCpp(this.emitValue(value))
  }

  protected strCast(v: string):    string { return `str(${v})` }
  protected strCastCpp(v: string): string { return `String(${v})` }

  // Override per-backend
  protected emitListLiteral(): string    { return '[]' }
  protected emitListItem(list: string, index: Value): string {
    return `${list}[${this.emitValue(index)} - 1]`   // 1-indexed in AppyScript
  }
  protected emitListSize(list: string): string { return `len(${list})` }
  protected emitRandom(min: Value, max: Value): string {
    return `random.randint(${this.emitValue(min)}, ${this.emitValue(max)})`
  }

  // ── Conditions ────────────────────────────────────────────────────────────────

  protected emitCondition(cond: Condition): string {
    switch (cond.kind) {
      case 'sensor':   return `${this.sensorCall(cond.sensor)} ${cond.op} ${cond.threshold}`
      case 'variable': return `${cond.name} ${cond.op} ${this.emitValue(cond.value)}`
      case 'bool':     return this.boolLiteral(cond.value)
      case 'not':      return `${this.notKeyword()}(${this.emitCondition(cond.condition)})`
      case 'and':      return `(${this.emitCondition(cond.left)}) ${this.andKeyword()} (${this.emitCondition(cond.right)})`
      case 'or':       return `(${this.emitCondition(cond.left)}) ${this.orKeyword()} (${this.emitCondition(cond.right)})`
    }
  }

  // Override per backend for platform-appropriate input/storage
  protected emitAsk(prompt: Value): string {
    return `input(${this.emitStringValue(prompt)})`
  }

  protected boolLiteral(v: boolean): string { return v ? 'True' : 'False' }
  protected notKeyword(): string { return 'not ' }
  protected andKeyword(): string { return 'and' }
  protected orKeyword():  string { return 'or' }

  // ── Utilities ─────────────────────────────────────────────────────────────────

  protected durationMs(d: Duration): number { return durationMs(d) }
  protected durationS(d: Duration):  number { return durationS(d) }

  protected emitHeader(targetLabel: string, runtime: string) {
    this.emit(`# Generated by AppyScript — https://github.com/rahulbachina/appyscript`)
    this.emit(`# Target: ${targetLabel} (${runtime})`)
    this.emit(`# Do not edit — re-generate from your .appy source file`)
    this.emitBlank()
  }

  protected emitCHeader(targetLabel: string) {
    this.emit(`// Generated by AppyScript — https://github.com/rahulbachina/appyscript`)
    this.emit(`// Target: ${targetLabel} (Arduino C++)`)
    this.emit(`// Do not edit — re-generate from your .appy source file`)
    this.emitBlank()
  }

  protected result(): GenerateResult {
    return { code: this.lines.join('\n'), sourceMap: this.sourceMap.size > 0 ? this.sourceMap : undefined }
  }
}

export const ASCII_FACES: Record<FaceExpression, string> = {
  happy:'(^_^)', sad:'(T_T)', thinking:'(o_o)', excited:'\\(^o^)/',
  angry:'(>_<)', alert:'(!_!)', sleep:'(-_-)zzz', calm:'(~_~)',
  confused:'(?_?)', dizzy:'(@_@)',
}

export const MICROBIT_IMAGES: Record<FaceExpression, string> = {
  happy:'Image.HAPPY', sad:'Image.SAD', thinking:'Image.SURPRISED',
  excited:'Image.YES', angry:'Image.ANGRY', alert:'Image.SURPRISED',
  sleep:'Image.ASLEEP', calm:'Image.CALM', confused:'Image.CONFUSED',
  dizzy:'Image.ROLL',
}
