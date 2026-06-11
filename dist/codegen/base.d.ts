import type { Program, Value, Condition, Duration, SensorName, FaceExpression } from '../ast';
import { SourceMap } from '../sourcemap';
import type { HardwareProfile, GenerateResult } from '../plugins';
export declare function durationMs(d: Duration): number;
export declare function durationS(d: Duration): number;
export declare abstract class BaseCodegen {
    protected lines: string[];
    protected indentLevel: number;
    protected definedFunctions: Set<string>;
    protected sourceMap: SourceMap;
    /** Map a sensor name to the native call for this platform */
    protected abstract sensorCall(sensor: SensorName): string;
    /** Generate the full program */
    abstract generate(program: Program, profile: HardwareProfile): GenerateResult;
    protected emit(line: string, sourceLine?: number): void;
    protected emitBlank(): void;
    protected indent(): void;
    protected dedent(): void;
    protected get currentLine(): number;
    protected emitValue(value: Value): string;
    /** Override in C++ backends */
    protected boolLiteral(v: boolean): string;
    protected emitCondition(cond: Condition): string;
    protected notKeyword(): string;
    protected andKeyword(): string;
    protected orKeyword(): string;
    protected durationMs(d: Duration): number;
    protected durationS(d: Duration): number;
    protected emitHeader(targetLabel: string, runtime: string): void;
    protected emitCHeader(targetLabel: string): void;
    protected result(): GenerateResult;
}
export declare const ASCII_FACES: Record<FaceExpression, string>;
export declare const MICROBIT_IMAGES: Record<FaceExpression, string>;
