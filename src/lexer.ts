// AppyScript Lexer
// Case-insensitive keywords. Blocks close with 'end' — no significant whitespace.
// This means kids can't make indentation mistakes.

export type TokenKind =
  // Structure
  | 'NEWLINE' | 'EOF' | 'END'
  | 'LPAREN' | 'RPAREN'
  // Literals
  | 'STRING' | 'NUMBER' | 'IDENT'
  // Units (attached to numbers during lex)
  | 'PERCENT'    // 50%
  | 'DEGREES'    // 90° or 90 degrees
  | 'UNIT_CM'    // 30cm
  | 'UNIT_S'     // 2s
  | 'UNIT_MS'    // 500ms
  | 'UNIT_M'     // 2m
  // Operators
  | 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ' | 'NEQ'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'ASSIGN'
  // ── Keywords (all case-insensitive) ──────────────────────────────────────
  | 'WHEN' | 'ON' | 'FOREVER' | 'DEFINE' | 'DO'
  | 'IF' | 'ELSE' | 'REPEAT' | 'TIMES' | 'WHILE' | 'UNTIL'
  | 'AND' | 'OR' | 'NOT'
  | 'LET' | 'SET' | 'TO' | 'REMEMBER' | 'CHANGE' | 'BY'
  | 'THEN' | 'OTHERWISE'
  // Actions
  | 'MOVE' | 'TURN' | 'SPIN' | 'STOP' | 'SAY' | 'PLAY' | 'SHOW' | 'WAIT' | 'SEND' | 'BACK'
  // Direction keywords
  | 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT'
  // Speed modifiers
  | 'AT' | 'FOR' | 'FULL' | 'SLOW' | 'FAST' | 'HALF' | 'SPEED'
  // Trigger words
  | 'PRESSED' | 'RELEASED' | 'STARTS' | 'RECEIVES' | 'EVERY' | 'SHAKEN' | 'TILTED'
  // Hardware triggers
  | 'BUTTON_A' | 'BUTTON_B' | 'START' | 'TIMER' | 'RECEIVED'
  // Sensors
  | 'DISTANCE' | 'LIGHT' | 'TEMPERATURE' | 'TOUCH' | 'ACCELERATION'
  // Face expressions
  | 'HAPPY' | 'SAD' | 'THINKING' | 'EXCITED' | 'ANGRY' | 'ALERT' | 'SLEEP' | 'CALM' | 'CONFUSED' | 'DIZZY'
  // Display
  | 'TEXT' | 'NUMBER_KW'
  // Boolean literals
  | 'YES' | 'NO' | 'TRUE' | 'FALSE'

export interface Token {
  kind: TokenKind
  value: string
  line: number
  col: number
}

const KEYWORDS: Record<string, TokenKind> = {
  when: 'WHEN', on: 'ON', forever: 'FOREVER', define: 'DEFINE', do: 'DO', end: 'END',
  if: 'IF', else: 'ELSE', then: 'THEN', otherwise: 'OTHERWISE',
  repeat: 'REPEAT', times: 'TIMES', while: 'WHILE', until: 'UNTIL',
  and: 'AND', or: 'OR', not: 'NOT',
  let: 'LET', set: 'SET', to: 'TO', remember: 'REMEMBER', change: 'CHANGE', by: 'BY',
  move: 'MOVE', turn: 'TURN', spin: 'SPIN', stop: 'STOP', say: 'SAY', play: 'PLAY',
  show: 'SHOW', wait: 'WAIT', send: 'SEND', back: 'BACK',
  forward: 'FORWARD', backward: 'BACKWARD', left: 'LEFT', right: 'RIGHT',
  at: 'AT', for: 'FOR', full: 'FULL', slow: 'SLOW', fast: 'FAST', half: 'HALF', speed: 'SPEED',
  pressed: 'PRESSED', released: 'RELEASED', starts: 'STARTS', receives: 'RECEIVES',
  every: 'EVERY', shaken: 'SHAKEN', tilted: 'TILTED',
  button_a: 'BUTTON_A', button_b: 'BUTTON_B', start: 'START', timer: 'TIMER',
  received: 'RECEIVED',
  distance: 'DISTANCE', light: 'LIGHT', temperature: 'TEMPERATURE',
  touch: 'TOUCH', acceleration: 'ACCELERATION',
  happy: 'HAPPY', sad: 'SAD', thinking: 'THINKING', excited: 'EXCITED',
  angry: 'ANGRY', alert: 'ALERT', sleep: 'SLEEP', calm: 'CALM',
  confused: 'CONFUSED', dizzy: 'DIZZY',
  text: 'TEXT', number: 'NUMBER_KW',
  yes: 'YES', no: 'NO', true: 'TRUE', false: 'FALSE',
  degrees: 'DEGREES',
}

export class LexError extends Error {
  constructor(message: string, public line: number, public col: number) {
    super(`Line ${line}:${col} — ${message}`)
    this.name = 'LexError'
  }
}

