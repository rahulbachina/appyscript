// AppyScript Parser — v2
// Blocks opened by header, closed by 'end'. No significant whitespace.
// Now threads SourceLocation into Block and Statement nodes for diagnostics + source maps.

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
  'happy', 'sad', 'thinking', 'excited', 'angry',
  'alert', 'sleep', 'calm', 'confused', 'dizzy',
])

const SENSOR_NAMES: Record<string, SensorName> = {
  distance: 'distance', light: 'light', temperature: 'temperature',
  touch: 'touch', acceleration: 'acceleration',
}

const SENSOR_TOKEN_KINDS = new Set<TokenKind>([
  'DISTANCE', 'LIGHT', 'TEMPERATURE', 'TOUCH', 'ACCELERATION',
])

export class Parser {
  private pos = 0

  constructor(private tokens: Token[]) {}

  private peek(): Token { return this.tokens[this.pos] }

  private at(...kinds: TokenKind[]): boolean {
    return kinds.includes(this.peek().kind)
  }

  private loc(): SourceLocation {
    const t = this.peek()
    return { line: t.line, col: t.col }
  }

  private eat(...kinds: TokenKind[]): Token {
    const t = this.peek()
    if (kinds.length && !kinds.includes(t.kind)) {
      throw new ParseError(
        `Expected ${kinds.join(' or ')}, got ${t.kind} ("${t.value}")`,
        t.line, t.col
      )
    }
    this.pos++
    return t
  }

  private skipNewlines() {
    while (this.at('NEWLINE')) this.eat('NEWLINE')
  }

  parse(): Program {
    const blocks: Block[] = []
    this.skipNewlines()
    while (!this.at('EOF')) {
      blocks.push(this.parseBlock())
      this.skipNewlines()
    }
    return { blocks }
  }

  // ── Top-level blocks ────────────────────────────────────────────────────────

  private parseBlock(): Block {
    const t = this.peek()
    const blockLoc = this.loc()

    if (this.at('WHEN', 'ON')) {
      this.eat()
      const trigger = this.parseTrigger()
      this.eatNewline()
      const body = this.parseBody()
      return { kind: 'when', trigger, body, loc: blockLoc }
    }

    if (this.at('FOREVER')) {
      this.eat()
      this.eatNewline()
      const body = this.parseBody()
      return { kind: 'forever', body, loc: blockLoc }
    }

    if (this.at('DEFINE')) {
      this.eat()
      const name = this.eat('IDENT').value
      this.eatNewline()
      const body = this.parseBody()
      return { kind: 'define', name, body, loc: blockLoc }
    }

    throw new ParseError(
      `Expected 'when', 'forever', or 'define', got "${t.value}"`,
      t.line, t.col
    )
  }

  private parseBody(): Statement[] {
    const stmts: Statement[] = []
    this.skipNewlines()
    while (!this.at('END', 'EOF')) {
      stmts.push(this.parseStatement())
      this.skipNewlines()
    }
    if (this.at('END')) { this.eat('END'); this.eatNewline() }
    return stmts
  }

  /** Like parseBody() but also stops before ELSE/OTHERWISE (leaving them in stream) */
  private parseIfBody(): { stmts: Statement[]; hadElse: boolean } {
    const stmts: Statement[] = []
    this.skipNewlines()
    while (!this.at('END', 'EOF', 'ELSE', 'OTHERWISE')) {
      stmts.push(this.parseStatement())
      this.skipNewlines()
    }
    const hadElse = this.at('ELSE', 'OTHERWISE')
    if (!hadElse && this.at('END')) { this.eat('END'); this.eatNewline() }
    return { stmts, hadElse }
  }

  // ── Triggers ────────────────────────────────────────────────────────────────

