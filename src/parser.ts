// AppyScript Parser — v3
// Added: pick random, list, item, size, add to list, say Value, show_text Value

import { Token, TokenKind } from './lexer'
import type {
  Program, Block, Statement, Trigger, Condition, Value,
  Duration, Direction, FaceExpression, SensorName, CompareOp, SourceLocation,
} from './ast'

export class ParseError extends Error {
  constructor(message: string, public line: number, public col: number) {
    super(`Line ${line}:${col} — ${message}`)
    this.name = 'ParseError'
  }
}

const FACE_EXPRESSIONS = new Set<string>([
  'happy','sad','thinking','excited','angry','alert','sleep','calm','confused','dizzy',
])

const SENSOR_NAMES: Record<string, SensorName> = {
  distance:'distance', light:'light', temperature:'temperature',
  touch:'touch', acceleration:'acceleration',
}

const SENSOR_TOKEN_KINDS = new Set<TokenKind>([
  'DISTANCE','LIGHT','TEMPERATURE','TOUCH','ACCELERATION',
])

export class Parser {
  private pos = 0
  constructor(private tokens: Token[]) {}

  private peek():   Token  { return this.tokens[this.pos] }
  private at(...k: TokenKind[]): boolean { return k.includes(this.peek().kind) }
  private loc(): SourceLocation { const t = this.peek(); return { line: t.line, col: t.col } }

  private eat(...kinds: TokenKind[]): Token {
    const t = this.peek()
    if (kinds.length && !kinds.includes(t.kind)) {
      throw new ParseError(
        `Expected ${kinds.join(' or ')}, got ${t.kind} ("${t.value}")`, t.line, t.col)
    }
    this.pos++; return t
  }

  private skipNewlines() { while (this.at('NEWLINE')) this.eat('NEWLINE') }
  private eatNewline()   { if (this.at('NEWLINE')) this.eat('NEWLINE') }

  parse(): Program {
    const blocks: Block[] = []
    const globalStmts: Statement[] = []
    this.skipNewlines()
    while (!this.at('EOF')) {
      // Top-level let/set/change/remember/say are global declarations
      // — wrap them into a synthetic 'when start' block
      if (this.at('LET', 'SET', 'CHANGE', 'REMEMBER', 'SAY')) {
        globalStmts.push(this.parseStatement())
      } else {
        blocks.push(this.parseBlock())
      }
      this.skipNewlines()
    }
    // Prepend global statements as a synthetic when-start block
    if (globalStmts.length > 0) {
      const existingStart = blocks.find(b => b.kind === 'when' && b.trigger.kind === 'start')
      if (existingStart && existingStart.kind === 'when') {
        // Merge into existing start block
        existingStart.body = [...globalStmts, ...existingStart.body]
      } else {
        blocks.unshift({ kind: 'when', trigger: { kind: 'start' }, body: globalStmts })
      }
    }
    return { blocks }
  }

  // ── Blocks ────────────────────────────────────────────────────────────────────

  private parseBlock(): Block {
    const t = this.peek(); const loc = this.loc()

    if (this.at('WHEN', 'ON')) {
      this.eat(); const trigger = this.parseTrigger()
      this.eatNewline(); const body = this.parseBody()
      return { kind: 'when', trigger, body, loc }
    }
    if (this.at('FOREVER')) {
      this.eat(); this.eatNewline(); const body = this.parseBody()
      return { kind: 'forever', body, loc }
    }
    if (this.at('DEFINE')) {
      this.eat(); const name = this.eat('IDENT').value
      this.eatNewline(); const body = this.parseBody()
      return { kind: 'define', name, body, loc }
    }
    if (this.at('EVERY', 'TIMER')) {
      // 'every 5s' at top level is sugar for 'when timer 5s'
      this.eat(); const interval = this.parseDuration()
      this.eatNewline(); const body = this.parseBody()
      return { kind: 'when', trigger: { kind: 'timer', interval }, body, loc }
    }
    throw new ParseError(`Expected 'when', 'forever', or 'define', got "${t.value}"`, t.line, t.col)
  }

  private parseBody(): Statement[] {
    const stmts: Statement[] = []
    this.skipNewlines()
    while (!this.at('END', 'EOF')) { stmts.push(this.parseStatement()); this.skipNewlines() }
    if (this.at('END')) { this.eat('END'); this.eatNewline() }
    return stmts
  }

  private parseIfBody(): { stmts: Statement[]; hadElse: boolean } {
    const stmts: Statement[] = []
    this.skipNewlines()
    while (!this.at('END','EOF','ELSE','OTHERWISE')) { stmts.push(this.parseStatement()); this.skipNewlines() }
    const hadElse = this.at('ELSE','OTHERWISE')
    if (!hadElse && this.at('END')) { this.eat('END'); this.eatNewline() }
    return { stmts, hadElse }
  }

