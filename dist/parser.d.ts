import { Token } from './lexer';
import type { Program } from './ast';
export declare class ParseError extends Error {
    line: number;
    col: number;
    constructor(message: string, line: number, col: number);
}
export declare class Parser {
    private tokens;
    private pos;
    constructor(tokens: Token[]);
    private peek;
    private at;
    private loc;
    private eat;
    private skipNewlines;
    parse(): Program;
    private parseBlock;
    private parseBody;
    /** Like parseBody() but also stops before ELSE/OTHERWISE (leaving them in stream) */
    private parseIfBody;
    private parseTrigger;
    private parseStatement;
    private parseCondition;
    private parsePrimaryCondition;
    private parseValue;
    private parsePrimaryValue;
    private parseDuration;
    private parseSpeedValue;
    private parseMeasurement;
    private parseCompareOp;
    private tryParseDirection;
    private eatNewline;
}
export declare function parse(tokens: Token[]): Program;
