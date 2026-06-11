export interface SourceMapEntry {
    /** 1-indexed line in generated output */
    generatedLine: number;
    /** 1-indexed line in .appy source */
    sourceLine: number;
    /** 1-indexed col in .appy source */
    sourceCol: number;
}
export declare class SourceMap {
    private entries;
    record(generatedLine: number, sourceLine: number, sourceCol?: number): void;
    /** Look up which .appy line produced a given generated line */
    lookupGenerated(generatedLine: number): SourceMapEntry | undefined;
    /** Look up which generated lines correspond to a given .appy line */
    lookupSource(sourceLine: number): SourceMapEntry[];
    /** Serialise to a simple JSON format */
    toJSON(): object;
    /** Emit a compact VLQ-style mapping string (simplified — not full Source Map v3) */
    toInlineComment(): string;
    get size(): number;
}
