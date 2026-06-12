// AppyScript Simulation Engine — v5 (final)

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
  type: 'say'|'play'|'show'|'show_text'|'move'|'turn'|'stop'|'send'|'wait'|'log'
  data: Record<string, unknown>; tick: number
}
export interface SimulationResult {
  success: boolean; events: SimEvent[]; finalState: RobotState
  ticks: number; error?: string; executionTrace: TraceEntry[]
}
export interface TraceEntry {
  tick: number; blockKind: string; statementKind: string
  sourceLine?: number; stateSnapshot: Partial<RobotState>
}
export interface SimulationOptions {
  maxTicks?: number
  sensors?: Partial<Record<SensorName, number>>
  buttons?: { a?: boolean; b?: boolean }
  triggerEvents?: string[]
  askResponses?: Record<string, string>
}

const ms = (d: Duration) => d.unit==='ms'?d.value: d.unit==='s'?d.value*1000:d.value*60000

export class Simulator {
  private state!: RobotState
  private events: SimEvent[] = []
  private trace: TraceEntry[] = []
  private tick = 0
  private opts: SimulationOptions
  private max: number

  constructor(opts: SimulationOptions = {}) { this.opts=opts; this.max=opts.maxTicks??1000 }

  run(program: Program): SimulationResult {
    this.state = {
      position:{x:0,y:0,heading:0}, speed:0, moving:false,
      expression:'calm', displayText:'', variables:new Map(),
      lists:new Map(), memory:new Map(),
      sensors:{distance:100,light:50,temperature:20,touch:0,acceleration:0},
    }
    this.events=[]; this.trace=[]; this.tick=0
    if (this.opts.sensors) for (const [k,v] of Object.entries(this.opts.sensors)) this.state.sensors[k as SensorName]=v as number

    try {
      const defs=new Map<string,Block>(), starts:Block[]=[], polls:Block[]=[], fors:Block[]=[]
      for (const b of program.blocks) {
        if (b.kind==='define') defs.set(b.name,b)
        else if (b.kind==='when'&&b.trigger.kind==='start') starts.push(b)
        else if (b.kind==='when') polls.push(b)
        else if (b.kind==='forever') fors.push(b)
      }
      for (const b of starts) this.run_stmts(b.body, defs, 'start')
      for (let c=0; c<this.max; c++) {
        this.tick++
        for (const b of polls) if (b.kind==='when'&&this.evalTrigger(b.trigger)) this.run_stmts(b.body,defs,`when:${b.trigger.kind}`)
        for (const b of fors)  if (b.kind==='forever') this.run_stmts(b.body,defs,'forever')
        if (polls.length===0&&fors.length===0) break
      }
      return {success:true,events:this.events,finalState:this.state,ticks:this.tick,executionTrace:this.trace}
    } catch(e) {
      return {success:false,events:this.events,finalState:this.state,ticks:this.tick,error:e instanceof Error?e.message:String(e),executionTrace:this.trace}
    }
  }

  private evalTrigger(t: any): boolean {
    switch(t.kind) {
      case 'button_a': return this.opts.buttons?.a??false
      case 'button_b': return this.opts.buttons?.b??false
      case 'shaken':   return (this.opts.triggerEvents??[]).includes('shaken')
      case 'tilted':   return (this.opts.triggerEvents??[]).includes('tilted')
      case 'received': return (this.opts.triggerEvents??[]).includes('received')
      case 'timer':    return true
      case 'sensor':   return this.cmp(this.state.sensors[t.sensor as SensorName]??0, t.op, t.threshold)
      default: return false
    }
  }

  private run_stmts(ss: Statement[], defs: Map<string,Block>, ctx: string) {
    for (const s of ss) this.run_stmt(s,defs,ctx)
  }

