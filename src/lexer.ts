// AppyScript Lexer — v4
// Added: ASK, SAVE, LOAD, MATCH, CASE; template string {var} interpolation

export type TokenKind =
  | 'WHEN' | 'ON' | 'FOREVER' | 'DEFINE' | 'END' | 'DO'
  | 'IF' | 'ELSE' | 'OTHERWISE' | 'THEN' | 'REPEAT' | 'TIMES' | 'WHILE' | 'UNTIL'
  | 'MATCH' | 'CASE' | 'DEFAULT'
  | 'MOVE' | 'TURN' | 'SPIN' | 'STOP' | 'SAY' | 'PLAY' | 'SHOW' | 'WAIT' | 'SEND'
  | 'BACK' | 'BACKWARD' | 'FORWARD' | 'LEFT' | 'RIGHT'
  | 'LET' | 'SET' | 'TO' | 'REMEMBER' | 'CHANGE' | 'BY' | 'SAVE' | 'LOAD' | 'ASK'
  | 'LIST' | 'ADD' | 'ITEM' | 'OF' | 'SIZE'
  | 'PICK' | 'RANDOM'
  | 'DISTANCE' | 'LIGHT' | 'TEMPERATURE' | 'TOUCH' | 'ACCELERATION'
  | 'BUTTON_A' | 'BUTTON_B' | 'SHAKEN' | 'TILTED' | 'START' | 'STARTS'
  | 'EVERY' | 'TIMER' | 'RECEIVED' | 'RECEIVES' | 'PRESSED' | 'RELEASED'
  | 'AT' | 'FOR' | 'FULL' | 'SLOW' | 'FAST' | 'HALF' | 'SPEED' | 'TEXT' | 'NUMBER_KW'
  | 'HAPPY' | 'SAD' | 'THINKING' | 'EXCITED' | 'ANGRY'
  | 'ALERT' | 'SLEEP' | 'CALM' | 'CONFUSED' | 'DIZZY'
  | 'AND' | 'OR' | 'NOT' | 'YES' | 'NO' | 'TRUE' | 'FALSE'
  | 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ' | 'ASSIGN'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH'
  | 'NUMBER' | 'STRING' | 'IDENT'
  | 'UNIT_CM' | 'UNIT_S' | 'UNIT_MS' | 'UNIT_M' | 'PERCENT'
  | 'NEWLINE' | 'EOF'

export interface Token { kind: TokenKind; value: string; line: number; col: number }

export class LexError extends Error {
  constructor(message: string, public line: number, public col: number) {
    super(`Line ${line}:${col} — ${message}`); this.name = 'LexError'
  }
}

const KEYWORDS: Record<string, TokenKind> = {
  when:'WHEN', on:'ON', forever:'FOREVER', define:'DEFINE', end:'END', do:'DO',
  if:'IF', else:'ELSE', otherwise:'OTHERWISE', then:'THEN',
  repeat:'REPEAT', times:'TIMES', while:'WHILE', until:'UNTIL',
  match:'MATCH', case:'CASE', default:'DEFAULT',
  move:'MOVE', turn:'TURN', spin:'SPIN', stop:'STOP',
  say:'SAY', play:'PLAY', show:'SHOW', wait:'WAIT', send:'SEND',
  back:'BACK', backward:'BACKWARD', forward:'FORWARD', left:'LEFT', right:'RIGHT',
  at:'AT', for:'FOR', full:'FULL', slow:'SLOW', fast:'FAST', half:'HALF',
  speed:'SPEED', text:'TEXT', number:'NUMBER_KW',
  let:'LET', set:'SET', to:'TO', remember:'REMEMBER', change:'CHANGE', by:'BY',
  save:'SAVE', load:'LOAD', ask:'ASK',
  list:'LIST', add:'ADD', item:'ITEM', of:'OF', size:'SIZE',
  pick:'PICK', random:'RANDOM',
  distance:'DISTANCE', light:'LIGHT', temperature:'TEMPERATURE',
  touch:'TOUCH', acceleration:'ACCELERATION',
  button_a:'BUTTON_A', button_b:'BUTTON_B',
  shaken:'SHAKEN', tilted:'TILTED', start:'START', starts:'STARTS',
  every:'EVERY', timer:'TIMER', received:'RECEIVED', receives:'RECEIVES',
  pressed:'PRESSED', released:'RELEASED',
  happy:'HAPPY', sad:'SAD', thinking:'THINKING', excited:'EXCITED', angry:'ANGRY',
  alert:'ALERT', sleep:'SLEEP', calm:'CALM', confused:'CONFUSED', dizzy:'DIZZY',
  and:'AND', or:'OR', not:'NOT', yes:'YES', no:'NO', true:'TRUE', false:'FALSE',
}

