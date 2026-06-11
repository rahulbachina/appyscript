export type DiagnosticSeverity = 'error' | 'warning' | 'hint';
export interface SourceSpan {
    line: number;
    col: number;
    length?: number;
}
export interface DiagnosticFix {
    description: string;
    replacement?: string;
}
export interface Diagnostic {
    severity: DiagnosticSeverity;
    code: string;
    message: string;
    span?: SourceSpan;
    hint?: string;
    fix?: DiagnosticFix;
    relatedTo?: string;
}
export declare const CODES: {
    readonly LEX_UNEXPECTED_CHAR: "E001";
    readonly LEX_UNTERMINATED_STRING: "E002";
    readonly PARSE_UNEXPECTED_TOKEN: "E010";
    readonly PARSE_UNKNOWN_TRIGGER: "E011";
    readonly PARSE_UNKNOWN_STATEMENT: "E012";
    readonly PARSE_MISSING_END: "E013";
    readonly PARSE_BAD_CONDITION: "E014";
    readonly SEM_UNDEFINED_BEHAVIOUR: "E020";
    readonly SEM_UNDEFINED_VARIABLE: "E021";
    readonly SEM_DUPLICATE_DEFINE: "E022";
    readonly SEM_SENSOR_NOT_AVAILABLE: "E023";
    readonly SEM_INVALID_SENSOR_UNIT: "E024";
    readonly LINT_INFINITE_NO_WAIT: "W001";
    readonly LINT_REDUNDANT_STOP: "W002";
    readonly LINT_UNREACHABLE_CODE: "W003";
    readonly LINT_UNUSED_DEFINE: "W004";
    readonly LINT_REMEMBER_UNDEFINED: "W005";
    readonly LINT_WHILE_NO_WAIT: "W006";
    readonly LINT_DUPLICATE_HANDLER: "W007";
    readonly HINT_USE_FOREVER: "H001";
    readonly HINT_SPEED_MISSING: "H002";
};
export type DiagnosticCode = typeof CODES[keyof typeof CODES];
export declare class DiagnosticBag {
    private items;
    add(d: Diagnostic): void;
    error(code: string, message: string, span?: SourceSpan, hint?: string, fix?: DiagnosticFix): void;
    warning(code: string, message: string, span?: SourceSpan, hint?: string, fix?: DiagnosticFix): void;
    hint(code: string, message: string, span?: SourceSpan): void;
    get all(): readonly Diagnostic[];
    get errors(): Diagnostic[];
    get warnings(): Diagnostic[];
    get hints(): Diagnostic[];
    get hasErrors(): boolean;
    merge(other: DiagnosticBag): void;
}
export declare function formatDiagnostics(diagnostics: readonly Diagnostic[], source?: string, filename?: string): string;
