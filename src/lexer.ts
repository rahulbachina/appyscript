// AppyScript Lexer — v6 (final)
// Added home automation keywords: MOTION, DETECTED, DOOR, OPENS, CLOSES,
// ARRIVES, LEAVES, SUN, RISES, SETS, LIGHTS, THERMOSTAT, LOCK, UNLOCK,
// SCENE, NOTIFY, ON, OFF, DIM, SET_DEVICE

export type TokenKind =
  | 'WHEN' | 'ON' | 'FOREVER' | 'DEFINE' | 'END' | 'DO'
  | 'IF' | 'ELSE' | 'OTHERWISE' | 'THEN' | 'REPEAT' | 'TIMES' | 'WHILE' | 'UNTIL'
  | 'MATCH' | 'CASE' | 'DEFAULT'
  | 'MOVE' | 'TURN' | 'SPIN' | 'STOP' | 'ALL' | 'SAY' | 'PLAY' | 'SHOW' | 'WAIT' | 'SEND'
  | 'BACK' | 'BACKWARD' | 'FORWARD' | 'LEFT' | 'RIGHT'
  | 'LET' | 'SET' | 'TO' | 'REMEMBER' | 'CHANGE' | 'BY' | 'SAVE' | 'LOAD' | 'ASK'
  | 'LIST' | 'ADD' | 'ITEM' | 'OF' | 'SIZE' | 'LENGTH'
  | 'PICK' | 'RANDOM' | 'ROUND' | 'ABS' | 'MIN' | 'MAX'
  | 'DISTANCE' | 'LIGHT' | 'TEMPERATURE' | 'TOUCH' | 'ACCELERATION'
  | 'BUTTON_A' | 'BUTTON_B' | 'SHAKEN' | 'TILTED' | 'START' | 'STARTS'
  | 'EVERY' | 'TIMER' | 'RECEIVED' | 'RECEIVES' | 'PRESSED' | 'RELEASED'
  | 'AT' | 'FOR' | 'FULL' | 'SLOW' | 'FAST' | 'HALF' | 'SPEED' | 'TEXT' | 'NUMBER_KW'
  | 'HAPPY' | 'SAD' | 'THINKING' | 'EXCITED' | 'ANGRY'
  | 'ALERT' | 'SLEEP' | 'CALM' | 'CONFUSED' | 'DIZZY'
  | 'AND' | 'OR' | 'NOT' | 'YES' | 'NO' | 'TRUE' | 'FALSE'
  | 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ' | 'ASSIGN'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'COLON'
  | 'NUMBER' | 'STRING' | 'IDENT'
  | 'UNIT_CM' | 'UNIT_S' | 'UNIT_MS' | 'UNIT_M' | 'PERCENT'
  // Home automation
  | 'MOTION' | 'DETECTED' | 'DOOR' | 'OPENS' | 'CLOSES'
  | 'ARRIVES' | 'LEAVES' | 'SUN' | 'RISES' | 'SETS'
  | 'LIGHTS' | 'THERMOSTAT' | 'LOCK' | 'UNLOCK' | 'SCENE' | 'NOTIFY' | 'OFF' | 'DIM'
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
  move:'MOVE', turn:'TURN', spin:'SPIN', stop:'STOP', all:'ALL',
  say:'SAY', play:'PLAY', show:'SHOW', wait:'WAIT', send:'SEND',
  back:'BACK', backward:'BACKWARD', forward:'FORWARD', left:'LEFT', right:'RIGHT',
  at:'AT', for:'FOR', full:'FULL', slow:'SLOW', fast:'FAST', half:'HALF',
  speed:'SPEED', text:'TEXT', number:'NUMBER_KW',
  let:'LET', set:'SET', to:'TO', remember:'REMEMBER', change:'CHANGE', by:'BY',
  save:'SAVE', load:'LOAD', ask:'ASK',
  list:'LIST', add:'ADD', item:'ITEM', of:'OF', size:'SIZE', length:'LENGTH',
  pick:'PICK', random:'RANDOM', round:'ROUND', abs:'ABS', min:'MIN', max:'MAX',
  distance:'DISTANCE', light:'LIGHT', temperature:'TEMPERATURE',
  touch:'TOUCH', acceleration:'ACCELERATION',
  button_a:'BUTTON_A', button_b:'BUTTON_B',
  shaken:'SHAKEN', tilted:'TILTED', start:'START', starts:'STARTS',
  every:'EVERY', timer:'TIMER', received:'RECEIVED', receives:'RECEIVES',
  pressed:'PRESSED', released:'RELEASED',
  happy:'HAPPY', sad:'SAD', thinking:'THINKING', excited:'EXCITED', angry:'ANGRY',
  alert:'ALERT', sleep:'SLEEP', calm:'CALM', confused:'CONFUSED', dizzy:'DIZZY',
  and:'AND', or:'OR', not:'NOT', yes:'YES', no:'NO', true:'TRUE', false:'FALSE',
  // Home automation
  motion:'MOTION', detected:'DETECTED', door:'DOOR', opens:'OPENS', closes:'CLOSES',
  arrives:'ARRIVES', leaves:'LEAVES', sun:'SUN', rises:'RISES', sets:'SETS',
  lights:'LIGHTS', thermostat:'THERMOSTAT', lock:'LOCK', unlock:'UNLOCK',
  scene:'SCENE', notify:'NOTIFY', off:'OFF', dim:'DIM',
}

