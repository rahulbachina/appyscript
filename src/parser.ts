// AppyScript Parser — v6 (final)
// Added: home automation triggers (motion, door, presence, time, sun)
//        home automation actions (lights on/off/dim, thermostat, lock, unlock, scene, notify, set device)

import { Token, TokenKind } from './lexer'
import type {
  Program, Block, Statement, Trigger, Condition, Value,
  Duration, Direction, FaceExpression, SensorName, CompareOp, SourceLocation,
} from './ast'

export class ParseError extends Error {
  constructor(message: string, public line: number, public col: number) {
    super(`Line ${line}:${col} — ${message}`); this.name = 'ParseError'
  }
}

const FACES = new Set(['happy','sad','thinking','excited','angry','alert','sleep','calm','confused','dizzy'])
const SENSOR_NAMES: Record<string,SensorName> = {
  distance:'distance',light:'light',temperature:'temperature',touch:'touch',acceleration:'acceleration',
}
const SENSOR_K = new Set<TokenKind>(['DISTANCE','LIGHT','TEMPERATURE','TOUCH','ACCELERATION'])

export class Parser {
  private pos=0
  constructor(private tokens: Token[]) {}
  private peek() { return this.tokens[this.pos] }
  private at(...k: TokenKind[]) { return k.includes(this.peek().kind) }
  private loc(): SourceLocation { return {line:this.peek().line,col:this.peek().col} }
  private eat(...ks: TokenKind[]): Token {
    const t=this.peek()
    if(ks.length&&!ks.includes(t.kind))
      throw new ParseError(`Expected ${ks.join('/')} got "${t.value}"`,t.line,t.col)
    return this.tokens[this.pos++]
  }
  private skip() { while(this.at('NEWLINE')) this.eat() }
  private nl()   { if(this.at('NEWLINE')) this.eat() }

  // ── Program ───────────────────────────────────────────────────────────────────

  parse(): Program {
    const blocks: Block[]=[], globals: Statement[]=[]
    this.skip()
    while(!this.at('EOF')) {
      if(this.at('LET','SET','CHANGE','REMEMBER','SAVE','LOAD','SAY')) {
        globals.push(this.parseStatement())
      } else {
        blocks.push(this.parseBlock())
      }
      this.skip()
    }
    if(globals.length>0) {
      const existing=blocks.find(b=>b.kind==='when'&&b.trigger.kind==='start')
      if(existing?.kind==='when') existing.body=[...globals,...existing.body]
      else blocks.unshift({kind:'when',trigger:{kind:'start'},body:globals})
    }
    return {blocks}
  }

  // ── Blocks ────────────────────────────────────────────────────────────────────

  private parseBlock(): Block {
    const t=this.peek(),loc=this.loc()
    if(this.at('WHEN','ON'))  { this.eat(); const trigger=this.parseTrigger(); this.nl(); return {kind:'when',trigger,body:this.parseBody(),loc} }
    if(this.at('FOREVER'))    { this.eat(); this.nl(); return {kind:'forever',body:this.parseBody(),loc} }
    if(this.at('DEFINE'))     { this.eat(); const name=this.eat('IDENT').value; this.nl(); return {kind:'define',name,body:this.parseBody(),loc} }
    if(this.at('EVERY','TIMER')) { this.eat(); const iv=this.parseDuration(); this.nl(); return {kind:'when',trigger:{kind:'timer',interval:iv},body:this.parseBody(),loc} }
    throw new ParseError(`Expected 'when', 'forever', or 'define', got "${t.value}"`,t.line,t.col)
  }

  private parseBody(): Statement[] {
    const stmts: Statement[]=[]
    this.skip()
    while(!this.at('END','EOF')) { stmts.push(this.parseStatement()); this.skip() }
    if(this.at('END')) { this.eat(); this.nl() }
    return stmts
  }

