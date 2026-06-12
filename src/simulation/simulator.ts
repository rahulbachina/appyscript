// AppyScript Simulation Engine — v3
// Handles: random, lists, string concatenation, list_add

import type { Program, Block, Statement, Condition, Value, Duration, SensorName } from '../ast'

export interface RobotState {
  position: { x: number; y: number; heading: number }
  speed: number; moving: boolean; expression: string; displayText: string
  variables: Map<string, number | string | boolean>
  lists: Map<string, Array<number | string | boolean>>
  memory: Map<string, number | string | boolean>
  sensors: Record<SensorName, number>
}

export interface SimEvent {
  type: 'say' | 'play' | 'show' | 'show_text' | 'move' | 'turn' | 'stop' | 'send' | 'wait' | 'log'
  data: Record<string, unknown>
  tick: number
}

export interface SimulationResult {
  success: boolean; events: SimEvent[]; finalState: RobotState
  ticks: number; error?: string; executionTrace: ExecutionTraceEntry[]
}

export interface ExecutionTraceEntry {
  tick: number; blockKind: string; statementKind: string
  sourceLine?: number; stateSnapshot: Partial<RobotState>
}

export interface SimulationOptions {
  maxTicks?: number
  sensors?: Partial<Record<SensorName, number>>
  buttons?: { a?: boolean; b?: boolean }
  triggerEvents?: string[]
}

function durationMs(d: Duration): number {
  return d.unit === 'ms' ? d.value : d.unit === 's' ? d.value * 1000 : d.value * 60000
}

export class Simulator {
  private state!: RobotState
  private events: SimEvent[] = []
  private trace: ExecutionTraceEntry[] = []
  private tick = 0
  private maxTicks: number
  private options: SimulationOptions

  constructor(options: SimulationOptions = {}) {
    this.options = options
    this.maxTicks = options.maxTicks ?? 1000
  }

  run(program: Program): SimulationResult {
    this.state = {
      position: { x: 0, y: 0, heading: 0 }, speed: 0, moving: false,
      expression: 'calm', displayText: '', variables: new Map(),
      lists: new Map(), memory: new Map(),
      sensors: { distance: 100, light: 50, temperature: 20, touch: 0, acceleration: 0 },
    }
    this.events = []; this.trace = []; this.tick = 0
    if (this.options.sensors) {
      for (const [k, v] of Object.entries(this.options.sensors))
        this.state.sensors[k as SensorName] = v as number
    }

    try {
      const defines = new Map<string, Block>()
      const starts: Block[] = [], polls: Block[] = [], forevers: Block[] = []
      for (const block of program.blocks) {
        if (block.kind === 'define') defines.set(block.name, block)
        else if (block.kind === 'when' && block.trigger.kind === 'start') starts.push(block)
        else if (block.kind === 'when') polls.push(block)
        else if (block.kind === 'forever') forevers.push(block)
      }
      for (const b of starts) this.execStmts(b.body, defines, 'start')
      for (let cycle = 0; cycle < this.maxTicks; cycle++) {
        this.tick++
        for (const b of polls) {
          if (b.kind === 'when' && this.evalTrigger(b.trigger)) this.execStmts(b.body, defines, `when:${b.trigger.kind}`)
        }
        for (const b of forevers) { if (b.kind === 'forever') this.execStmts(b.body, defines, 'forever') }
        if (polls.length === 0 && forevers.length === 0) break
      }
      return { success: true, events: this.events, finalState: this.state, ticks: this.tick, executionTrace: this.trace }
    } catch (err) {
      return { success: false, events: this.events, finalState: this.state, ticks: this.tick,
        error: err instanceof Error ? err.message : String(err), executionTrace: this.trace }
    }
  }

  private evalTrigger(t: any): boolean {
    switch (t.kind) {
      case 'button_a': return this.options.buttons?.a ?? false
      case 'button_b': return this.options.buttons?.b ?? false
      case 'shaken':   return (this.options.triggerEvents ?? []).includes('shaken')
      case 'tilted':   return (this.options.triggerEvents ?? []).includes('tilted')
      case 'received': return (this.options.triggerEvents ?? []).includes('received')
      case 'timer':    return true
      case 'sensor':   return this.compare(this.state.sensors[t.sensor as SensorName] ?? 0, t.op, t.threshold)
      default: return false
    }
  }

  private execStmts(stmts: Statement[], defines: Map<string, Block>, ctx: string) {
    for (const s of stmts) this.execStmt(s, defines, ctx)
  }