export function tokenize(source: string): Token[] {
  const lines = source.split('\n')
  const tokens: Token[] = []
  let lineNum = 0

  for (const rawLine of lines) {
    lineNum++
    const trimmed = rawLine.trim()

    // Skip blank lines and comment lines
    if (trimmed === '' || trimmed.startsWith('#')) continue

    let i = 0
    while (i < trimmed.length) {
      // Skip whitespace
      if (trimmed[i] === ' ' || trimmed[i] === '\t') { i++; continue }
      // Skip inline comments
      if (trimmed[i] === '#') break

      const col = i + 1

      // String literals
      if (trimmed[i] === '"' || trimmed[i] === "'") {
        const quote = trimmed[i]; i++
        let str = ''
        while (i < trimmed.length && trimmed[i] !== quote) {
          if (trimmed[i] === '\\' && i + 1 < trimmed.length) {
            i++
            str += trimmed[i] === 'n' ? '\n' : trimmed[i]
          } else {
            str += trimmed[i]
          }
          i++
        }
        if (i >= trimmed.length) throw new LexError('Unterminated string', lineNum, col)
        i++
        tokens.push({ kind: 'STRING', value: str, line: lineNum, col })
        continue
      }

      // Numbers with optional unit suffixes
      if (trimmed[i] >= '0' && trimmed[i] <= '9') {
        let num = ''
        while (i < trimmed.length && (trimmed[i] >= '0' && trimmed[i] <= '9' || trimmed[i] === '.')) {
          num += trimmed[i++]
        }
        const rest = trimmed.slice(i)
        if (trimmed[i] === '%') {
          tokens.push({ kind: 'PERCENT', value: num, line: lineNum, col }); i++
        } else if (trimmed[i] === '°') {
          tokens.push({ kind: 'DEGREES', value: num, line: lineNum, col }); i++
        } else if (rest.toLowerCase().startsWith('cm')) {
          tokens.push({ kind: 'UNIT_CM', value: num, line: lineNum, col }); i += 2
        } else if (rest.toLowerCase().startsWith('ms')) {
          tokens.push({ kind: 'UNIT_MS', value: num, line: lineNum, col }); i += 2
        } else if (trimmed[i]?.toLowerCase() === 's' && !/[a-zA-Z]/.test(trimmed[i + 1] ?? '')) {
          tokens.push({ kind: 'UNIT_S', value: num, line: lineNum, col }); i++
        } else if (trimmed[i]?.toLowerCase() === 'm' && !/[a-zA-Z]/.test(trimmed[i + 1] ?? '')) {
          tokens.push({ kind: 'UNIT_M', value: num, line: lineNum, col }); i++
        } else {
          tokens.push({ kind: 'NUMBER', value: num, line: lineNum, col })
        }
        continue
      }

      // Degree symbol alone
      if (trimmed[i] === '°') { i++; continue }

      // Identifiers and keywords (case-insensitive, underscore-allowed)
      if (/[a-zA-Z_]/.test(trimmed[i])) {
        let word = ''
        while (i < trimmed.length && /[a-zA-Z0-9_]/.test(trimmed[i])) {
          word += trimmed[i++]
        }
        const lower = word.toLowerCase()
        const kind: TokenKind = KEYWORDS[lower] ?? 'IDENT'
        tokens.push({ kind, value: lower, line: lineNum, col })
        continue
      }

      // Two-character operators
      const two = trimmed.slice(i, i + 2)
      if (two === '<=') { tokens.push({ kind: 'LTE', value: '<=', line: lineNum, col }); i += 2; continue }
      if (two === '>=') { tokens.push({ kind: 'GTE', value: '>=', line: lineNum, col }); i += 2; continue }
      if (two === '==') { tokens.push({ kind: 'EQ', value: '==', line: lineNum, col }); i += 2; continue }
      if (two === '!=') { tokens.push({ kind: 'NEQ', value: '!=', line: lineNum, col }); i += 2; continue }

      // Single-character operators
      switch (trimmed[i]) {
        case '<': tokens.push({ kind: 'LT', value: '<', line: lineNum, col }); break
        case '>': tokens.push({ kind: 'GT', value: '>', line: lineNum, col }); break
        case '=': tokens.push({ kind: 'ASSIGN', value: '=', line: lineNum, col }); break
        case '+': tokens.push({ kind: 'PLUS', value: '+', line: lineNum, col }); break
        case '-': tokens.push({ kind: 'MINUS', value: '-', line: lineNum, col }); break
        case '*': tokens.push({ kind: 'STAR', value: '*', line: lineNum, col }); break
        case '/': tokens.push({ kind: 'SLASH', value: '/', line: lineNum, col }); break
        case '(': tokens.push({ kind: 'LPAREN', value: '(', line: lineNum, col }); break
        case ')': tokens.push({ kind: 'RPAREN', value: ')', line: lineNum, col }); break
        default:
          throw new LexError(`Unexpected character: '${trimmed[i]}'`, lineNum, col)
      }
      i++
    }

    tokens.push({ kind: 'NEWLINE', value: '', line: lineNum, col: trimmed.length + 1 })
  }

  tokens.push({ kind: 'EOF', value: '', line: lineNum + 1, col: 1 })
  return tokens
}
