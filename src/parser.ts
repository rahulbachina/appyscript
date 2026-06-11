// AppyScript Parser
// Blocks are opened by a header line and closed by 'end'.
// No significant whitespace — kids can't make indentation errors.

import { Token, TokenKind } from './lexer'
import type {
  Program, Block, Statement, Trigger, Condition, Value,
  Duration, Direction, FaceExpression, SensorName, CompareOp,
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

    // when <trigger> / on <trigger>
    if (this.at('WHEN', 'ON')) {
      this.eat()
      const trigger = this.parseTrigger()
      this.eatNewline()
      const body = this.parseBody()
      return { kind: 'when', trigger, body }
    }

    // forever
    if (this.at('FOREVER')) {
      this.eat()
      this.eatNewline()
      const body = this.parseBody()
      return { kind: 'forever', body }
    }

    // define <name>
    if (this.at('DEFINE')) {
      this.eat()
      const name = this.eat('IDENT').value
      this.eatNewline()
      const body = this.parseBody()
      return { kind: 'define', name, body }
    }

    throw new ParseError(
      `Expected 'when', 'forever', or 'define', got "${t.value}"`,
      t.line, t.col
    )
  }

  // Parse statements until 'end'
  private parseBody(): Statement[] {
    const stmts: Statement[] = []
    this.skipNewlines()
    while (!this.at('END', 'EOF')) {
      // Handle nested if/repeat/while which consume their own 'end'
      stmts.push(this.parseStatement())
      this.skipNewlines()
    }
    if (this.at('END')) { this.eat('END'); this.eatNewline() }
    return stmts
  }

  // ── Triggers ────────────────────────────────────────────────────────────────
  // Natural English: "button_a pressed", "distance < 30cm", "shaken", "start"

  private parseTrigger(): Trigger {
    const t = this.peek()

    // button_a [pressed]
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

    if (this.at('SHAKEN')) { this.eat(); return { kind: 'shaken' } }
    if (this.at('START', 'STARTS')) { this.eat(); return { kind: 'start' } }
    if (this.at('RECEIVED', 'RECEIVES')) { this.eat(); return { kind: 'received' } }

    if (this.at('TILTED')) {
      this.eat()
      const dir = this.tryParseDirection()
      return { kind: 'tilted', direction: dir ?? undefined }
    }

    // every 2s (timer)
    if (this.at('EVERY', 'TIMER')) {
      this.eat()
      const interval = this.parseDuration()
      return { kind: 'timer', interval }
    }

    // Sensor trigger: distance < 30cm, light > 50%, temperature < 20
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

    // MOVE / BACK / BACKWARD / FORWARD
    if (this.at('MOVE', 'BACK', 'BACKWARD', 'FORWARD')) {
      let direction: Direction = 'forward'
      const first = this.eat()
      if (first.kind === 'BACK' || first.kind === 'BACKWARD') direction = 'backward'
      if (this.at('FORWARD')) { this.eat(); direction = 'forward' }
      else if (this.at('BACKWARD', 'BACK')) { this.eat(); direction = 'backward' }
      else if (this.at('LEFT')) { this.eat(); direction = 'left' }
      else if (this.at('RIGHT')) { this.eat(); direction = 'right' }

      let speed: number | undefined
      let duration: Duration | undefined
      if (this.at('AT')) { this.eat(); speed = this.parseSpeedValue() }
      if (this.at('FOR')) { this.eat(); duration = this.parseDuration() }
      this.eatNewline()
      return { kind: 'move', direction, speed, duration }
    }

    // TURN / SPIN left/right [N°]
    if (this.at('TURN', 'SPIN')) {
      this.eat()
      const dirTok = this.eat('LEFT', 'RIGHT')
      const direction = dirTok.value as 'left' | 'right'
      let degrees = 90
      if (this.at('DEGREES', 'NUMBER')) degrees = parseFloat(this.eat().value)
      this.eatNewline()
      return { kind: 'turn', direction, degrees }
    }

    if (this.at('STOP')) { this.eat(); this.eatNewline(); return { kind: 'stop' } }

    // SAY "text"
    if (this.at('SAY')) {
      this.eat()
      const text = this.eat('STRING').value
      this.eatNewline()
      return { kind: 'say', text }
    }

    // PLAY "sound"
    if (this.at('PLAY')) {
      this.eat()
      const sound = this.eat('STRING').value
      this.eatNewline()
      return { kind: 'play', sound }
    }

    // SHOW expression / SHOW TEXT "..."
    if (this.at('SHOW')) {
      this.eat()
      if (this.at('TEXT')) {
        this.eat()
        const text = this.eat('STRING').value
        this.eatNewline()
        return { kind: 'show_text', text }
      }
      if (this.at('STRING')) {
        const text = this.eat('STRING').value
        this.eatNewline()
        return { kind: 'show_text', text }
      }
      if (FACE_EXPRESSIONS.has(this.peek().value)) {
        const expr = this.eat().value as FaceExpression
        this.eatNewline()
        return { kind: 'show', expression: expr }
      }
      throw new ParseError(`Expected expression name after 'show'`, t.line, t.col)
    }

    // WAIT 1s
    if (this.at('WAIT')) {
      this.eat()
      const duration = this.parseDuration()
      this.eatNewline()
      return { kind: 'wait', duration }
    }

    // SEND "message"
    if (this.at('SEND')) {
      this.eat()
      const message = this.parseValue()
      this.eatNewline()
      return { kind: 'send', message }
    }

    // LET name = value
    if (this.at('LET')) {
      this.eat()
      const name = this.eat('IDENT').value
      this.eat('ASSIGN')
      const value = this.parseValue()
      this.eatNewline()
      return { kind: 'let', name, value }
    }

    // SET name TO value / CHANGE name BY value
    if (this.at('SET')) {
      this.eat()
      const name = this.eat('IDENT').value
      this.eat('TO')
      const value = this.parseValue()
      this.eatNewline()
      return { kind: 'set', name, value }
    }

    if (this.at('CHANGE')) {
      this.eat()
      const name = this.eat('IDENT').value
      this.eat('BY')
      const delta = this.parseValue()
      this.eatNewline()
      // desugar CHANGE x BY n → SET x TO x + n
      return { kind: 'set', name, value: { kind: 'binary', op: '+', left: { kind: 'variable', name }, right: delta } }
    }

    // REMEMBER name
    if (this.at('REMEMBER')) {
      this.eat()
      const name = this.eat('IDENT').value
      this.eatNewline()
      return { kind: 'remember', name }
    }

    // DO name
    if (this.at('DO')) {
      this.eat()
      const name = this.eat('IDENT').value
      this.eatNewline()
      return { kind: 'do', name }
    }

    // IF condition [THEN]
    if (this.at('IF')) {
      this.eat()
      const condition = this.parseCondition()
      if (this.at('THEN')) this.eat()
      this.eatNewline()
      const thenBody = this.parseBody()
      // Check for ELSE (after the inner 'end' was consumed by parseBody)
      this.skipNewlines()
      let elseBody: Statement[] | undefined
      if (this.at('ELSE', 'OTHERWISE')) {
        this.eat()
        this.eatNewline()
        elseBody = this.parseBody()
      }
      return { kind: 'if', condition, then: thenBody, else: elseBody }
    }

    // REPEAT N TIMES
    if (this.at('REPEAT')) {
      this.eat()
      const count = this.parseValue()
      if (this.at('TIMES')) this.eat()
      this.eatNewline()
      const body = this.parseBody()
      return { kind: 'repeat', count, body }
    }

    // WHILE condition
    if (this.at('WHILE')) {
      this.eat()
      const condition = this.parseCondition()
      this.eatNewline()
      const body = this.parseBody()
      return { kind: 'while', condition, body }
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
    if (this.at('YES', 'TRUE')) { this.eat(); return { kind: 'bool', value: true } }
    if (this.at('NO', 'FALSE')) { this.eat(); return { kind: 'bool', value: false } }
    throw new ParseError(`Expected condition, got "${t.value}"`, t.line, t.col)
  }

  // ── Values ──────────────────────────────────────────────────────────────────

  private parseValue(): Value {
    let left = this.parsePrimaryValue()
    while (this.at('PLUS', 'MINUS', 'STAR', 'SLASH')) {
      const opMap: Record<string, '+' | '-' | '*' | '/'> = {
        PLUS: '+', MINUS: '-', STAR: '*', SLASH: '/',
      }
      const op = opMap[this.eat().kind]!
      const right = this.parsePrimaryValue()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  private parsePrimaryValue(): Value {
    const t = this.peek()
    if (this.at('NUMBER')) return { kind: 'number', value: parseFloat(this.eat().value) }
    if (this.at('PERCENT')) return { kind: 'number', value: parseFloat(this.eat().value) }
    if (this.at('UNIT_S')) return { kind: 'number', value: parseFloat(this.eat().value) }
    if (this.at('STRING')) return { kind: 'string', value: this.eat().value }
    if (this.at('YES', 'TRUE')) { this.eat(); return { kind: 'bool', value: true } }
    if (this.at('NO', 'FALSE')) { this.eat(); return { kind: 'bool', value: false } }
    if (this.at('IDENT')) return { kind: 'variable', name: this.eat().value }
    if (SENSOR_TOKEN_KINDS.has(t.kind)) {
      const sensor: SensorName = SENSOR_NAMES[this.eat().value]!
      return { kind: 'sensor', sensor }
    }
    throw new ParseError(`Expected value, got "${t.value}"`, t.line, t.col)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private parseDuration(): Duration {
    const t = this.peek()
    if (this.at('UNIT_S')) return { value: parseFloat(this.eat().value), unit: 's' }
    if (this.at('UNIT_MS')) return { value: parseFloat(this.eat().value), unit: 'ms' }
    if (this.at('UNIT_M')) return { value: parseFloat(this.eat().value), unit: 'm' }
    if (this.at('NUMBER')) {
      const n = parseFloat(this.eat().value)
      if (this.at('UNIT_S')) { this.eat(); return { value: n, unit: 's' } }
      if (this.at('UNIT_MS')) { this.eat(); return { value: n, unit: 'ms' } }
      return { value: n, unit: 's' }
    }
    throw new ParseError(`Expected duration (e.g. 2s, 500ms)`, t.line, t.col)
  }

  private parseSpeedValue(): number {
    if (this.at('PERCENT')) return parseFloat(this.eat().value)
    if (this.at('FULL', 'FAST')) { this.eat(); return 100 }
    if (this.at('SLOW')) { this.eat(); return 30 }
    if (this.at('HALF')) { this.eat(); return 50 }
    if (this.at('NUMBER')) return parseFloat(this.eat().value)
    return 50
  }

  private parseMeasurement(): { value: number; unit?: string } {
    const t = this.peek()
    if (this.at('UNIT_CM')) return { value: parseFloat(this.eat().value), unit: 'cm' }
    if (this.at('UNIT_S')) return { value: parseFloat(this.eat().value), unit: 's' }
    if (this.at('PERCENT')) return { value: parseFloat(this.eat().value), unit: '%' }
    if (this.at('NUMBER')) return { value: parseFloat(this.eat().value) }
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
    if (this.at('LEFT')) { this.eat(); return 'left' }
    if (this.at('RIGHT')) { this.eat(); return 'right' }
    if (this.at('FORWARD')) { this.eat(); return 'forward' }
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