  private parseCaseBody(): Statement[] {
    const stmts: Statement[] = []
    this.skipNewlines()
    while (!this.at('CASE','DEFAULT','END','EOF','ELSE','OTHERWISE')) {
      stmts.push(this.parseStatement()); this.skipNewlines()
    }
    return stmts
  }

  // ── Triggers ─────────────────────────────────────────────────────────────────

  private parseTrigger(): Trigger {
    const t = this.peek()

    if (this.at('BUTTON_A')) { this.eat(); if (this.at('PRESSED','RELEASED')) this.eat(); return { kind: 'button_a' } }
    if (this.at('BUTTON_B')) { this.eat(); if (this.at('PRESSED','RELEASED')) this.eat(); return { kind: 'button_b' } }
    if (this.at('SHAKEN'))   { this.eat(); return { kind: 'shaken' } }
    if (this.at('START','STARTS')) { this.eat(); return { kind: 'start' } }
    if (this.at('RECEIVED','RECEIVES')) { this.eat(); return { kind: 'received' } }
    if (this.at('TILTED')) {
      this.eat(); const dir = this.tryParseDirection()
      return { kind: 'tilted', direction: dir ?? undefined }
    }
    if (this.at('EVERY','TIMER')) {
      this.eat(); const interval = this.parseDuration()
      return { kind: 'timer', interval }
    }
    if (SENSOR_TOKEN_KINDS.has(t.kind)) {
      const sensor = SENSOR_NAMES[this.eat().value]!
      const op = this.parseCompareOp()
      const { value, unit } = this.parseMeasurement()
      return { kind: 'sensor', sensor, op, threshold: value, unit }
    }
    throw new ParseError(`Unknown trigger: "${t.value}"`, t.line, t.col)
  }

  // ── Statements ────────────────────────────────────────────────────────────────

  private parseStatement(): Statement {
    const t   = this.peek()
    const loc = this.loc()

    // MOVE / BACK / FORWARD
    if (this.at('MOVE','BACK','BACKWARD','FORWARD')) {
      let direction: Direction = 'forward'
      const first = this.eat()
      if (first.kind === 'BACK' || first.kind === 'BACKWARD') direction = 'backward'
      if      (this.at('FORWARD'))         { this.eat(); direction = 'forward'  }
      else if (this.at('BACKWARD','BACK')) { this.eat(); direction = 'backward' }
      else if (this.at('LEFT'))            { this.eat(); direction = 'left'     }
      else if (this.at('RIGHT'))           { this.eat(); direction = 'right'    }
      let speed: number | undefined, duration: Duration | undefined
      if (this.at('AT'))  { this.eat(); speed = this.parseSpeedValue() }
      if (this.at('FOR')) { this.eat(); duration = this.parseDuration() }
      this.eatNewline()
      return { kind: 'move', direction, speed, duration, loc }
    }

    if (this.at('TURN','SPIN')) {
      this.eat()
      const dirTok = this.eat('LEFT','RIGHT')
      const direction = dirTok.value as 'left'|'right'
      let degrees = 90
      if (this.at('NUMBER')) degrees = parseFloat(this.eat().value)
      else if (this.at('UNIT_S')) degrees = parseFloat(this.eat().value)
      this.eatNewline()
      return { kind: 'turn', direction, degrees, loc }
    }

    if (this.at('STOP')) { this.eat(); this.eatNewline(); return { kind: 'stop', loc } }

    // SAY — now accepts a Value (enables string + variable)
    if (this.at('SAY')) {
      this.eat()
      const text = this.parseValue()
      this.eatNewline()
      return { kind: 'say', text, loc }
    }

    if (this.at('PLAY')) {
      this.eat(); const sound = this.eat('STRING').value
      this.eatNewline(); return { kind: 'play', sound, loc }
    }

    if (this.at('SHOW')) {
      this.eat()
      if (this.at('TEXT')) {
        this.eat(); const text = this.parseValue()
        this.eatNewline(); return { kind: 'show_text', text, loc }
      }
      if (this.at('NUMBER')) {
        this.eat(); const value = this.parseValue()
        this.eatNewline(); return { kind: 'show_number', value, loc }
      }
      if (FACE_EXPRESSIONS.has(this.peek().value)) {
        const expr = this.eat().value as FaceExpression
        this.eatNewline(); return { kind: 'show', expression: expr, loc }
      }
      // show "text" — shorthand for show text
      if (this.at('STRING')) {
        const text = this.parseValue()
        this.eatNewline(); return { kind: 'show_text', text, loc }
      }
      throw new ParseError(`Expected expression or text after 'show'`, t.line, t.col)
    }

    if (this.at('WAIT')) {
      this.eat(); const duration = this.parseDuration()
      this.eatNewline(); return { kind: 'wait', duration, loc }
    }

    if (this.at('SEND')) {
      this.eat(); const message = this.parseValue()
      this.eatNewline(); return { kind: 'send', message, loc }
    }

    if (this.at('LET')) {
      this.eat(); const name = this.eat('IDENT').value
      this.eat('ASSIGN')
      const value = this.parseValue()
      this.eatNewline()
      return { kind: 'let', name, value, loc }
    }

    if (this.at('SET')) {
      this.eat(); const name = this.eat('IDENT').value
      this.eat('TO'); const value = this.parseValue()
      this.eatNewline(); return { kind: 'set', name, value, loc }
    }

    if (this.at('CHANGE')) {
      this.eat(); const name = this.eat('IDENT').value
      this.eat('BY'); const delta = this.parseValue()
      this.eatNewline()
      return {
        kind: 'set', name,
        value: { kind: 'binary', op: '+', left: { kind: 'variable', name }, right: delta },
        loc
      }
    }

    if (this.at('REMEMBER')) {
      this.eat(); const name = this.eat('IDENT').value
      this.eatNewline(); return { kind: 'remember', name, loc }
    }

    if (this.at('DO')) {
      this.eat(); const name = this.eat('IDENT').value
      this.eatNewline(); return { kind: 'do', name, loc }
    }

    // ADD X to listName
    if (this.at('ADD')) {
      this.eat(); const value = this.parseValue()
      this.eat('TO'); const list = this.eat('IDENT').value
      this.eatNewline(); return { kind: 'list_add', list, value, loc }
    }

    if (this.at('IF')) {
      this.eat(); const condition = this.parseCondition()
      if (this.at('THEN')) this.eat(); this.eatNewline()
      const { stmts: thenBody, hadElse } = this.parseIfBody()
      let elseBody: Statement[] | undefined
      if (hadElse) { this.eat('ELSE','OTHERWISE'); this.eatNewline(); elseBody = this.parseBody() }
      return { kind: 'if', condition, then: thenBody, else: elseBody, loc }
    }

    if (this.at('REPEAT')) {
      this.eat(); const count = this.parseValue()
      if (this.at('TIMES')) this.eat(); this.eatNewline()
      const body = this.parseBody()
      return { kind: 'repeat', count, body, loc }
    }

    if (this.at('WHILE')) {
      this.eat(); const condition = this.parseCondition()
      this.eatNewline(); const body = this.parseBody()
      return { kind: 'while', condition, body, loc }
    }


    // 'forever' as a nested statement — sugar for while True / infinite loop
    if (this.at('FOREVER')) {
      this.eat(); this.eatNewline()
      const body = this.parseBody()
      return { kind: 'while', condition: { kind: 'bool', value: true }, body, loc }
    }

    throw new ParseError(`Unknown statement: "${t.value}"`, t.line, t.col)
  }

