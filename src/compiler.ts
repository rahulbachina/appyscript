// AppyScript Compiler — v2
// Full pipeline: tokenize → parse → semantic analyse → lint → codegen
// Returns rich diagnostics, source maps, and (on success) generated code.

import { tokenize, LexError } from './lexer'
import { parse, ParseError } from './parser'
import { SemanticAnalyser } from './analysis/semantic'
import { Linter } from './analysis/linter'
import { DiagnosticBag, Diagnostic, CODES, DiagnosticSeverity, formatDiagnostics } from './diagnostics'
import { registry, HARDWARE_PROFILES, HardwareProfile } from './plugins'
import { esp32Backend }   from './backends/esp32'
import { arduinoBackend } from './backends/arduino'
import { microbitBackend } from './backends/microbit'
import { picoBackend }    from './backends/pico'
import { circuitpythonBackend } from './backends/circuitpython'
import { homeassistantBackend } from './backends/homeassistant'
import { esphomeBackend }       from './backends/esphome'
import { noderedBackend }       from './backends/nodered'
import { homeBackend } from './backends/home'
import type { SourceMap } from './sourcemap'
import type { Program } from './ast'

// Register built-in backends
registry.register(esp32Backend)
registry.register(arduinoBackend)
registry.register(microbitBackend)
registry.register(picoBackend)
registry.register(circuitpythonBackend)
registry.register(homeBackend)
registry.register(homeassistantBackend)
registry.register(esphomeBackend)
registry.register(noderedBackend)

// Home hardware profile (virtual — no chip)
HARDWARE_PROFILES['home'] = {
  id: 'home',
  name: 'Applaa Home',
  runtime: 'MicroPython',
  description: 'Smart home devices controlled via Applaa Home guardrail layer.',
  sensors: { distance: false, light: false, temperature: false, touch: false, acceleration: false },
  memory: { flashKB: 0, ramKB: 0 },
  supportsAsync: false,
  hasDisplay: false,
  hasRadio: true,
}

export type Target = 'esp32' | 'arduino' | 'pico' | 'microbit' | string

export interface CompileOptions {
  /** Skip semantic analysis (faster, for trusted code) */
  skipSemantic?: boolean
  /** Skip linting (no warnings) */
  skipLint?: boolean
  /** Include source map in output */
  sourceMap?: boolean
  /** Treat lint warnings as errors */
  strict?: boolean
}

export interface CompileResult {
  ok: boolean
  code?: string
  sourceMap?: SourceMap
  diagnostics: Diagnostic[]
  /** Convenience: only error-severity diagnostics */
  errors: Diagnostic[]
  /** Convenience: only warning-severity diagnostics */
  warnings: Diagnostic[]
  /** Human-readable formatted diagnostic output */
  formattedDiagnostics?: string
  /** The parsed AST, if parsing succeeded (useful for tooling) */
  ast?: Program
}

export interface TargetInfo {
  id: string
  name: string
  runtime: string
  description: string
}

export const TARGETS: TargetInfo[] = Object.values(HARDWARE_PROFILES).map(p => ({
  id: p.id,
  name: p.name,
  runtime: p.runtime,
  description: p.description,
}))

export const KEYWORDS = [
  'when', 'on', 'forever', 'define', 'do',
  'if', 'else', 'repeat', 'times', 'while', 'until',
  'and', 'or', 'not', 'let', 'set', 'to', 'remember',
  'move', 'turn', 'spin', 'stop', 'say', 'play', 'show', 'wait', 'send',
  'forward', 'backward', 'back', 'left', 'right',
  'at', 'for', 'full', 'slow', 'fast', 'half',
  'button_a', 'button_b', 'shaken', 'tilted', 'start', 'timer', 'received',
  'distance', 'light', 'temperature', 'touch', 'acceleration',
  'happy', 'sad', 'thinking', 'excited', 'angry', 'alert', 'sleep', 'calm', 'confused', 'dizzy',
  'yes', 'no', 'true', 'false',
]

// ── Main compile function ─────────────────────────────────────────────────────

