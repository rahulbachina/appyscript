// AppyScript Lexer — v3
// Added: PICK, RANDOM, ADD, LIST, ITEM, OF, SIZE, CHANGE, BY keywords

export type TokenKind =
  // Structure
  | 'WHEN' | 'ON' | 'FOREVER' | 'DEFINE' | 'END' | 'DO'
  // Control
  | 'IF' | 'ELSE' | 'OTHERWISE' | 'THEN' | 'REPEAT' | 'TIMES' | 'WHILE' | 'UNTIL'
  | 'MATCH' | 'CASE' | 'DEFAULT'
  // Actions
  | 'MOVE' | 'TURN' | 'SPIN' | 'STOP' | 'SAY' | 'PLAY' | 'SHOW' | 'WAIT' | 'SEND'
  | 'BACK' | 'BACKWARD' | 'FORWARD' | 'LEFT' | 'RIGHT'
  // Variables
  | 'LET' | 'SET' | 'TO' | 'REMEMBER' | 'CHANGE' | 'BY'
  // Lists
  | 'LIST' | 'ADD' | 'ITEM' | 'OF' | 'SIZE'
  // Random
  | 'PICK' | 'RANDOM'
  // Sensors / triggers
  | 'DISTANCE' | 'LIGHT' | 'TEMPERATURE' | 'TOUCH' | 'ACCELERATION'
  | 'BUTTON_A' | 'BUTTON_B' | 'SHAKEN' | 'TILTED' | 'START' | 'STARTS'
  | 'EVERY' | 'TIMER' | 'RECEIVED' | 'RECEIVES'
  | 'PRESSED' | 'RELEASED'
  // Speed
  | 'AT' | 'FOR' | 'FULL' | 'SLOW' | 'FAST' | 'HALF' | 'SPEED' | 'TEXT' | 'NUMBER'
  // Expressions
  | 'HAPPY' | 'SAD' | 'THINKING' | 'EXCITED' | 'ANGRY'
  | 'ALERT' | 'SLEEP' | 'CALM' | 'CONFUSED' | 'DIZZY'
  // Logic
  | 'AND' | 'OR' | 'NOT' | 'YES' | 'NO' | 'TRUE' | 'FALSE'
  // Operators
  | 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ' | 'ASSIGN'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH'
  // Literals
  | 'NUMBER' | 'STRING' | 'IDENT'
  // Units (value carries the numeric part)
  | 'UNIT_CM' | 'UNIT_S' | 'UNIT_MS' | 'UNIT_M' | 'PERCENT'
  // Structure
  | 'NEWLINE' | 'EOF'

export interface Token { kind: TokenKind; value: string; line: number; col: number }

export class LexError extends Error {
  constructor(message: string, public line: number, public col: number) {
    super(`Line ${line}:${col} — ${message}`)
    this.name = 'LexError'
  }
}