  // ── Conditions ────────────────────────────────────────────────────────────────

  private parseCondition(): Condition {
    let left = this.parsePrimaryCondition()
    while (this.at('AND','OR')) {
      const op = this.eat().kind
      const right = this.parsePrimaryCondition()
      left = op === 'AND' ? { kind:'and', left, right } : { kind:'or', left, right }
    }
    return left
  }

  private parsePrimaryCondition(): Condition {
    const t = this.peek()
    if (this.at('NOT')) { this.eat(); return { kind:'not', condition: this.parsePrimaryCondition() } }
    if (SENSOR_TOKEN_KINDS.has(t.kind)) {
      const sensor = SENSOR_NAMES[this.eat().value]!
      const op = this.parseCompareOp()
      const { value, unit } = this.parseMeasurement()
      return { kind:'sensor', sensor, op, threshold: value, unit }
    }
    if (this.at('IDENT')) {
      const name = this.eat('IDENT').value
      const op   = this.parseCompareOp()
      const value = this.parseValue()
      return { kind:'variable', name, op, value }
    }
    if (this.at('YES','TRUE'))  { this.eat(); return { kind:'bool', value:true  } }
    if (this.at('NO','FALSE'))  { this.eat(); return { kind:'bool', value:false } }
    throw new ParseError(`Expected condition, got "${t.value}"`, t.line, t.col)
  }

  // ── Values ────────────────────────────────────────────────────────────────────

  private parseValue(): Value {
    let left = this.parsePrimaryValue()
    while (this.at('PLUS','MINUS','STAR','SLASH')) {
      const opMap: Record<string, '+'|'-'|'*'|'/'> = { PLUS:'+', MINUS:'-', STAR:'*', SLASH:'/' }
      const op = opMap[this.eat().kind]!
      const right = this.parsePrimaryValue()
      left = { kind:'binary', op, left, right }
    }
    return left
  }