export function compile(source: string, target: Target, options: CompileOptions = {}): CompileResult {
  const bag = new DiagnosticBag()

  // Step 1: Lex
  let tokens
  try {
    tokens = tokenize(source)
  } catch (err) {
    if (err instanceof LexError) {
      bag.error(CODES.LEX_UNEXPECTED_CHAR, err.message, { line: err.line, col: err.col })
    } else {
      bag.error('E000', String(err))
    }
    return makeResult(false, bag, source)
  }

  // Step 2: Parse
  let ast: Program
  try {
    ast = parse(tokens)
    ast.source = source
  } catch (err) {
    if (err instanceof ParseError) {
      bag.error(CODES.PARSE_UNEXPECTED_TOKEN, err.message, { line: err.line, col: err.col })
    } else {
      bag.error('E000', String(err))
    }
    return makeResult(false, bag, source)
  }

  // Step 3: Semantic analysis
  if (!options.skipSemantic) {
    const hardware = HARDWARE_PROFILES[target]
    const semBag = new SemanticAnalyser().analyse(ast, hardware)
    bag.merge(semBag)
    if (bag.hasErrors) return makeResult(false, bag, source, ast)
  }

  // Step 4: Linting
  if (!options.skipLint) {
    const lintBag = new Linter().lint(ast)
    bag.merge(lintBag)
    if (options.strict && bag.hasErrors) return makeResult(false, bag, source, ast)
  }

  // Step 5: Code generation
  const backend = registry.get(target)
  if (!backend) {
    bag.error('E030', `Unknown target "${target}". Run appyscript list-targets to see options.`)
    return makeResult(false, bag, source, ast)
  }

  const profile = HARDWARE_PROFILES[target] ?? {
    id: target, name: target, runtime: 'Unknown' as any,
    description: 'External backend',
    sensors: { distance: true, light: true, temperature: true, touch: true, acceleration: true },
    memory: { flashKB: 0, ramKB: 0 },
    supportsAsync: false, hasDisplay: false, hasRadio: false,
  }

  let genResult
  try {
    genResult = backend.generate(ast, profile)
  } catch (err) {
    bag.error('E031', `Code generation failed: ${err}`)
    return makeResult(false, bag, source, ast)
  }

  return makeResult(true, bag, source, ast, genResult.code, genResult.sourceMap)
}

// ── validate() — check syntax only ───────────────────────────────────────────

export function validate(source: string): { valid: boolean; errors: Diagnostic[]; warnings: Diagnostic[] } {
  const result = compile(source, 'esp32', { skipSemantic: false, skipLint: true })
  return { valid: result.ok, errors: result.errors, warnings: result.warnings }
}

// ── explain() — plain English summary ────────────────────────────────────────

export function explain(source: string): string {
  try {
    const tokens = tokenize(source)
    const ast = parse(tokens)
    const lines: string[] = []

    for (const block of ast.blocks) {
      if (block.kind === 'when') {
        lines.push(`• When ${describeTrigger(block.trigger)}: runs ${block.body.length} action(s)`)
      } else if (block.kind === 'forever') {
        lines.push(`• Runs forever: loops ${block.body.length} action(s) continuously`)
      } else if (block.kind === 'define') {
        lines.push(`• Custom behaviour "${block.name}": ${block.body.length} action(s)`)
      }
    }

    return lines.join('\n') || 'Empty program'
  } catch {
    return 'Could not explain — program has errors'
  }
}

// ── getHardwareProfile() ──────────────────────────────────────────────────────

export function getHardwareProfile(target: string): HardwareProfile | undefined {
  return HARDWARE_PROFILES[target]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function makeResult(
  ok: boolean,
  bag: DiagnosticBag,
  source: string,
  ast?: Program,
  code?: string,
  sourceMap?: SourceMap
): CompileResult {
  return {
    ok,
    code,
    sourceMap,
    diagnostics: [...bag.all],
    errors: bag.errors,
    warnings: bag.warnings,
    formattedDiagnostics: bag.all.length > 0 ? formatDiagnostics(bag.all, source) : undefined,
    ast,
  }
}

function describeTrigger(trigger: { kind: string; [k: string]: unknown }): string {
  switch (trigger.kind) {
    case 'button_a':  return 'Button A is pressed'
    case 'button_b':  return 'Button B is pressed'
    case 'shaken':    return 'the robot is shaken'
    case 'tilted':    return 'the robot is tilted'
    case 'start':     return 'the program starts'
    case 'timer':     return 'a timer fires'
    case 'received':  return 'a wireless message is received'
    case 'sensor': {
      const s = trigger as unknown as { sensor: string; op: string; threshold: number; unit?: string }
      return `${s.sensor} ${s.op} ${s.threshold}${s.unit ?? ''}`
    }
    default: return trigger.kind
  }
}