  private parseIfBody(): {stmts:Statement[];hadElse:boolean} {
    const stmts: Statement[]=[]
    this.skip()
    while(!this.at('END','EOF','ELSE','OTHERWISE')) { stmts.push(this.parseStatement()); this.skip() }
    const hadElse=this.at('ELSE','OTHERWISE')
    if(!hadElse&&this.at('END')) { this.eat(); this.nl() }
    return {stmts,hadElse}
  }

  private parseCaseBody(): Statement[] {
    const stmts: Statement[]=[]
    this.skip()
    while(!this.at('CASE','DEFAULT','END','EOF','ELSE','OTHERWISE')) { stmts.push(this.parseStatement()); this.skip() }
    return stmts
  }

  // ── Triggers ──────────────────────────────────────────────────────────────────

  private parseTrigger(): Trigger {
    const t=this.peek()

    // Robot triggers
    if(this.at('BUTTON_A'))        { this.eat(); if(this.at('PRESSED','RELEASED')) this.eat(); return {kind:'button_a'} }
    if(this.at('BUTTON_B'))        { this.eat(); if(this.at('PRESSED','RELEASED')) this.eat(); return {kind:'button_b'} }
    if(this.at('SHAKEN'))          { this.eat(); return {kind:'shaken'} }
    if(this.at('START','STARTS'))  { this.eat(); return {kind:'start'} }
    if(this.at('RECEIVED','RECEIVES')) { this.eat(); return {kind:'received'} }
    if(this.at('TILTED'))          { this.eat(); return {kind:'tilted',direction:this.tryDir()??undefined} }
    if(this.at('EVERY','TIMER'))   { this.eat(); return {kind:'timer',interval:this.parseDuration()} }
    if(SENSOR_K.has(t.kind)) {
      const sensor=SENSOR_NAMES[this.eat().value]!
      const op=this.parseOp(); const {value,unit}=this.parseMeasure()
      return {kind:'sensor',sensor,op,threshold:value,unit}
    }

    // Home triggers
    // when motion detected [in "room"]
    if(this.at('MOTION')) {
      this.eat(); if(this.at('DETECTED')) this.eat()
      let room: string|undefined
      if(this.at('AT')||(this.at('IDENT')&&(this.peek().value==='in'||this.peek().value==='at'))) { this.eat(); if(this.at('STRING')||this.at('IDENT')) room=this.eat().value }
      return {kind:'motion',room}
    }

    // when door opens / when door closes / when "front door" opens
    if(this.at('DOOR')||this.at('STRING')&&this.lookahead('OPENS','CLOSES')) {
      let door: string|undefined
      if(this.at('STRING')) door=this.eat().value
      else this.eat('DOOR')
      if(this.at('DOOR')) this.eat()
      const event: 'opens'|'closes' = this.at('OPENS') ? (this.eat(),'opens') : (this.eat('CLOSES'),'closes')
      return {kind:'door',event,door}
    }

    // when someone arrives / when someone leaves
    if(this.at('ARRIVES')||this.at('LEAVES')) {
      const event: 'arrives'|'leaves' = this.at('ARRIVES') ? (this.eat(),'arrives') : (this.eat(),'leaves')
      return {kind:'presence',event}
    }

    // when time is 07:30
    if(this.at('IDENT')&&this.peek().value==='time') {
      this.eat()
      if(this.at('ASSIGN')||this.at('IDENT')) this.eat() // eat 'is' or '='
      const {hour,minute}=this.parseTime()
      return {kind:'time_of_day',hour,minute}
    }

    // when sun rises / when sun sets
    if(this.at('SUN')) {
      this.eat()
      const event: 'rises'|'sets' = this.at('RISES') ? (this.eat(),'rises') : (this.eat('SETS'),'sets')
      return {kind:'sun',event}
    }

    throw new ParseError(`Unknown trigger: "${t.value}"`,t.line,t.col)
  }