  private execStmt(stmt: Statement, defines: Map<string, Block>, ctx: string) {
    this.trace.push({
      tick: this.tick, blockKind: ctx, statementKind: stmt.kind,
      sourceLine: stmt.loc?.line, stateSnapshot: { position: { ...this.state.position }, expression: this.state.expression },
    })

    switch (stmt.kind) {
      case 'move': {
        const sp = stmt.speed ?? 50, ms = stmt.duration ? durationMs(stmt.duration) : 0
        this.state.moving = true; this.state.speed = sp
        this.emit('move', { direction: stmt.direction, speed: sp, durationMs: ms })
        if (ms > 0) {
          const dist = (sp / 100) * (ms / 1000) * 20
          const heading = this.state.position.heading * (Math.PI / 180)
          const sign = stmt.direction === 'backward' ? -1 : 1
          this.state.position.x += Math.sin(heading) * dist * sign
          this.state.position.y += Math.cos(heading) * dist * sign
          this.state.moving = false; this.state.speed = 0
        }
        break
      }
      case 'turn': {
        const d = stmt.direction === 'right' ? stmt.degrees : -stmt.degrees
        this.state.position.heading = (this.state.position.heading + d + 360) % 360
        this.emit('turn', { direction: stmt.direction, degrees: stmt.degrees }); break
      }
      case 'stop':  this.state.moving = false; this.state.speed = 0; this.emit('stop', {}); break
      case 'say': {
        const text = String(this.evalValue(stmt.text))
        this.state.displayText = text; this.emit('say', { text }); break
      }
      case 'play':  this.emit('play', { sound: stmt.sound }); break
      case 'show':  this.state.expression = stmt.expression; this.emit('show', { expression: stmt.expression }); break
      case 'show_text': {
        const text = String(this.evalValue(stmt.text))
        this.state.displayText = text; this.emit('show_text', { text }); break
      }
      case 'show_number': {
        const text = String(this.evalValue(stmt.value))
        this.state.displayText = text; this.emit('show_text', { text }); break
      }
      case 'wait':  this.emit('wait', { ms: durationMs(stmt.duration) }); break
      case 'send':  this.emit('send', { message: this.evalValue(stmt.message) }); break
      case 'let': {
        const val = this.evalValue(stmt.value)
        if (Array.isArray(val)) this.state.lists.set(stmt.name, val as any[])
        else this.state.variables.set(stmt.name, val as any)
        break
      }
      case 'set':  this.state.variables.set(stmt.name, this.evalValue(stmt.value) as any); break
      case 'remember': this.state.memory.set(stmt.name, this.state.variables.get(stmt.name) ?? 0); break
      case 'list_add': {
        const lst = this.state.lists.get(stmt.list) ?? []
        lst.push(this.evalValue(stmt.value) as any)
        this.state.lists.set(stmt.list, lst); break
      }
      case 'do': {
        const def = defines.get(stmt.name)
        if (def?.kind === 'define') this.execStmts(def.body, defines, `define:${stmt.name}`); break
      }
      case 'if':
        if (this.evalCond(stmt.condition)) this.execStmts(stmt.then, defines, ctx)
        else if (stmt.else) this.execStmts(stmt.else, defines, ctx)
        break
      case 'repeat': {
        const count = Number(this.evalValue(stmt.count))
        for (let i = 0; i < count && this.tick < this.maxTicks; i++) { this.execStmts(stmt.body, defines, ctx); this.tick++ }
        break
      }
      case 'while': {
        let guard = 0
        while (this.evalCond(stmt.condition) && guard++ < 1000) { this.execStmts(stmt.body, defines, ctx); this.tick++ }
        break
      }
    }
  }

  private evalCond(cond: Condition): boolean {
    switch (cond.kind) {
      case 'sensor':   return this.compare(this.state.sensors[cond.sensor] ?? 0, cond.op, cond.threshold)
      case 'variable': return this.compare(this.state.variables.get(cond.name) ?? 0, cond.op, this.evalValue(cond.value))
      case 'bool':     return cond.value
      case 'not':      return !this.evalCond(cond.condition)
      case 'and':      return this.evalCond(cond.left) && this.evalCond(cond.right)
      case 'or':       return this.evalCond(cond.left) || this.evalCond(cond.right)
    }
  }

  private evalValue(value: Value): number | string | boolean | any[] {
    switch (value.kind) {
      case 'number':    return value.value
      case 'string':    return value.value
      case 'bool':      return value.value
      case 'variable':  return this.state.variables.get(value.name) ?? 0
      case 'sensor':    return this.state.sensors[value.sensor] ?? 0
      case 'list':      return []
      case 'list_item': {
        const lst = this.state.lists.get(value.list) ?? []
        return lst[Number(this.evalValue(value.index)) - 1] ?? 0
      }
      case 'list_size': return (this.state.lists.get(value.list) ?? []).length
      case 'random': {
        const mn = Number(this.evalValue(value.min)), mx = Number(this.evalValue(value.max))
        return Math.floor(Math.random() * (mx - mn + 1)) + mn
      }
      case 'binary': {
        const l = this.evalValue(value.left), r = this.evalValue(value.right)
        if (value.op === '+' && (typeof l === 'string' || typeof r === 'string')) return String(l) + String(r)
        const ln = Number(l), rn = Number(r)
        switch (value.op) {
          case '+': return ln + rn; case '-': return ln - rn
          case '*': return ln * rn; case '/': return rn !== 0 ? ln / rn : 0
        }
      }
    }
  }

  private compare(l: unknown, op: string, r: unknown): boolean {
    const ln = Number(l), rn = Number(r)
    return op === '<' ? ln < rn : op === '>' ? ln > rn : op === '<=' ? ln <= rn : op === '>=' ? ln >= rn : ln === rn
  }

  private emit(type: SimEvent['type'], data: Record<string, unknown>) {
    this.events.push({ type, data, tick: this.tick })
  }
}

export function simulate(program: Program, options: SimulationOptions = {}): SimulationResult {
  return new Simulator(options).run(program)
}
