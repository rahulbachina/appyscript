// AppyScript AST — v6
// Added: home automation triggers + statements (motion, door, time, sun, lights, thermostat, lock, notify, scene)

export type Direction = 'forward' | 'backward' | 'left' | 'right'
export type FaceExpression =
  | 'happy' | 'sad' | 'thinking' | 'excited' | 'angry'
  | 'alert' | 'sleep' | 'calm' | 'confused' | 'dizzy'
export type CompareOp = '<' | '>' | '==' | '<=' | '>='
export type ArithOp   = '+' | '-' | '*' | '/'
export interface SourceLocation { line: number; col: number }
export interface Duration { value: number; unit: 'ms' | 's' | 'm' }

// ── Values ────────────────────────────────────────────────────────────────────

export type Value =
  | { kind: 'number';    value: number }
  | { kind: 'string';    value: string }
  | { kind: 'bool';      value: boolean }
  | { kind: 'variable';  name: string }
  | { kind: 'sensor';    sensor: SensorName }
  | { kind: 'binary';    op: ArithOp; left: Value; right: Value }
  | { kind: 'random';    min: Value; max: Value }
  | { kind: 'list' }
  | { kind: 'list_item'; list: string; index: Value }
  | { kind: 'list_size'; list: string }
  | { kind: 'ask';       prompt: Value }
  | { kind: 'round';     value: Value }
  | { kind: 'abs';       value: Value }
  | { kind: 'min';       left: Value; right: Value }
  | { kind: 'max';       left: Value; right: Value }
  | { kind: 'length';    value: Value }

export type SensorName = 'distance' | 'light' | 'temperature' | 'touch' | 'acceleration'

// ── Triggers ──────────────────────────────────────────────────────────────────

export type Trigger =
  // Robot triggers
  | { kind: 'button_a' }
  | { kind: 'button_b' }
  | { kind: 'shaken' }
  | { kind: 'tilted';   direction?: Direction }
  | { kind: 'start' }
  | { kind: 'timer';    interval: Duration }
  | { kind: 'received'; variable?: string }
  | { kind: 'sensor';   sensor: SensorName; op: CompareOp; threshold: number; unit?: string }
  // Home automation triggers
  | { kind: 'motion';   room?: string }
  | { kind: 'door';     event: 'opens' | 'closes'; door?: string }
  | { kind: 'presence'; event: 'arrives' | 'leaves'; person?: string }
  | { kind: 'time_of_day'; hour: number; minute: number }
  | { kind: 'sun';      event: 'rises' | 'sets' }

// ── Conditions ────────────────────────────────────────────────────────────────

export type Condition =
  | { kind: 'sensor';   sensor: SensorName; op: CompareOp; threshold: number; unit?: string }
  | { kind: 'variable'; name: string; op: CompareOp; value: Value }
  | { kind: 'bool';     value: boolean }
  | { kind: 'not';      condition: Condition }
  | { kind: 'and';      left: Condition; right: Condition }
  | { kind: 'or';       left: Condition; right: Condition }

// ── Statements ────────────────────────────────────────────────────────────────

export type Statement = StatementNode & { loc?: SourceLocation }

export type StatementNode =
  // Robot actions
  | { kind: 'move';        direction: Direction; speed?: number; duration?: Duration }
  | { kind: 'turn';        direction: 'left' | 'right'; degrees: number }
  | { kind: 'stop' }
  | { kind: 'stop_all' }
  | { kind: 'say';         text: Value }
  | { kind: 'play';        sound: string }
  | { kind: 'show';        expression: FaceExpression }
  | { kind: 'show_text';   text: Value }
  | { kind: 'show_number'; value: Value }
  | { kind: 'wait';        duration: Duration }
  | { kind: 'wait_until';  condition: Condition }
  | { kind: 'if';          condition: Condition; then: Statement[]; else?: Statement[] }
  | { kind: 'repeat';      count: Value; body: Statement[] }
  | { kind: 'while';       condition: Condition; body: Statement[] }
  | { kind: 'let';         name: string; value: Value }
  | { kind: 'set';         name: string; value: Value }
  | { kind: 'remember';    name: string }
  | { kind: 'save';        name: string }
  | { kind: 'load';        name: string }
  | { kind: 'do';          name: string }
  | { kind: 'send';        message: Value }
  | { kind: 'list_add';    list: string; value: Value }
  // Home automation actions
  | { kind: 'lights_on';   room?: string; brightness?: number }
  | { kind: 'lights_off';  room?: string }
  | { kind: 'lights_dim';  room?: string; level: Value }
  | { kind: 'thermostat';  temperature: Value }
  | { kind: 'lock';        device?: string }
  | { kind: 'unlock';      device?: string }
  | { kind: 'scene';       name: string }
  | { kind: 'notify';      message: Value }
  | { kind: 'set_device';  device: string; state: Value }

// ── Blocks ────────────────────────────────────────────────────────────────────

export type Block =
  | { kind: 'when';    trigger: Trigger; body: Statement[]; loc?: SourceLocation }
  | { kind: 'forever'; body: Statement[]; loc?: SourceLocation }
  | { kind: 'define';  name: string; body: Statement[]; loc?: SourceLocation }

export interface Program { blocks: Block[]; source?: string }