  private lookahead(...kinds: TokenKind[]): boolean {
    return kinds.includes(this.tokens[this.pos+1]?.kind)
  }

  private parseTime(): {hour:number;minute:number} {
    // Expects HH:MM as number, colon, number OR as a single string "07:30"
    if(this.at('STRING')) {
      const parts=this.eat().value.split(':')
      return {hour:parseInt(parts[0]),minute:parseInt(parts[1]??'0')}
    }
    const hour=parseFloat(this.eat('NUMBER').value)
    if(this.at('COLON')) this.eat()
    const minute=this.at('NUMBER') ? parseFloat(this.eat().value) : 0
    return {hour,minute}
  }

  // ── Statements ────────────────────────────────────────────────────────────────

  private parseStatement(): Statement {
    const t=this.peek(), loc=this.loc()

    // Robot movement
    if(this.at('MOVE','BACK','BACKWARD','FORWARD')) {
      let dir: Direction='forward'
      const first=this.eat()
      if(first.kind==='BACK'||first.kind==='BACKWARD') dir='backward'
      if(this.at('FORWARD'))         {this.eat();dir='forward'}
      else if(this.at('BACKWARD','BACK')) {this.eat();dir='backward'}
      else if(this.at('LEFT'))       {this.eat();dir='left'}
      else if(this.at('RIGHT'))      {this.eat();dir='right'}
      let speed: number|undefined, duration: Duration|undefined
      if(this.at('AT'))  {this.eat();speed=this.parseSpeed()}
      if(this.at('FOR')) {this.eat();duration=this.parseDuration()}
      this.nl(); return {kind:'move',direction:dir,speed,duration,loc}
    }


    // turn on/off lights (home) OR turn left/right (robot) — check home first
    if(this.at('TURN')) {
      // Peek ahead: if next is ON or OFF → home automation
      const nextKind = this.tokens[this.pos+1]?.kind
      if(nextKind==='ON') {
        this.eat(); this.eat() // TURN ON
        if(this.at('LIGHTS')) this.eat()
        const room=this.optRoom(); this.nl()
        return {kind:'lights_on',room,loc}
      }
      if(nextKind==='OFF') {
        this.eat(); this.eat() // TURN OFF
        if(this.at('LIGHTS')) this.eat()
        const room=this.optRoom(); this.nl()
        return {kind:'lights_off',room,loc}
      }
      // Fall through to robot turn handler below
    }

    if(this.at('TURN','SPIN')) {
      this.eat(); const dir=this.eat('LEFT','RIGHT').value as 'left'|'right'
      let deg=90
      if(this.at('NUMBER')) deg=parseFloat(this.eat().value)
      else if(this.at('UNIT_S')) deg=parseFloat(this.eat().value)
      this.nl(); return {kind:'turn',direction:dir,degrees:deg,loc}
    }

    // stop / stop all
    if(this.at('STOP')) {
      this.eat()
      if(this.at('ALL')) {this.eat();this.nl();return {kind:'stop_all',loc}}
      this.nl(); return {kind:'stop',loc}
    }


    // dim lights [in "room"] to N%
    if(this.at('DIM')) {
      this.eat(); if(this.at('LIGHTS')) this.eat()
      const room=this.optRoom()
      if(this.at('TO')) this.eat()
      const level=this.parseValue()
      this.nl(); return {kind:'lights_dim',room,level,loc}
    }

    // lights on / lights off / lights to N%
    if(this.at('LIGHTS')) {
      this.eat()
      if(this.at('ON'))  {this.eat();const room=this.optRoom();this.nl();return {kind:'lights_on',room,loc}}
      if(this.at('OFF')) {this.eat();const room=this.optRoom();this.nl();return {kind:'lights_off',room,loc}}
      if(this.at('TO'))  {this.eat();const level=this.parseValue();this.nl();return {kind:'lights_dim',level,loc}}
      this.nl(); return {kind:'lights_on',loc}
    }

    // thermostat to N / set thermostat to N
    if(this.at('THERMOSTAT')) {
      this.eat(); if(this.at('TO','SET')) this.eat()
      const temperature=this.parseValue(); this.nl()
      return {kind:'thermostat',temperature,loc}
    }

    // lock [device] / unlock [device]
    if(this.at('LOCK')) {
      this.eat()
      const device=this.at('IDENT')||this.at('STRING')||this.at('THERMOSTAT') ? this.eat().value : undefined
      this.nl(); return {kind:'lock',device,loc}
    }
    if(this.at('UNLOCK')) {
      this.eat()
      const device=this.at('IDENT')||this.at('STRING') ? this.eat().value : undefined
      this.nl(); return {kind:'unlock',device,loc}
    }

    // scene "evening"
    if(this.at('SCENE')) {
      this.eat()
      const name=this.eat('STRING').value; this.nl()
      return {kind:'scene',name,loc}
    }

    // notify "text" / notify {value}
    if(this.at('NOTIFY')) {
      this.eat(); const message=this.parseValue(); this.nl()
      return {kind:'notify',message,loc}
    }

    // set device "entity_id" to value
    if(this.at('SET')&&this.tokens[this.pos+1]?.kind==='IDENT'&&this.tokens[this.pos+1]?.value==='device') {
      this.eat(); this.eat() // SET DEVICE
      const device=this.eat('STRING','IDENT').value
      if(this.at('TO')) this.eat()
      const state=this.parseValue(); this.nl()
      return {kind:'set_device',device,state,loc}
    }

    if(this.at('SAY'))  {this.eat();const text=this.parseValue();this.nl();return {kind:'say',text,loc}}
    if(this.at('PLAY')) {this.eat();const sound=this.eat('STRING').value;this.nl();return {kind:'play',sound,loc}}

    if(this.at('SHOW')) {
      this.eat()
      if(this.at('TEXT'))      {this.eat();const text=this.parseValue();this.nl();return {kind:'show_text',text,loc}}
      if(this.at('NUMBER_KW')) {this.eat();const value=this.parseValue();this.nl();return {kind:'show_number',value,loc}}
      if(this.at('STRING'))    {const text=this.parseValue();this.nl();return {kind:'show_text',text,loc}}
      if(FACES.has(this.peek().value)){const expr=this.eat().value as FaceExpression;this.nl();return {kind:'show',expression:expr,loc}}
      throw new ParseError(`Expected expression name after 'show'`,t.line,t.col)
    }

    if(this.at('WAIT')) {
      this.eat()
      if(this.at('UNTIL')) {this.eat();const condition=this.parseCondition();this.nl();return {kind:'wait_until',condition,loc}}
      const duration=this.parseDuration();this.nl();return {kind:'wait',duration,loc}
    }

    if(this.at('SEND'))     {this.eat();const msg=this.parseValue();this.nl();return {kind:'send',message:msg,loc}}
    if(this.at('LET'))      {this.eat();const name=this.eat('IDENT').value;this.eat('ASSIGN');const value=this.parseValue();this.nl();return {kind:'let',name,value,loc}}
    if(this.at('SET')) {
      this.eat()
      // 'set thermostat to N' → thermostat statement
      if(this.at('THERMOSTAT')) {
        this.eat(); if(this.at('TO')) this.eat()
        const temperature=this.parseValue(); this.nl()
        return {kind:'thermostat',temperature,loc}
      }
      // 'set lights to N%' → dim lights
      if(this.at('LIGHTS')) {
        this.eat(); if(this.at('TO')) this.eat()
        const level=this.parseValue(); this.nl()
        return {kind:'lights_dim',level,loc}
      }
      // standard 'set varname to value'
      const name=this.eat('IDENT').value; this.eat('TO')
      const value=this.parseValue(); this.nl()
      return {kind:'set',name,value,loc}
    }
    if(this.at('CHANGE'))   {this.eat();const name=this.eat('IDENT').value;this.eat('BY');const delta=this.parseValue();this.nl();return {kind:'set',name,value:{kind:'binary',op:'+',left:{kind:'variable',name},right:delta},loc}}
    if(this.at('REMEMBER')) {this.eat();const name=this.eat('IDENT').value;this.nl();return {kind:'remember',name,loc}}
    if(this.at('SAVE'))     {this.eat();const name=this.eat('IDENT').value;this.nl();return {kind:'save',name,loc}}
    if(this.at('LOAD'))     {this.eat();const name=this.eat('IDENT').value;this.nl();return {kind:'load',name,loc}}
    if(this.at('DO'))       {this.eat();const name=this.eat('IDENT').value;this.nl();return {kind:'do',name,loc}}
    if(this.at('ADD'))      {this.eat();const value=this.parseValue();this.eat('TO');const list=this.eat('IDENT').value;this.nl();return {kind:'list_add',list,value,loc}}

    if(this.at('IF')) {
      this.eat();const condition=this.parseCondition()
      if(this.at('THEN')) this.eat();this.nl()
      const {stmts:thenBody,hadElse}=this.parseIfBody()
      let elseBody: Statement[]|undefined
      if(hadElse){this.eat('ELSE','OTHERWISE');this.nl();elseBody=this.parseBody()}
      return {kind:'if',condition,then:thenBody,else:elseBody,loc}
    }

    if(this.at('REPEAT')) {this.eat();const count=this.parseValue();if(this.at('TIMES'))this.eat();this.nl();return {kind:'repeat',count,body:this.parseBody(),loc}}
    if(this.at('WHILE'))  {this.eat();const condition=this.parseCondition();this.nl();return {kind:'while',condition,body:this.parseBody(),loc}}
    if(this.at('FOREVER')){this.eat();this.nl();return {kind:'while',condition:{kind:'bool',value:true},body:this.parseBody(),loc}}

    if(this.at('MATCH')) {this.eat();const subject=this.parseValue();this.nl();this.skip();return this.parseMatch(subject,loc)}

    throw new ParseError(`Unknown statement: "${t.value}"`,t.line,t.col)
  }

