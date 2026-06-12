export type Direction = 'forward' | 'backward' | 'left' | 'right';
export type FaceExpression = 'happy' | 'sad' | 'thinking' | 'excited' | 'angry' | 'alert' | 'sleep' | 'calm' | 'confused' | 'dizzy';
export type CompareOp = '<' | '>' | '==' | '<=' | '>=';
export type ArithOp = '+' | '-' | '*' | '/';
export interface SourceLocation {
    line: number;
    col: number;
}
export interface Duration {
    value: number;
    unit: 'ms' | 's' | 'm';
}
export type Value = {
    kind: 'number';
    value: number;
} | {
    kind: 'string';
    value: string;
} | {
    kind: 'bool';
    value: boolean;
} | {
    kind: 'variable';
    name: string;
} | {
    kind: 'sensor';
    sensor: SensorName;
} | {
    kind: 'binary';
    op: ArithOp;
    left: Value;
    right: Value;
};
export type SensorName = 'distance' | 'light' | 'temperature' | 'touch' | 'acceleration';
export type Trigger = {
    kind: 'button_a';
} | {
    kind: 'button_b';
} | {
    kind: 'shaken';
} | {
    kind: 'tilted';
    direction?: Direction;
} | {
    kind: 'start';
} | {
    kind: 'timer';
    interval: Duration;
} | {
    kind: 'received';
    variable?: string;
} | {
    kind: 'sensor';
    sensor: SensorName;
    op: CompareOp;
    threshold: number;
    unit?: string;
};
export type Condition = {
    kind: 'sensor';
    sensor: SensorName;
    op: CompareOp;
    threshold: number;
    unit?: string;
} | {
    kind: 'variable';
    name: string;
    op: CompareOp;
    value: Value;
} | {
    kind: 'bool';
    value: boolean;
} | {
    kind: 'not';
    condition: Condition;
} | {
    kind: 'and';
    left: Condition;
    right: Condition;
} | {
    kind: 'or';
    left: Condition;
    right: Condition;
};
export type Statement = StatementNode & {
    loc?: SourceLocation;
};
export type StatementNode = {
    kind: 'move';
    direction: Direction;
    speed?: number;
    duration?: Duration;
} | {
    kind: 'turn';
    direction: 'left' | 'right';
    degrees: number;
} | {
    kind: 'stop';
} | {
    kind: 'say';
    text: string;
} | {
    kind: 'play';
    sound: string;
} | {
    kind: 'show';
    expression: FaceExpression;
} | {
    kind: 'show_text';
    text: string;
} | {
    kind: 'show_number';
    value: Value;
} | {
    kind: 'wait';
    duration: Duration;
} | {
    kind: 'if';
    condition: Condition;
    then: Statement[];
    else?: Statement[];
} | {
    kind: 'repeat';
    count: Value;
    body: Statement[];
} | {
    kind: 'while';
    condition: Condition;
    body: Statement[];
} | {
    kind: 'let';
    name: string;
    value: Value;
} | {
    kind: 'set';
    name: string;
    value: Value;
} | {
    kind: 'remember';
    name: string;
} | {
    kind: 'do';
    name: string;
} | {
    kind: 'send';
    message: Value;
};
export type Block = {
    kind: 'when';
    trigger: Trigger;
    body: Statement[];
    loc?: SourceLocation;
} | {
    kind: 'forever';
    body: Statement[];
    loc?: SourceLocation;
} | {
    kind: 'define';
    name: string;
    body: Statement[];
    loc?: SourceLocation;
};
export interface Program {
    blocks: Block[];
    source?: string;
}
export interface MatchCase {
    op?: CompareOp;
    threshold?: number;
    unit?: string;
    rangeFrom?: number;
    rangeTo?: number;
    rangeUnit?: string;
    body: Statement[];
}
export type MatchStatement = {
    kind: 'match';
    subject: Value;
    cases: MatchCase[];
    else?: Statement[];
    loc?: SourceLocation;
};
