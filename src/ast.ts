// AppyScript Abstract Syntax Tree
// Every node in an AppyScript program is one of these types.

export type Direction = 'forward' | 'backward' | 'left' | 'right'

export type FaceExpression =
  | 'happy' | 'sad' | 'thinking' | 'excited' | 'angry'
  | 'alert' | 'sleep' | 'calm' | 'confused' | 'dizzy'

export type CompareOp = '<' | '>' | '==' | '<=' | '>='
export type ArithOp = '+' | '-' | '*' | '/'

export interface Duration {
  value: number
  unit: 'ms' | 's' | 'm'
}

// ── Values ────────────────────────────────────────────────────────────────────

export type Value =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'variable'; name: string }
  | { kind: 'sensor'; sensor: SensorName }
  | { kind: 'binary'; op: ArithOp; left: Value; right: Value }

export type SensorName = 'distance' | 'light' | 'temperature' | 'touch' | 'acceleration'

// ── Triggers (what kicks off a `when` block) ──────────────────────────────────

export type Trigger =
  | { kind: 'button_a' }
  | { kind: 'button_b' }
  | { kind: 'shaken' }
  | { kind: 'tilted'; direction?: Direction }
  | { kind: 'start' }
  | { kind: 'timer'; interval: Duration }
  | { kind: 'received'; variable?: string }
  | { kind: 'sensor'; sensor: SensorName; op: CompareOp; threshold: number; unit?: string }

// ── Conditions (used in `if` and `while`) ────────────────────────────────────

export type Condition =
  | { kind: 'sensor'; sensor: SensorName; op: CompareOp; threshold: number; unit?: string }
  | { kind: 'variable'; name: string; op: CompareOp; value: Value }
  | { kind: 'bool'; value: boolean }
  | { kind: 'not'; condition: Condition }
  | { kind: 'and'; left: Condition; right: Condition }
  | { kind: 'or'; left: Condition; right: Condition }

// ── Statements ────────────────────────────────────────────────────────────────

export type Statement =
  | { kind: 'move'; direction: Direction; speed?: number; duration?: Duration }
  | { kind: 'turn'; direction: 'left' | 'right'; degrees: number }
  | { kind: 'stop' }
  | { kind: 'say'; text: string }
  | { kind: 'play'; sound: string }
  | { kind: 'show'; expression: FaceExpression }
  | { kind: 'show_text'; text: string }
  | { kind: 'show_number'; value: Value }
  | { kind: 'wait'; duration: Duration }
  | { kind: 'if'; condition: Condition; then: Statement[]; else?: Statement[] }
  | { kind: 'repeat'; count: Value; body: Statement[] }
  | { kind: 'while'; condition: Condition; body: Statement[] }
  | { kind: 'let'; name: string; value: Value }
  | { kind: 'set'; name: string; value: Value }
  | { kind: 'remember'; name: string }
  | { kind: 'do'; name: string }
  | { kind: 'send'; message: Value }

// ── Top-level blocks ──────────────────────────────────────────────────────────

export type Block =
  | { kind: 'when'; trigger: Trigger; body: Statement[] }
  | { kind: 'forever'; body: Statement[] }
  | { kind: 'define'; name: string; body: Statement[] }

export interface Program {
  blocks: Block[]
}