  // ── Match/Case ────────────────────────────────────────────────────────────────

  private parseMatch(subject: Value, loc: SourceLocation): Statement {
    const arms: Array<{condition:Condition;body:Statement[]}>=[]
    let elseBody: Statement[]|undefined
    while(!this.at('END','EOF')) {
      if(this.at('ELSE','OTHERWISE','DEFAULT')){this.eat();this.nl();elseBody=this.parseCaseBody();break}
      if(this.at('CASE')){this.eat();const condition=this.parseCaseCondition(subject);this.nl();arms.push({condition,body:this.parseCaseBody()})}
      else this.skip()
    }
    if(this.at('END')){this.eat();this.nl()}
    let current: Statement|undefined
    for(let i=arms.length-1;i>=0;i--){
      const {condition,body}=arms[i]
      const elsePart=i===arms.length-1?elseBody:(current?[current]:undefined)
      current={kind:'if',condition,then:body,else:elsePart,loc}
    }
    return current??{kind:'if',condition:{kind:'bool',value:false},then:[],else:elseBody,loc}
  }

  private parseCaseCondition(subject: Value): Condition {
    const t=this.peek()
    if(this.at('NUMBER','UNIT_CM','UNIT_S','UNIT_MS','PERCENT')){
      const {value:from}=this.parseMeasure()
      if(this.at('TO')){this.eat();const {value:to}=this.parseMeasure();return {kind:'and',left:this.makeCond(subject,'>=',from),right:this.makeCond(subject,'<=',to)}}
      return this.makeCond(subject,'==',from)
    }
    if(this.at('LT','GT','LTE','GTE','EQ','ASSIGN')){const op=this.parseOp();const {value}=this.parseMeasure();return this.makeCond(subject,op,value)}
    throw new ParseError(`Expected case condition`,t.line,t.col)
  }