function expandTemplate(raw: string, line: number, col: number): Token[] {
  const tokens: Token[] = []
  let first = true
  for (const part of raw.split(/(\{[^}]+\})/g)) {
    if (!part) continue
    const m = part.match(/^\{([^}]+)\}$/)
    if (!first) tokens.push({ kind:'PLUS', value:'+', line, col })
    tokens.push(m
      ? { kind:'IDENT',  value:m[1].trim(), line, col }
      : { kind:'STRING', value:part,         line, col }
    )
    first = false
  }
  return tokens
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i=0, line=1, col=1

  const advance = () => {
    const ch = source[i++]
    ch==='\n' ? (line++,col=1) : col++
    return ch
  }
  const peek = (o=0) => source[i+o]
  const add  = (kind: TokenKind, value: string, l=line, c=col) =>
    tokens.push({ kind, value, line:l, col:c })

  while (i < source.length) {
    const l=line, c=col, ch=source[i]

    if (' \t\r'.includes(ch)) { advance(); continue }
    if (ch==='#')  { while(i<source.length && source[i]!=='\n') advance(); continue }
    if (ch==='\n') { advance(); add('NEWLINE','\n',l,c); continue }
    if (ch==='°')  { advance(); continue }

    // Strings + template expansion
    if (ch==='"'||ch==="'") {
      const q=ch; advance(); let s=''
      while(i<source.length && source[i]!==q) {
        const x=advance()
        s += x!=='\\'?x:({n:'\n',t:'\t','"':'"',"'":'\'','\\':'\\'}[advance()]??'')
      }
      if(i>=source.length) throw new LexError('Unterminated string',l,c)
      advance()
      s.includes('{') ? tokens.push(...expandTemplate(s,l,c)) : add('STRING',s,l,c)
      continue
    }

    // Numbers + unit suffix
    if (ch>='0'&&ch<='9') {
      let n=''
      while(i<source.length&&(source[i]>='0'&&source[i]<='9'||source[i]==='.')) n+=advance()
      const rest=source.slice(i,i+2)
      if(rest==='ms')                              { advance();advance();add('UNIT_MS',n,l,c) }
      else if(source[i]==='s'&&!/[a-z]/i.test(peek(1)??'')) { advance();add('UNIT_S',n,l,c) }
      else if(rest==='cm')                         { advance();advance();add('UNIT_CM',n,l,c) }
      else if(source[i]==='m'&&!/[a-z]/i.test(peek(1)??'')) { advance();add('UNIT_M',n,l,c) }
      else if(source[i]==='%')                     { advance();add('PERCENT',n,l,c) }
      else add('NUMBER',n,l,c)
      continue
    }

    // Identifiers / keywords
    if(/[a-zA-Z_]/.test(ch)) {
      let w=''
      while(i<source.length&&/[a-zA-Z0-9_]/.test(source[i])) w+=advance()
      add(KEYWORDS[w.toLowerCase()]??'IDENT', w.toLowerCase(), l, c)
      continue
    }

    // Operators
    if(ch==='<'&&peek(1)==='='){advance();advance();add('LTE','<=',l,c);continue}
    if(ch==='>'&&peek(1)==='='){advance();advance();add('GTE','>=',l,c);continue}
    if(ch==='='&&peek(1)==='='){advance();advance();add('EQ','==',l,c); continue}
    if(ch==='<'){advance();add('LT','<',l,c);  continue}
    if(ch==='>'){advance();add('GT','>',l,c);  continue}
    if(ch==='='){advance();add('ASSIGN','=',l,c);continue}
    if(ch==='+'){advance();add('PLUS','+',l,c);continue}
    if(ch==='-'){advance();add('MINUS','-',l,c);continue}
    if(ch==='*'){advance();add('STAR','*',l,c); continue}
    if(ch==='/'){advance();add('SLASH','/',l,c);continue}
    if(ch===':'){advance();add('COLON',':',l,c);continue}

    throw new LexError(`Unexpected character: "${ch}"`, l, c)
  }
  add('EOF','',line,col)
  return tokens
}
