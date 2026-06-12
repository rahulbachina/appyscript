"use strict";
// AppyScript Compiler — v2
// Full pipeline: tokenize → parse → semantic analyse → lint → codegen
// Returns rich diagnostics, source maps, and (on success) generated code.
Object.defineProperty(exports, "__esModule", { value: true });
exports.KEYWORDS = exports.TARGETS = void 0;
exports.compile = compile;
exports.validate = validate;
exports.explain = explain;
exports.getHardwareProfile = getHardwareProfile;
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const semantic_1 = require("./analysis/semantic");
const linter_1 = require("./analysis/linter");
const diagnostics_1 = require("./diagnostics");
const plugins_1 = require("./plugins");
const esp32_1 = require("./backends/esp32");
const arduino_1 = require("./backends/arduino");
const microbit_1 = require("./backends/microbit");
const pico_1 = require("./backends/pico");
const circuitpython_1 = require("./backends/circuitpython");
// Register built-in backends
plugins_1.registry.register(esp32_1.esp32Backend);
plugins_1.registry.register(arduino_1.arduinoBackend);
plugins_1.registry.register(microbit_1.microbitBackend);
plugins_1.registry.register(pico_1.picoBackend);
plugins_1.registry.register(circuitpython_1.circuitpythonBackend);
exports.TARGETS = Object.values(plugins_1.HARDWARE_PROFILES).map(p => ({
    id: p.id,
    name: p.name,
    runtime: p.runtime,
    description: p.description,
}));
exports.KEYWORDS = [
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
];
// ── Main compile function ─────────────────────────────────────────────────────
function compile(source, target, options = {}) {
    const bag = new diagnostics_1.DiagnosticBag();
    // Step 1: Lex
    let tokens;
    try {
        tokens = (0, lexer_1.tokenize)(source);
    }
    catch (err) {
        if (err instanceof lexer_1.LexError) {
            bag.error(diagnostics_1.CODES.LEX_UNEXPECTED_CHAR, err.message, { line: err.line, col: err.col });
        }
        else {
            bag.error('E000', String(err));
        }
        return makeResult(false, bag, source);
    }
    // Step 2: Parse
    let ast;
    try {
        ast = (0, parser_1.parse)(tokens);
        ast.source = source;
    }
    catch (err) {
        if (err instanceof parser_1.ParseError) {
            bag.error(diagnostics_1.CODES.PARSE_UNEXPECTED_TOKEN, err.message, { line: err.line, col: err.col });
        }
        else {
            bag.error('E000', String(err));
        }
        return makeResult(false, bag, source);
    }
    // Step 3: Semantic analysis
    if (!options.skipSemantic) {
        const hardware = plugins_1.HARDWARE_PROFILES[target];
        const semBag = new semantic_1.SemanticAnalyser().analyse(ast, hardware);
        bag.merge(semBag);
        if (bag.hasErrors)
            return makeResult(false, bag, source, ast);
    }
    // Step 4: Linting
    if (!options.skipLint) {
        const lintBag = new linter_1.Linter().lint(ast);
        bag.merge(lintBag);
        if (options.strict && bag.hasErrors)
            return makeResult(false, bag, source, ast);
    }
    // Step 5: Code generation
    const backend = plugins_1.registry.get(target);
    if (!backend) {
        bag.error('E030', `Unknown target "${target}". Run appyscript list-targets to see options.`);
        return makeResult(false, bag, source, ast);
    }
    const profile = plugins_1.HARDWARE_PROFILES[target] ?? {
        id: target, name: target, runtime: 'Unknown',
        description: 'External backend',
        sensors: { distance: true, light: true, temperature: true, touch: true, acceleration: true },
        memory: { flashKB: 0, ramKB: 0 },
        supportsAsync: false, hasDisplay: false, hasRadio: false,
    };
    let genResult;
    try {
        genResult = backend.generate(ast, profile);
    }
    catch (err) {
        bag.error('E031', `Code generation failed: ${err}`);
        return makeResult(false, bag, source, ast);
    }
    return makeResult(true, bag, source, ast, genResult.code, genResult.sourceMap);
}
// ── validate() — check syntax only ───────────────────────────────────────────
function validate(source) {
    const result = compile(source, 'esp32', { skipSemantic: false, skipLint: true });
    return { valid: result.ok, errors: result.errors, warnings: result.warnings };
}
// ── explain() — plain English summary ────────────────────────────────────────
function explain(source) {
    try {
        const tokens = (0, lexer_1.tokenize)(source);
        const ast = (0, parser_1.parse)(tokens);
        const lines = [];
        for (const block of ast.blocks) {
            if (block.kind === 'when') {
                lines.push(`• When ${describeTrigger(block.trigger)}: runs ${block.body.length} action(s)`);
            }
            else if (block.kind === 'forever') {
                lines.push(`• Runs forever: loops ${block.body.length} action(s) continuously`);
            }
            else if (block.kind === 'define') {
                lines.push(`• Custom behaviour "${block.name}": ${block.body.length} action(s)`);
            }
        }
        return lines.join('\n') || 'Empty program';
    }
    catch {
        return 'Could not explain — program has errors';
    }
}
// ── getHardwareProfile() ──────────────────────────────────────────────────────
function getHardwareProfile(target) {
    return plugins_1.HARDWARE_PROFILES[target];
}
// ── Internal helpers ──────────────────────────────────────────────────────────
function makeResult(ok, bag, source, ast, code, sourceMap) {
    return {
        ok,
        code,
        sourceMap,
        diagnostics: [...bag.all],
        errors: bag.errors,
        warnings: bag.warnings,
        formattedDiagnostics: bag.all.length > 0 ? (0, diagnostics_1.formatDiagnostics)(bag.all, source) : undefined,
        ast,
    };
}
function describeTrigger(trigger) {
    switch (trigger.kind) {
        case 'button_a': return 'Button A is pressed';
        case 'button_b': return 'Button B is pressed';
        case 'shaken': return 'the robot is shaken';
        case 'tilted': return 'the robot is tilted';
        case 'start': return 'the program starts';
        case 'timer': return 'a timer fires';
        case 'received': return 'a wireless message is received';
        case 'sensor': {
            const s = trigger;
            return `${s.sensor} ${s.op} ${s.threshold}${s.unit ?? ''}`;
        }
        default: return trigger.kind;
    }
}
//# sourceMappingURL=compiler.js.map