  private makeCond(subject: Value, op: CompareOp, threshold: number): Condition {
    if(subject.kind==='sensor')   return {kind:'sensor',sensor:subject.sensor,op,threshold}
    if(subject.kind==='variable') return {kind:'variable',name:subject.name,op,value:{kind:'number',value:threshold}}
    return {kind:'variable',name:'_subject',op,value:{kind:'number',value:threshold}}
  }

  // ── Conditions ────────────────────────────────────────────────────────────────

  private parseCondition(): Condition {
    let left=this.parsePrimCond()
    while(this.at('AND','OR')){const op=this.eat().kind;const right=this.parsePrimCond();left=op==='AND'?{kind:'and',left,right}:{kind:'or',left,right}}
    return left
  }

  private parsePrimCond(): Condition {
    const t=this.peek()
    if(this.at('NOT')) {this.eat();return {kind:'not',condition:this.parsePrimCond()}}
    if(SENSOR_K.has(t.kind)){const sensor=SENSOR_NAMES[this.eat().value]!;const op=this.parseOp();const {value,unit}=this.parseMeasure();return {kind:'sensor',sensor,op,threshold:value,unit}}
    if(this.at('IDENT')){const name=this.eat().value;const op=this.parseOp();const value=this.parseValue();return {kind:'variable',name,op,value}}
    if(this.at('YES','TRUE')){this.eat();return {kind:'bool',value:true}}
    if(this.at('NO','FALSE')){this.eat();return {kind:'bool',value:false}}
    throw new ParseError(`Expected condition, got "${t.value}"`,t.line,t.col)
  }