  private parsePrimaryValue(): Value {
    const t = this.peek()

    // pick random X to Y
    if (this.at('PICK')) {
      this.eat()
      if (this.at('RANDOM')) this.eat()
      const min = this.parsePrimaryValue()
      if (this.at('TO')) this.eat()
      const max = this.parsePrimaryValue()
      return { kind:'random', min, max }
    }

    // item N of listName
    if (this.at('ITEM')) {
      this.eat()
      const index = this.parsePrimaryValue()
      this.eat('OF')
      const list = this.eat('IDENT').value
      return { kind:'list_item', list, index }
    }

    // size of listName
    if (this.at('SIZE')) {
      this.eat(); this.eat('OF')
      const list = this.eat('IDENT').value
      return { kind:'list_size', list }
    }

    // list literal
    if (this.at('LIST')) { this.eat(); return { kind:'list' } }

    if (this.at('NUMBER'))  return { kind:'number', value: parseFloat(this.eat().value) }
    if (this.at('PERCENT')) return { kind:'number', value: parseFloat(this.eat().value) }
    if (this.at('UNIT_S'))  return { kind:'number', value: parseFloat(this.eat().value) }
    if (this.at('UNIT_CM')) return { kind:'number', value: parseFloat(this.eat().value) }
    if (this.at('UNIT_MS')) return { kind:'number', value: parseFloat(this.eat().value) }
    if (this.at('STRING'))  return { kind:'string', value: this.eat().value }
    if (this.at('YES','TRUE'))  { this.eat(); return { kind:'bool', value:true  } }
    if (this.at('NO','FALSE'))  { this.eat(); return { kind:'bool', value:false } }
    if (this.at('IDENT'))   return { kind:'variable', name: this.eat().value }
    if (SENSOR_TOKEN_KINDS.has(t.kind)) {
      return { kind:'sensor', sensor: SENSOR_NAMES[this.eat().value]! }
    }
    throw new ParseError(`Expected value, got "${t.value}"`, t.line, t.col)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private parseDuration(): Duration {
    const t = this.peek()
    if (this.at('UNIT_S'))  return { value: parseFloat(this.eat().value), unit:'s'  }
    if (this.at('UNIT_MS')) return { value: parseFloat(this.eat().value), unit:'ms' }
    if (this.at('UNIT_M'))  return { value: parseFloat(this.eat().value), unit:'m'  }
    if (this.at('NUMBER')) {
      const n = parseFloat(this.eat().value)
      if (this.at('UNIT_S'))  { this.eat(); return { value:n, unit:'s'  } }
      if (this.at('UNIT_MS')) { this.eat(); return { value:n, unit:'ms' } }
      if (this.at('UNIT_M'))  { this.eat(); return { value:n, unit:'m'  } }
      return { value:n, unit:'s' }
    }
    throw new ParseError(`Expected duration (e.g. 2s, 500ms)`, t.line, t.col)
  }

  private parseSpeedValue(): number {
    if (this.at('PERCENT'))     return parseFloat(this.eat().value)
    if (this.at('FULL','FAST')) { this.eat(); return 100 }
    if (this.at('SLOW'))        { this.eat(); return 30  }
    if (this.at('HALF'))        { this.eat(); return 50  }
    if (this.at('NUMBER'))      return parseFloat(this.eat().value)
    return 50
  }

  private parseMeasurement(): { value: number; unit?: string } {
    const t = this.peek()
    if (this.at('UNIT_CM'))  return { value: parseFloat(this.eat().value), unit:'cm' }
    if (this.at('UNIT_S'))   return { value: parseFloat(this.eat().value), unit:'s'  }
    if (this.at('PERCENT'))  return { value: parseFloat(this.eat().value), unit:'%'  }
    if (this.at('NUMBER'))   return { value: parseFloat(this.eat().value) }
    throw new ParseError(`Expected measurement`, t.line, t.col)
  }

  private parseCompareOp(): CompareOp {
    const t = this.peek()
    const map: Partial<Record<TokenKind, CompareOp>> = {
      LT:'<', GT:'>', LTE:'<=', GTE:'>=', EQ:'==', ASSIGN:'==',
    }
    const op = map[t.kind]
    if (!op) throw new ParseError(`Expected comparison operator, got "${t.value}"`, t.line, t.col)
    this.eat(); return op
  }

  private tryParseDirection(): Direction | null {
    if (this.at('LEFT'))             { this.eat(); return 'left'     }
    if (this.at('RIGHT'))            { this.eat(); return 'right'    }
    if (this.at('FORWARD'))          { this.eat(); return 'forward'  }
    if (this.at('BACKWARD','BACK'))  { this.eat(); return 'backward' }
    return null
  }
}

export function parse(tokens: Token[]): Program {
  return new Parser(tokens).parse()
}

export interface ParsedMatchCase { conditionStr: string; body: Statement[] }
export function parseMatchBlock(_source: string): null { return null }
