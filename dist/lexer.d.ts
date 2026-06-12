export type TokenKind = 'NEWLINE' | 'EOF' | 'END' | 'LPAREN' | 'RPAREN' | 'STRING' | 'NUMBER' | 'IDENT' | 'PERCENT' | 'DEGREES' | 'UNIT_CM' | 'UNIT_S' | 'UNIT_MS' | 'UNIT_M' | 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ' | 'NEQ' | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'ASSIGN' | 'WHEN' | 'ON' | 'FOREVER' | 'DEFINE' | 'DO' | 'IF' | 'ELSE' | 'REPEAT' | 'TIMES' | 'WHILE' | 'UNTIL' | 'AND' | 'OR' | 'NOT' | 'LET' | 'SET' | 'TO' | 'REMEMBER' | 'CHANGE' | 'BY' | 'THEN' | 'OTHERWISE' | 'MATCH' | 'CASE' | 'DEFAULT' | 'MOVE' | 'TURN' | 'SPIN' | 'STOP' | 'SAY' | 'PLAY' | 'SHOW' | 'WAIT' | 'SEND' | 'BACK' | 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'AT' | 'FOR' | 'FULL' | 'SLOW' | 'FAST' | 'HALF' | 'SPEED' | 'PRESSED' | 'RELEASED' | 'STARTS' | 'RECEIVES' | 'EVERY' | 'SHAKEN' | 'TILTED' | 'BUTTON_A' | 'BUTTON_B' | 'START' | 'TIMER' | 'RECEIVED' | 'DISTANCE' | 'LIGHT' | 'TEMPERATURE' | 'TOUCH' | 'ACCELERATION' | 'HAPPY' | 'SAD' | 'THINKING' | 'EXCITED' | 'ANGRY' | 'ALERT' | 'SLEEP' | 'CALM' | 'CONFUSED' | 'DIZZY' | 'TEXT' | 'NUMBER_KW' | 'YES' | 'NO' | 'TRUE' | 'FALSE';
export interface Token {
    kind: TokenKind;
    value: string;
    line: number;
    col: number;
}
export declare class LexError extends Error {
    line: number;
    col: number;
    constructor(message: string, line: number, col: number);
}
export declare function tokenize(source: string): Token[];