  // ── Values ────────────────────────────────────────────────────────────────────

  private parseValue(): Value {
    let left=this.parsePrimVal()
    while(this.at('PLUS','MINUS','STAR','SLASH')){
      const op: Record<string,'+'|'-'|'*'|'/'> = {PLUS:'+',MINUS:'-',STAR:'*',SLASH:'/'}
      left={kind:'binary',op:op[this.eat().kind]!,left,right:this.parsePrimVal()}
    }
    return left
  }

  private parsePrimVal(): Value {
    const t=this.peek()
    if(this.at('PICK'))   {this.eat();if(this.at('RANDOM'))this.eat();const mn=this.parsePrimVal();if(this.at('TO'))this.eat();return {kind:'random',min:mn,max:this.parsePrimVal()}}
    if(this.at('ITEM'))   {this.eat();const idx=this.parsePrimVal();this.eat('OF');return {kind:'list_item',list:this.eat('IDENT').value,index:idx}}
    if(this.at('SIZE'))   {this.eat();this.eat('OF');return {kind:'list_size',list:this.eat('IDENT').value}}
    if(this.at('LENGTH')) {this.eat();if(this.at('OF'))this.eat();return {kind:'length',value:this.parsePrimVal()}}
    if(this.at('LIST'))   {this.eat();return {kind:'list'}}
    if(this.at('ASK'))    {this.eat();return {kind:'ask',prompt:this.parsePrimVal()}}
    if(this.at('ROUND'))  {this.eat();return {kind:'round',value:this.parsePrimVal()}}
    if(this.at('ABS'))    {this.eat();return {kind:'abs',value:this.parsePrimVal()}}
    if(this.at('MIN'))    {this.eat();if(this.at('OF'))this.eat();const left=this.parsePrimVal();if(this.at('AND'))this.eat();return {kind:'min',left,right:this.parsePrimVal()}}
    if(this.at('MAX'))    {this.eat();if(this.at('OF'))this.eat();const left=this.parsePrimVal();if(this.at('AND'))this.eat();return {kind:'max',left,right:this.parsePrimVal()}}
    if(this.at('NUMBER'))  return {kind:'number',value:parseFloat(this.eat().value)}
    if(this.at('PERCENT')) return {kind:'number',value:parseFloat(this.eat().value)}
    if(this.at('UNIT_S'))  return {kind:'number',value:parseFloat(this.eat().value)}
    if(this.at('UNIT_CM')) return {kind:'number',value:parseFloat(this.eat().value)}
    if(this.at('UNIT_MS')) return {kind:'number',value:parseFloat(this.eat().value)}
    if(this.at('STRING'))  return {kind:'string',value:this.eat().value}
    if(this.at('YES','TRUE')){this.eat();return {kind:'bool',value:true}}
    if(this.at('NO','FALSE')){this.eat();return {kind:'bool',value:false}}
    if(this.at('IDENT'))   return {kind:'variable',name:this.eat().value}
    if(SENSOR_K.has(t.kind)) return {kind:'sensor',sensor:SENSOR_NAMES[this.eat().value]!}
    throw new ParseError(`Expected value, got "${t.value}"`,t.line,t.col)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private optRoom(): string|undefined {
    if(this.at('AT')||(this.at('IDENT')&&(this.peek().value==='in'||this.peek().value==='at'))) { this.eat(); return this.at('STRING')||this.at('IDENT') ? this.eat().value : undefined }
    return undefined
  }

  private parseDuration(): Duration {
    const t=this.peek()
    if(this.at('UNIT_S'))  return {value:parseFloat(this.eat().value),unit:'s'}
    if(this.at('UNIT_MS')) return {value:parseFloat(this.eat().value),unit:'ms'}
    if(this.at('UNIT_M'))  return {value:parseFloat(this.eat().value),unit:'m'}
    if(this.at('NUMBER')){
      const n=parseFloat(this.eat().value)
      if(this.at('UNIT_S')){this.eat();return {value:n,unit:'s'}}
      if(this.at('UNIT_MS')){this.eat();return {value:n,unit:'ms'}}
      if(this.at('UNIT_M')){this.eat();return {value:n,unit:'m'}}
      return {value:n,unit:'s'}
    }
    throw new ParseError(`Expected duration`,t.line,t.col)
  }

  private parseSpeed(): number {
    if(this.at('PERCENT'))     return parseFloat(this.eat().value)
    if(this.at('FULL','FAST')) {this.eat();return 100}
    if(this.at('SLOW'))        {this.eat();return 30}
    if(this.at('HALF'))        {this.eat();return 50}
    if(this.at('NUMBER'))      return parseFloat(this.eat().value)
    return 50
  }

  private parseMeasure(): {value:number;unit?:string} {
    const t=this.peek()
    if(this.at('UNIT_CM'))  return {value:parseFloat(this.eat().value),unit:'cm'}
    if(this.at('UNIT_S'))   return {value:parseFloat(this.eat().value),unit:'s'}
    if(this.at('PERCENT'))  return {value:parseFloat(this.eat().value),unit:'%'}
    if(this.at('NUMBER'))   return {value:parseFloat(this.eat().value)}
    throw new ParseError(`Expected measurement`,t.line,t.col)
  }

  private parseOp(): CompareOp {
    const t=this.peek()
    const m: Partial<Record<TokenKind,CompareOp>>={LT:'<',GT:'>',LTE:'<=',GTE:'>=',EQ:'==',ASSIGN:'=='}
    const op=m[t.kind]
    if(!op) throw new ParseError(`Expected comparison operator, got "${t.value}"`,t.line,t.col)
    this.eat();return op
  }

  private tryDir(): Direction|null {
    if(this.at('LEFT'))            {this.eat();return 'left'}
    if(this.at('RIGHT'))           {this.eat();return 'right'}
    if(this.at('FORWARD'))         {this.eat();return 'forward'}
    if(this.at('BACKWARD','BACK')) {this.eat();return 'backward'}
    return null
  }
}

export function parse(tokens: Token[]): Program {
  return new Parser(tokens).parse()
}