const KEYWORDS: Record<string, TokenKind> = {
  when: 'WHEN', on: 'ON', forever: 'FOREVER', define: 'DEFINE', end: 'END', do: 'DO',
  if: 'IF', else: 'ELSE', otherwise: 'OTHERWISE', then: 'THEN',
  repeat: 'REPEAT', times: 'TIMES', while: 'WHILE', until: 'UNTIL',
  match: 'MATCH', case: 'CASE', default: 'DEFAULT',
  move: 'MOVE', turn: 'TURN', spin: 'SPIN', stop: 'STOP',
  say: 'SAY', play: 'PLAY', show: 'SHOW', wait: 'WAIT', send: 'SEND',
  back: 'BACK', backward: 'BACKWARD', forward: 'FORWARD', left: 'LEFT', right: 'RIGHT',
  at: 'AT', for: 'FOR', full: 'FULL', slow: 'SLOW', fast: 'FAST', half: 'HALF',
  speed: 'SPEED', text: 'TEXT', number: 'NUMBER',
  let: 'LET', set: 'SET', to: 'TO', remember: 'REMEMBER', change: 'CHANGE', by: 'BY',
  list: 'LIST', add: 'ADD', item: 'ITEM', of: 'OF', size: 'SIZE',
  pick: 'PICK', random: 'RANDOM',
  distance: 'DISTANCE', light: 'LIGHT', temperature: 'TEMPERATURE',
  touch: 'TOUCH', acceleration: 'ACCELERATION',
  button_a: 'BUTTON_A', button_b: 'BUTTON_B',
  shaken: 'SHAKEN', tilted: 'TILTED', start: 'START', starts: 'STARTS',
  every: 'EVERY', timer: 'TIMER', received: 'RECEIVED', receives: 'RECEIVES',
  pressed: 'PRESSED', released: 'RELEASED',
  happy: 'HAPPY', sad: 'SAD', thinking: 'THINKING', excited: 'EXCITED', angry: 'ANGRY',
  alert: 'ALERT', sleep: 'SLEEP', calm: 'CALM', confused: 'CONFUSED', dizzy: 'DIZZY',
  and: 'AND', or: 'OR', not: 'NOT', yes: 'YES', no: 'NO', true: 'TRUE', false: 'FALSE',
  then2: 'THEN', match2: 'MATCH', case2: 'CASE', default2: 'DEFAULT',
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0, line = 1, col = 1
  const len = source.length

  function advance() {
    const ch = source[i++]
    if (ch === '\n') { line++; col = 1 } else { col++ }
    return ch
  }

  function peek(offset = 0) { return source[i + offset] }

  function addTok(kind: TokenKind, value: string, l = line, c = col) {
    tokens.push({ kind, value, line: l, col: c })
  }

  while (i < len) {
    const l = line, c = col
    const ch = source[i]

    // Skip whitespace (not newlines)
    if (ch === ' ' || ch === '\t' || ch === '\r') { advance(); continue }

    // Comments
    if (ch === '#') { while (i < len && source[i] !== '\n') advance(); continue }

    // Newlines
    if (ch === '\n') { advance(); addTok('NEWLINE', '\n', l, c); continue }

    // Degree symbol °
    if (ch === '°') { advance(); continue }

    // Strings
    if (ch === '"' || ch === "'") {
      const quote = ch; advance()
      let s = ''
      while (i < len && source[i] !== quote) {
        const c2 = advance()
        if (c2 === '\\') {
          const esc = advance()
          s += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === '"' ? '"' : esc === "'" ? "'" : esc === '\\' ? '\\' : esc
        } else { s += c2 }
      }
      if (i >= len) throw new LexError('Unterminated string literal', l, c)
      advance() // closing quote
      addTok('STRING', s, l, c)
      continue
    }

    // Numbers (with optional unit suffix fused)
    if (ch >= '0' && ch <= '9') {
      let num = ''
      while (i < len && (source[i] >= '0' && source[i] <= '9' || source[i] === '.')) num += advance()
      // Check for unit suffix
      if (source.slice(i, i + 2) === 'ms') {
        advance(); advance()
        addTok('UNIT_MS', num, l, c); continue
      }
      if (source[i] === 's' && !/[a-zA-Z]/.test(source[i + 1] ?? '')) {
        advance()
        addTok('UNIT_S', num, l, c); continue
      }
      if (source.slice(i, i + 2) === 'cm') {
        advance(); advance()
        addTok('UNIT_CM', num, l, c); continue
      }
      if (source[i] === 'm' && !/[a-zA-Z]/.test(source[i + 1] ?? '')) {
        advance()
        addTok('UNIT_M', num, l, c); continue
      }
      if (source[i] === '%') {
        advance()
        addTok('PERCENT', num, l, c); continue
      }
      addTok('NUMBER', num, l, c)
      continue
    }

    // Identifiers and keywords (case-insensitive)
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let word = ''
      while (i < len && (/[a-zA-Z0-9_]/.test(source[i]))) word += advance()
      const lower = word.toLowerCase()
      const kind = KEYWORDS[lower] ?? 'IDENT'
      addTok(kind, lower, l, c)
      continue
    }

    // Operators
    if (ch === '<' && peek(1) === '=') { advance(); advance(); addTok('LTE', '<=', l, c); continue }
    if (ch === '>' && peek(1) === '=') { advance(); advance(); addTok('GTE', '>=', l, c); continue }
    if (ch === '=' && peek(1) === '=') { advance(); advance(); addTok('EQ', '==', l, c); continue }
    if (ch === '<') { advance(); addTok('LT', '<', l, c); continue }
    if (ch === '>') { advance(); addTok('GT', '>', l, c); continue }
    if (ch === '=') { advance(); addTok('ASSIGN', '=', l, c); continue }
    if (ch === '+') { advance(); addTok('PLUS', '+', l, c); continue }
    if (ch === '-') { advance(); addTok('MINUS', '-', l, c); continue }
    if (ch === '*') { advance(); addTok('STAR', '*', l, c); continue }
    if (ch === '/') { advance(); addTok('SLASH', '/', l, c); continue }

    throw new LexError(`Unexpected character: "${ch}"`, l, c)
  }

  addTok('EOF', '', line, col)
  return tokens
}