  private run_stmt(s: Statement, defs: Map<string,Block>, ctx: string) {
    this.trace.push({tick:this.tick,blockKind:ctx,statementKind:s.kind,sourceLine:s.loc?.line,stateSnapshot:{position:{...this.state.position},expression:this.state.expression}})
    switch(s.kind) {
      case 'move': {
        const sp=s.speed??50, dur=s.duration?ms(s.duration):0
        this.state.moving=true; this.state.speed=sp
        this.ev('move',{direction:s.direction,speed:sp,durationMs:dur})
        if (dur>0) {
          const d=(sp/100)*(dur/1000)*20, h=this.state.position.heading*(Math.PI/180), sign=s.direction==='backward'?-1:1
          this.state.position.x+=Math.sin(h)*d*sign; this.state.position.y+=Math.cos(h)*d*sign
          this.state.moving=false; this.state.speed=0
        }; break }
      case 'turn': {
        const delta=s.direction==='right'?s.degrees:-s.degrees
        this.state.position.heading=(this.state.position.heading+delta+360)%360
        this.ev('turn',{direction:s.direction,degrees:s.degrees}); break }
      case 'stop':     this.state.moving=false; this.state.speed=0; this.ev('stop',{}); break
      case 'stop_all': this.state.moving=false; this.state.speed=0; this.ev('stop',{all:true}); break
      case 'say': {    const text=String(this.val(s.text)); this.state.displayText=text; this.ev('say',{text}); break }
      case 'play':     this.ev('play',{sound:s.sound}); break
      case 'show':     this.state.expression=s.expression; this.ev('show',{expression:s.expression}); break
      case 'show_text':{ const text=String(this.val(s.text)); this.state.displayText=text; this.ev('show_text',{text}); break }
      case 'show_number':{ const text=String(this.val(s.value)); this.state.displayText=text; this.ev('show_text',{text}); break }
      case 'wait':     this.ev('wait',{ms:ms(s.duration)}); break
      case 'wait_until': {
        let guard=0
        while (!this.evalCond(s.condition)&&guard++<1000) this.tick++
        break }
      case 'send':     this.ev('send',{message:this.val(s.message)}); break
      case 'let': {    const v=this.val(s.value); Array.isArray(v)?this.state.lists.set(s.name,v as any[]):this.state.variables.set(s.name,v as any); break }
      case 'set':      this.state.variables.set(s.name,this.val(s.value) as any); break
      case 'remember': this.state.memory.set(s.name,this.state.variables.get(s.name)??0); break
      case 'save':     this.state.memory.set(s.name,this.state.variables.get(s.name)??0); break
      case 'load': {   const saved=this.state.memory.get(s.name)??0; this.state.variables.set(s.name,saved as any); break }
      case 'list_add':{ const lst=this.state.lists.get(s.list)??[]; lst.push(this.val(s.value) as any); this.state.lists.set(s.list,lst); break }
      case 'do': {     const def=defs.get(s.name); if (def?.kind==='define') this.run_stmts(def.body,defs,`define:${s.name}`); break }
      case 'if':       if (this.evalCond(s.condition)) this.run_stmts(s.then,defs,ctx); else if (s.else) this.run_stmts(s.else,defs,ctx); break
      case 'repeat': { const n=Number(this.val(s.count)); for (let i=0;i<n&&this.tick<this.max;i++) { this.run_stmts(s.body,defs,ctx); this.tick++ } break }
      case 'while': {  let g=0; while (this.evalCond(s.condition)&&g++<1000) { this.run_stmts(s.body,defs,ctx); this.tick++ } break }
    }
  }

  private evalCond(c: Condition): boolean {
    switch(c.kind) {
      case 'sensor':   return this.cmp(this.state.sensors[c.sensor]??0, c.op, c.threshold)
      case 'variable': return this.cmp(this.state.variables.get(c.name)??0, c.op, this.val(c.value))
      case 'bool':     return c.value
      case 'not':      return !this.evalCond(c.condition)
      case 'and':      return this.evalCond(c.left)&&this.evalCond(c.right)
      case 'or':       return this.evalCond(c.left)||this.evalCond(c.right)
    }
  }

  private val(v: Value): number|string|boolean|any[] {
    switch(v.kind) {
      case 'number':    return v.value
      case 'string':    return v.value
      case 'bool':      return v.value
      case 'variable':  return this.state.variables.get(v.name)??0
      case 'sensor':    return this.state.sensors[v.sensor]??0
      case 'list':      return []
      case 'list_item': { const l=this.state.lists.get(v.list)??[]; return l[Number(this.val(v.index))-1]??0 }
      case 'list_size': return (this.state.lists.get(v.list)??[]).length
      case 'ask':       return this.opts.askResponses?.[String(this.val(v.prompt))]??''
      case 'round':     return Math.round(Number(this.val(v.value)))
      case 'abs':       return Math.abs(Number(this.val(v.value)))
      case 'min':       return Math.min(Number(this.val(v.left)), Number(this.val(v.right)))
      case 'max':       return Math.max(Number(this.val(v.left)), Number(this.val(v.right)))
      case 'length':    return String(this.val(v.value)).length
      case 'random':    { const mn=Number(this.val(v.min)),mx=Number(this.val(v.max)); return Math.floor(Math.random()*(mx-mn+1))+mn }
      case 'binary':    {
        const l=this.val(v.left), r=this.val(v.right)
        if (v.op==='+'&&(typeof l==='string'||typeof r==='string')) return String(l)+String(r)
        const ln=Number(l),rn=Number(r)
        return v.op==='+'?ln+rn: v.op==='-'?ln-rn: v.op==='*'?ln*rn: rn?ln/rn:0
      }
    }
  }

  private cmp(l: unknown, op: string, r: unknown): boolean {
    const ln=Number(l),rn=Number(r)
    return op==='<'?ln<rn: op==='>'?ln>rn: op==='<='?ln<=rn: op==='>='?ln>=rn: ln===rn
  }

  private ev(type: SimEvent['type'], data: Record<string,unknown>) {
    this.events.push({type,data,tick:this.tick})
  }
}

export function simulate(program: Program, options: SimulationOptions={}): SimulationResult {
  return new Simulator(options).run(program)
}
