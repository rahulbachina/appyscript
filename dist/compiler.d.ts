import { Diagnostic } from './diagnostics';
import { HardwareProfile } from './plugins';
import type { SourceMap } from './sourcemap';
import type { Program } from './ast';
export type Target = 'esp32' | 'arduino' | 'pico' | 'microbit' | string;
export interface CompileOptions {
    /** Skip semantic analysis (faster, for trusted code) */
    skipSemantic?: boolean;
    /** Skip linting (no warnings) */
    skipLint?: boolean;
    /** Include source map in output */
    sourceMap?: boolean;
    /** Treat lint warnings as errors */
    strict?: boolean;
}
export interface CompileResult {
    ok: boolean;
    code?: string;
    sourceMap?: SourceMap;
    diagnostics: Diagnostic[];
    /** Convenience: only error-severity diagnostics */
    errors: Diagnostic[];
    /** Convenience: only warning-severity diagnostics */
    warnings: Diagnostic[];
    /** Human-readable formatted diagnostic output */
    formattedDiagnostics?: string;
    /** The parsed AST, if parsing succeeded (useful for tooling) */
    ast?: Program;
}
export interface TargetInfo {
    id: string;
    name: string;
    runtime: string;
    description: string;
}
export declare const TARGETS: TargetInfo[];
export declare const KEYWORDS: string[];
export declare function compile(source: string, target: Target, options?: CompileOptions): CompileResult;
export declare function validate(source: string): {
    valid: boolean;
    errors: Diagnostic[];
    warnings: Diagnostic[];
};
export declare function explain(source: string): string;
export declare function getHardwareProfile(target: string): HardwareProfile | undefined;