// Expand template string "Hello {name}!" into tokens:
// STRING("Hello ") PLUS IDENT(name) PLUS STRING("!")
function expandTemplate(raw: string, line: number, startCol: number): Token[] {
  const tokens: Token[] = []
  const parts = raw.split(/(\{[^}]+\})/g)
  let first = true
  for (const part of parts) {
    if (!part) continue
    const varMatch = part.match(/^\{([^}]+)\}$/)
    if (varMatch) {
      if (!first) tokens.push({ kind: 'PLUS', value: '+', line, col: startCol })
      tokens.push({ kind: 'IDENT', value: varMatch[1].trim(), line, col: startCol })
      first = false
    } else {
      if (!first) tokens.push({ kind: 'PLUS', value: '+', line, col: startCol })
      tokens.push({ kind: 'STRING', value: part, line, col: startCol })
      first = false
    }
  }
  return tokens
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0, line = 1, col = 1

  function advance() {
    const ch = source[i++]
    if (ch === '\n') { line++; col = 1 } else { col++ }
    return ch
  }
  function peek(o = 0) { return source[i + o] }
  function add(kind: TokenKind, value: string, l = line, c = col) {
    tokens.push({ kind, value, line: l, col: c })
  }

  while (i < source.length) {
    const l = line, c = col, ch = source[i]

    if (ch === ' ' || ch === '\t' || ch === '\r') { advance(); continue }
    if (ch === '#') { while (i < source.length && source[i] !== '\n') advance(); continue }
    if (ch === '\n') { advance(); add('NEWLINE', '\n', l, c); continue }
    if (ch === '°') { advance(); continue }

    // Strings — with template expansion
    if (ch === '"' || ch === "'") {
      const q = ch; advance(); let s = ''
      while (i < source.length && source[i] !== q) {
        const x = advance()
        if (x === '\\') {
          const e = advance()
          s += e==='n'?'\n': e==='t'?'\t': e==='"'?'"': e==="'"?"'": e==='\\'?'\\': e
        } else { s += x }
      }
      if (i >= source.length) throw new LexError('Unterminated string', l, c)
      advance()
      // Template strings: expand {var} into separate tokens
      if (s.includes('{')) {
        tokens.push(...expandTemplate(s, l, c))
      } else {
        add('STRING', s, l, c)
      }
      continue
    }

    // Numbers + unit suffix
    if (ch >= '0' && ch <= '9') {
      let n = ''
      while (i < source.length && (source[i] >= '0' && source[i] <= '9' || source[i] === '.')) n += advance()
      if (source.slice(i,i+2)==='ms') { advance(); advance(); add('UNIT_MS',n,l,c) }
      else if (source[i]==='s' && !/[a-zA-Z]/.test(source[i+1]??'')) { advance(); add('UNIT_S',n,l,c) }
      else if (source.slice(i,i+2)==='cm') { advance(); advance(); add('UNIT_CM',n,l,c) }
      else if (source[i]==='m' && !/[a-zA-Z]/.test(source[i+1]??'')) { advance(); add('UNIT_M',n,l,c) }
      else if (source[i]==='%') { advance(); add('PERCENT',n,l,c) }
      else add('NUMBER',n,l,c)
      continue
    }

    // Identifiers / keywords
    if (/[a-zA-Z_]/.test(ch)) {
      let w = ''
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i])) w += advance()
      const lo = w.toLowerCase()
      add(KEYWORDS[lo] ?? 'IDENT', lo, l, c)
      continue
    }

    // Operators
    if (ch==='<'&&peek(1)==='=') { advance(); advance(); add('LTE','<=',l,c); continue }
    if (ch==='>'&&peek(1)==='=') { advance(); advance(); add('GTE','>=',l,c); continue }
    if (ch==='='&&peek(1)==='=') { advance(); advance(); add('EQ','==',l,c);  continue }
    if (ch==='<') { advance(); add('LT','<',l,c);   continue }
    if (ch==='>') { advance(); add('GT','>',l,c);   continue }
    if (ch==='=') { advance(); add('ASSIGN','=',l,c); continue }
    if (ch==='+') { advance(); add('PLUS','+',l,c); continue }
    if (ch==='-') { advance(); add('MINUS','-',l,c); continue }
    if (ch==='*') { advance(); add('STAR','*',l,c);  continue }
    if (ch==='/') { advance(); add('SLASH','/',l,c); continue }

    throw new LexError(`Unexpected character: "${ch}"`, l, c)
  }
  add('EOF', '', line, col)
  return tokens
}