  private parseTrigger(): Trigger {
    const t = this.peek()

    if (this.at('BUTTON_A')) {
      this.eat()
      if (this.at('PRESSED', 'RELEASED')) this.eat()
      return { kind: 'button_a' }
    }
    if (this.at('BUTTON_B')) {
      this.eat()
      if (this.at('PRESSED', 'RELEASED')) this.eat()
      return { kind: 'button_b' }
    }

    if (this.at('SHAKEN'))            { this.eat(); return { kind: 'shaken' } }
    if (this.at('START', 'STARTS'))   { this.eat(); return { kind: 'start' } }
    if (this.at('RECEIVED', 'RECEIVES')) { this.eat(); return { kind: 'received' } }

    if (this.at('TILTED')) {
      this.eat()
      const dir = this.tryParseDirection()
      return { kind: 'tilted', direction: dir ?? undefined }
    }

    if (this.at('EVERY', 'TIMER')) {
      this.eat()
      const interval = this.parseDuration()
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

  // ── Statements ──────────────────────────────────────────────────────────────

  private parseStatement(): Statement {
    const t = this.peek()
    const stmtLoc = this.loc()

    if (this.at('MOVE', 'BACK', 'BACKWARD', 'FORWARD')) {
      let direction: Direction = 'forward'
      const first = this.eat()
      if (first.kind === 'BACK' || first.kind === 'BACKWARD') direction = 'backward'
      if (this.at('FORWARD'))         { this.eat(); direction = 'forward' }
      else if (this.at('BACKWARD', 'BACK')) { this.eat(); direction = 'backward' }
      else if (this.at('LEFT'))       { this.eat(); direction = 'left' }
      else if (this.at('RIGHT'))      { this.eat(); direction = 'right' }

      let speed: number | undefined
      let duration: Duration | undefined
      if (this.at('AT'))  { this.eat(); speed = this.parseSpeedValue() }
      if (this.at('FOR')) { this.eat(); duration = this.parseDuration() }
      this.eatNewline()
      return { kind: 'move', direction, speed, duration, loc: stmtLoc }
    }

    if (this.at('TURN', 'SPIN')) {
      this.eat()
      const dirTok = this.eat('LEFT', 'RIGHT')
      const direction = dirTok.value as 'left' | 'right'
      let degrees = 90
      if (this.at('DEGREES', 'NUMBER')) degrees = parseFloat(this.eat().value)
      this.eatNewline()
      return { kind: 'turn', direction, degrees, loc: stmtLoc }
    }

    if (this.at('STOP'))  { this.eat(); this.eatNewline(); return { kind: 'stop', loc: stmtLoc } }

    if (this.at('SAY')) {
      this.eat()
      const text = this.eat('STRING').value
      this.eatNewline()
      return { kind: 'say', text, loc: stmtLoc }
    }

    if (this.at('PLAY')) {
      this.eat()
      const sound = this.eat('STRING').value
      this.eatNewline()
      return { kind: 'play', sound, loc: stmtLoc }
    }

    if (this.at('SHOW')) {
      this.eat()
      if (this.at('TEXT')) {
        this.eat()
        const text = this.eat('STRING').value
        this.eatNewline()
        return { kind: 'show_text', text, loc: stmtLoc }
      }
      if (this.at('STRING')) {
        const text = this.eat('STRING').value
        this.eatNewline()
        return { kind: 'show_text', text, loc: stmtLoc }
      }
      if (FACE_EXPRESSIONS.has(this.peek().value)) {
        const expr = this.eat().value as FaceExpression
        this.eatNewline()
        return { kind: 'show', expression: expr, loc: stmtLoc }
      }
      throw new ParseError(`Expected expression name after 'show'`, t.line, t.col)
    }

    if (this.at('WAIT')) {
      this.eat()
      const duration = this.parseDuration()
      this.eatNewline()
      return { kind: 'wait', duration, loc: stmtLoc }
    }

    if (this.at('SEND')) {
      this.eat()
      const message = this.parseValue()
      this.eatNewline()
      return { kind: 'send', message, loc: stmtLoc }
    }

    if (this.at('LET')) {
      this.eat()
      const name = this.eat('IDENT').value
      this.eat('ASSIGN')
      const value = this.parseValue()
      this.eatNewline()
      return { kind: 'let', name, value, loc: stmtLoc }
    }

    if (this.at('SET')) {
      this.eat()
      const name = this.eat('IDENT').value
      this.eat('TO')
      const value = this.parseValue()
      this.eatNewline()
      return { kind: 'set', name, value, loc: stmtLoc }
    }

    if (this.at('CHANGE')) {
      this.eat()
      const name = this.eat('IDENT').value
      this.eat('BY')
      const delta = this.parseValue()
      this.eatNewline()
      return {
        kind: 'set', name,
        value: { kind: 'binary', op: '+', left: { kind: 'variable', name }, right: delta },
        loc: stmtLoc
      }
    }

    if (this.at('REMEMBER')) {
      this.eat()
      const name = this.eat('IDENT').value
      this.eatNewline()
      return { kind: 'remember', name, loc: stmtLoc }
    }

    if (this.at('DO')) {
      this.eat()
      const name = this.eat('IDENT').value
      this.eatNewline()
      return { kind: 'do', name, loc: stmtLoc }
    }

    if (this.at('IF')) {
      this.eat()
      const condition = this.parseCondition()
      if (this.at('THEN')) this.eat()
      this.eatNewline()
      // then-body ends at ELSE, OTHERWISE, or END
      const { stmts: thenBody, hadElse } = this.parseIfBody()
      let elseBody: Statement[] | undefined
      if (hadElse) {
        this.eat('ELSE', 'OTHERWISE')
        this.eatNewline()
        elseBody = this.parseBody()
      }
      return { kind: 'if', condition, then: thenBody, else: elseBody, loc: stmtLoc }
    }

    if (this.at('REPEAT')) {
      this.eat()
      const count = this.parseValue()
      if (this.at('TIMES')) this.eat()
      this.eatNewline()
      const body = this.parseBody()
      return { kind: 'repeat', count, body, loc: stmtLoc }
    }

    if (this.at('WHILE')) {
      this.eat()
      const condition = this.parseCondition()
      this.eatNewline()
      const body = this.parseBody()
      return { kind: 'while', condition, body, loc: stmtLoc }
    }

    throw new ParseError(`Unknown statement: "${t.value}"`, t.line, t.col)
  }

  // ── Conditions ──────────────────────────────────────────────────────────────

  private parseCondition(): Condition {
    let left = this.parsePrimaryCondition()
    while (this.at('AND', 'OR')) {
      const op = this.eat().kind
      const right = this.parsePrimaryCondition()
      left = op === 'AND' ? { kind: 'and', left, right } : { kind: 'or', left, right }
    }
    return left
  }

  private parsePrimaryCondition(): Condition {
    if (this.at('NOT')) {
      this.eat()
      return { kind: 'not', condition: this.parsePrimaryCondition() }
    }
    const t = this.peek()
    if (SENSOR_TOKEN_KINDS.has(t.kind)) {
      const sensor = SENSOR_NAMES[this.eat().value]!
      const op = this.parseCompareOp()
      const { value, unit } = this.parseMeasurement()
      return { kind: 'sensor', sensor, op, threshold: value, unit }
    }
    if (this.at('IDENT')) {
      const name = this.eat('IDENT').value
      const op = this.parseCompareOp()
      const value = this.parseValue()
      return { kind: 'variable', name, op, value }
    }
    if (this.at('YES', 'TRUE'))  { this.eat(); return { kind: 'bool', value: true } }
    if (this.at('NO',  'FALSE')) { this.eat(); return { kind: 'bool', value: false } }
    throw new ParseError(`Expected condition, got "${t.value}"`, t.line, t.col)
  }

  // ── Values ──────────────────────────────────────────────────────────────────

  private parseValue(): Value {
    let left = this.parsePrimaryValue()
    while (this.at('PLUS', 'MINUS', 'STAR', 'SLASH')) {
      const opMap: Record<string, '+' | '-' | '*' | '/'> = { PLUS: '+', MINUS: '-', STAR: '*', SLASH: '/' }
      const op = opMap[this.eat().kind]!
      const right = this.parsePrimaryValue()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  private parsePrimaryValue(): Value {
    const t = this.peek()
    if (this.at('NUMBER'))  return { kind: 'number', value: parseFloat(this.eat().value) }
    if (this.at('PERCENT')) return { kind: 'number', value: parseFloat(this.eat().value) }
    if (this.at('UNIT_S'))  return { kind: 'number', value: parseFloat(this.eat().value) }
    if (this.at('STRING'))  return { kind: 'string', value: this.eat().value }
    if (this.at('YES', 'TRUE'))  { this.eat(); return { kind: 'bool', value: true } }
    if (this.at('NO',  'FALSE')) { this.eat(); return { kind: 'bool', value: false } }
    if (this.at('IDENT'))   return { kind: 'variable', name: this.eat().value }
    if (SENSOR_TOKEN_KINDS.has(t.kind)) {
      const sensor: SensorName = SENSOR_NAMES[this.eat().value]!
      return { kind: 'sensor', sensor }
    }
    throw new ParseError(`Expected value, got "${t.value}"`, t.line, t.col)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private parseDuration(): Duration {
    const t = this.peek()
    if (this.at('UNIT_S'))  return { value: parseFloat(this.eat().value), unit: 's' }
    if (this.at('UNIT_MS')) return { value: parseFloat(this.eat().value), unit: 'ms' }
    if (this.at('UNIT_M'))  return { value: parseFloat(this.eat().value), unit: 'm' }
    if (this.at('NUMBER')) {
      const n = parseFloat(this.eat().value)
      if (this.at('UNIT_S'))  { this.eat(); return { value: n, unit: 's' } }
      if (this.at('UNIT_MS')) { this.eat(); return { value: n, unit: 'ms' } }
      return { value: n, unit: 's' }
    }
    throw new ParseError(`Expected duration (e.g. 2s, 500ms)`, t.line, t.col)
  }

  private parseSpeedValue(): number {
    if (this.at('PERCENT'))     return parseFloat(this.eat().value)
    if (this.at('FULL', 'FAST')) { this.eat(); return 100 }
    if (this.at('SLOW'))        { this.eat(); return 30 }
    if (this.at('HALF'))        { this.eat(); return 50 }
    if (this.at('NUMBER'))      return parseFloat(this.eat().value)
    return 50
  }

  private parseMeasurement(): { value: number; unit?: string } {
    const t = this.peek()
    if (this.at('UNIT_CM'))  return { value: parseFloat(this.eat().value), unit: 'cm' }
    if (this.at('UNIT_S'))   return { value: parseFloat(this.eat().value), unit: 's' }
    if (this.at('PERCENT'))  return { value: parseFloat(this.eat().value), unit: '%' }
    if (this.at('NUMBER'))   return { value: parseFloat(this.eat().value) }
    throw new ParseError(`Expected measurement (e.g. 30cm, 50%)`, t.line, t.col)
  }

  private parseCompareOp(): CompareOp {
    const t = this.peek()
    const map: Partial<Record<TokenKind, CompareOp>> = {
      LT: '<', GT: '>', LTE: '<=', GTE: '>=', EQ: '==', ASSIGN: '==',
    }
    const op = map[t.kind]
    if (!op) throw new ParseError(`Expected comparison operator, got "${t.value}"`, t.line, t.col)
    this.eat(); return op
  }

  private tryParseDirection(): Direction | null {
    if (this.at('LEFT'))            { this.eat(); return 'left' }
    if (this.at('RIGHT'))           { this.eat(); return 'right' }
    if (this.at('FORWARD'))         { this.eat(); return 'forward' }
    if (this.at('BACKWARD', 'BACK')) { this.eat(); return 'backward' }
    return null
  }

  private eatNewline() {
    if (this.at('NEWLINE')) this.eat('NEWLINE')
  }
}

export function parse(tokens: Token[]): Program {
  return new Parser(tokens).parse()
}
