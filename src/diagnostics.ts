// AppyScript Diagnostics — v2
// Rich diagnostic system replacing simple CompileError.
// Provides: severity levels, error codes, source spans, fix suggestions,
// and a pretty-printer with source context.

export type DiagnosticSeverity = 'error' | 'warning' | 'hint'

export interface SourceSpan {
  line: number
  col: number
  length?: number   // characters on this line
}

export interface DiagnosticFix {
  description: string
  replacement?: string
}

export interface Diagnostic {
  severity: DiagnosticSeverity
  code: string            // e.g. "E001", "W003"
  message: string
  span?: SourceSpan
  hint?: string           // contextual help text
  fix?: DiagnosticFix     // suggested auto-fix
  relatedTo?: string      // e.g. name of the undefined function
}

// ── Known diagnostic codes ────────────────────────────────────────────────────

export const CODES = {
  // Lexer errors
  LEX_UNEXPECTED_CHAR:     'E001',
  LEX_UNTERMINATED_STRING: 'E002',

  // Parse errors
  PARSE_UNEXPECTED_TOKEN:  'E010',
  PARSE_UNKNOWN_TRIGGER:   'E011',
  PARSE_UNKNOWN_STATEMENT: 'E012',
  PARSE_MISSING_END:       'E013',
  PARSE_BAD_CONDITION:     'E014',

  // Semantic errors
  SEM_UNDEFINED_BEHAVIOUR: 'E020',
  SEM_UNDEFINED_VARIABLE:  'E021',
  SEM_DUPLICATE_DEFINE:    'E022',
  SEM_SENSOR_NOT_AVAILABLE:'E023',
  SEM_INVALID_SENSOR_UNIT: 'E024',

  // Lint warnings
  LINT_INFINITE_NO_WAIT:    'W001',
  LINT_REDUNDANT_STOP:      'W002',
  LINT_UNREACHABLE_CODE:    'W003',
  LINT_UNUSED_DEFINE:       'W004',
  LINT_REMEMBER_UNDEFINED:  'W005',
  LINT_WHILE_NO_WAIT:       'W006',
  LINT_DUPLICATE_HANDLER:   'W007',

  // Hints
  HINT_USE_FOREVER:         'H001',
  HINT_SPEED_MISSING:       'H002',
} as const

export type DiagnosticCode = typeof CODES[keyof typeof CODES]

// ── DiagnosticBag ─────────────────────────────────────────────────────────────

export class DiagnosticBag {
  private items: Diagnostic[] = []

  add(d: Diagnostic) { this.items.push(d) }

  error(code: string, message: string, span?: SourceSpan, hint?: string, fix?: DiagnosticFix) {
    this.add({ severity: 'error', code, message, span, hint, fix })
  }

  warning(code: string, message: string, span?: SourceSpan, hint?: string, fix?: DiagnosticFix) {
    this.add({ severity: 'warning', code, message, span, hint, fix })
  }

  hint(code: string, message: string, span?: SourceSpan) {
    this.add({ severity: 'hint', code, message, span })
  }

  get all(): readonly Diagnostic[] { return this.items }
  get errors(): Diagnostic[] { return this.items.filter(d => d.severity === 'error') }
  get warnings(): Diagnostic[] { return this.items.filter(d => d.severity === 'warning') }
  get hints(): Diagnostic[] { return this.items.filter(d => d.severity === 'hint') }
  get hasErrors(): boolean { return this.errors.length > 0 }

  merge(other: DiagnosticBag) {
    for (const d of other.all) this.add(d)
  }
}

// ── Pretty Printer ─────────────────────────────────────────────────────────────

const SEVERITY_ICON: Record<DiagnosticSeverity, string> = {
  error:   '✖ error',
  warning: '⚠ warning',
  hint:    '● hint',
}

const SEVERITY_PREFIX: Record<DiagnosticSeverity, string> = {
  error:   'E',
  warning: 'W',
  hint:    'H',
}

export function formatDiagnostics(
  diagnostics: readonly Diagnostic[],
  source?: string,
  filename = 'program.appy'
): string {
  if (diagnostics.length === 0) return ''

  const sourceLines = source ? source.split('\n') : []
  const parts: string[] = []

  for (const d of diagnostics) {
    const icon = SEVERITY_ICON[d.severity]
    const loc = d.span ? `${filename}:${d.span.line}:${d.span.col}` : filename
    parts.push(`${icon} [${d.code}] ${d.message}`)
    parts.push(`  → ${loc}`)

    // Show source line with caret
    if (d.span && sourceLines.length >= d.span.line) {
      const srcLine = sourceLines[d.span.line - 1]
      if (srcLine !== undefined) {
        parts.push('')
        parts.push(`  ${d.span.line.toString().padStart(4)} │ ${srcLine}`)
        const caretCol = d.span.col - 1
        const caretLen = d.span.length ?? 1
        parts.push(`       │ ${' '.repeat(caretCol)}${'~'.repeat(caretLen)}`)
      }
    }

    if (d.hint) parts.push(`  ℹ ${d.hint}`)
    if (d.fix)  parts.push(`  💡 Fix: ${d.fix.description}`)
    parts.push('')
  }

  const counts: string[] = []
  const errs   = diagnostics.filter(d => d.severity === 'error').length
  const warns  = diagnostics.filter(d => d.severity === 'warning').length
  const hints  = diagnostics.filter(d => d.severity === 'hint').length
  if (errs)  counts.push(`${errs} error${errs  > 1 ? 's' : ''}`)
  if (warns) counts.push(`${warns} warning${warns > 1 ? 's' : ''}`)
  if (hints) counts.push(`${hints} hint${hints > 1 ? 's' : ''}`)
  parts.push(counts.join(', '))

  return parts.join('\n')
}
