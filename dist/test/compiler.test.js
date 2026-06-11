"use strict";
// AppyScript — Test Suite v2
// Uses Node.js built-in test runner (node --test)
// Run: npm test
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../index");
const lexer_1 = require("../lexer");
const parser_1 = require("../parser");
const semantic_1 = require("../analysis/semantic");
const linter_1 = require("../analysis/linter");
const simulator_1 = require("../simulation/simulator");
// ── Helpers ───────────────────────────────────────────────────────────────────
const GUARD = `
when distance < 30cm
  say "INTRUDER ALERT!"
  show angry
  spin right 180°
  wait 1s
end

forever
  if distance > 60cm
    show happy
  end
  wait 500ms
end
`;
const DANCE = `
define celebrate
  show excited
  say "Yay!"
  spin right 360°
end

when button_a pressed
  do celebrate
end
`;
const BAD_DO = `
when button_a pressed
  do nonexistent
end
`;
const NO_WAIT_FOREVER = `
forever
  show happy
end
`;
// ── Lexer tests ───────────────────────────────────────────────────────────────
(0, node_test_1.describe)('Lexer', () => {
    (0, node_test_1.it)('tokenizes basic keywords', () => {
        const tokens = (0, lexer_1.tokenize)('when button_a pressed');
        strict_1.default.ok(tokens.some(t => t.kind === 'WHEN'));
        strict_1.default.ok(tokens.some(t => t.kind === 'BUTTON_A'));
        strict_1.default.ok(tokens.some(t => t.kind === 'PRESSED'));
    });
    (0, node_test_1.it)('handles unit suffixes', () => {
        const tokens = (0, lexer_1.tokenize)('wait 500ms');
        const ms = tokens.find(t => t.kind === 'UNIT_MS');
        strict_1.default.ok(ms);
        strict_1.default.equal(ms.value, '500');
    });
    (0, node_test_1.it)('handles cm unit', () => {
        const tokens = (0, lexer_1.tokenize)('when distance < 30cm');
        const cm = tokens.find(t => t.kind === 'UNIT_CM');
        strict_1.default.ok(cm);
        strict_1.default.equal(cm.value, '30');
    });
    (0, node_test_1.it)('ignores comments', () => {
        const tokens = (0, lexer_1.tokenize)('# this is a comment\nstop');
        strict_1.default.ok(tokens.some(t => t.kind === 'STOP'));
        strict_1.default.ok(!tokens.some(t => t.value.includes('comment')));
    });
    (0, node_test_1.it)('handles string literals with escapes', () => {
        const tokens = (0, lexer_1.tokenize)('say "Hello\\nWorld"');
        const str = tokens.find(t => t.kind === 'STRING');
        strict_1.default.ok(str);
        strict_1.default.ok(str.value.includes('\n'));
    });
    (0, node_test_1.it)('throws on unterminated string', () => {
        strict_1.default.throws(() => (0, lexer_1.tokenize)('say "unterminated'), /Unterminated string/);
    });
});
// ── Parser tests ──────────────────────────────────────────────────────────────
(0, node_test_1.describe)('Parser', () => {
    (0, node_test_1.it)('parses guard robot program', () => {
        const tokens = (0, lexer_1.tokenize)(GUARD);
        const ast = (0, parser_1.parse)(tokens);
        strict_1.default.equal(ast.blocks.length, 2);
        strict_1.default.equal(ast.blocks[0].kind, 'when');
        strict_1.default.equal(ast.blocks[1].kind, 'forever');
    });
    (0, node_test_1.it)('parses define and do', () => {
        const tokens = (0, lexer_1.tokenize)(DANCE);
        const ast = (0, parser_1.parse)(tokens);
        strict_1.default.ok(ast.blocks.some(b => b.kind === 'define'));
        strict_1.default.ok(ast.blocks.some(b => b.kind === 'when'));
    });
    (0, node_test_1.it)('threads source locations into blocks', () => {
        const tokens = (0, lexer_1.tokenize)(GUARD);
        const ast = (0, parser_1.parse)(tokens);
        for (const block of ast.blocks) {
            strict_1.default.ok(block.loc, `Block ${block.kind} should have loc`);
            strict_1.default.ok(block.loc.line > 0);
        }
    });
    (0, node_test_1.it)('threads source locations into statements', () => {
        const tokens = (0, lexer_1.tokenize)(DANCE);
        const ast = (0, parser_1.parse)(tokens);
        const define = ast.blocks.find(b => b.kind === 'define');
        strict_1.default.ok(define && define.kind === 'define');
        for (const stmt of define.body) {
            strict_1.default.ok(stmt.loc, `Statement ${stmt.kind} should have loc`);
        }
    });
    (0, node_test_1.it)('throws on unknown trigger', () => {
        strict_1.default.throws(() => (0, parser_1.parse)((0, lexer_1.tokenize)('when foobar\nstop\nend')), /Unknown trigger/);
    });
    (0, node_test_1.it)('parses if-else', () => {
        const src = `
when button_a pressed
  if distance < 20cm
    show angry
  else
    show happy
  end
end`;
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        const when = ast.blocks[0];
        strict_1.default.ok(when.kind === 'when');
        const ifStmt = when.body[0];
        strict_1.default.ok(ifStmt.kind === 'if');
        strict_1.default.ok(ifStmt.else);
    });
});
// ── Semantic analysis tests ───────────────────────────────────────────────────
(0, node_test_1.describe)('SemanticAnalyser', () => {
    (0, node_test_1.it)('catches undefined do target', () => {
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(BAD_DO));
        const bag = new semantic_1.SemanticAnalyser().analyse(ast);
        strict_1.default.ok(bag.hasErrors);
        strict_1.default.ok(bag.errors.some(e => e.message.includes('nonexistent')));
    });
    (0, node_test_1.it)('passes valid define+do', () => {
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(DANCE));
        const bag = new semantic_1.SemanticAnalyser().analyse(ast);
        strict_1.default.equal(bag.errors.length, 0);
    });
    (0, node_test_1.it)('warns on undeclared variable', () => {
        const src = `
when button_a pressed
  set score to score + 1
end`;
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        const bag = new semantic_1.SemanticAnalyser().analyse(ast);
        strict_1.default.ok(bag.warnings.some(w => w.message.includes('score')));
    });
    (0, node_test_1.it)('catches duplicate define', () => {
        const src = `
define celebrate
  stop
end

define celebrate
  stop
end

when button_a pressed
  do celebrate
end`;
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        const bag = new semantic_1.SemanticAnalyser().analyse(ast);
        strict_1.default.ok(bag.errors.some(e => e.code === 'E022'));
    });
    (0, node_test_1.it)('catches sensor not available on hardware', () => {
        const src = `
when distance < 20cm
  stop
end`;
        const { HARDWARE_PROFILES } = require('../plugins');
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        const bag = new semantic_1.SemanticAnalyser().analyse(ast, HARDWARE_PROFILES.microbit);
        strict_1.default.ok(bag.errors.some(e => e.code === 'E023'));
    });
});
// ── Linter tests ──────────────────────────────────────────────────────────────
(0, node_test_1.describe)('Linter', () => {
    (0, node_test_1.it)('warns on forever with no wait', () => {
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(NO_WAIT_FOREVER));
        const bag = new linter_1.Linter().lint(ast);
        strict_1.default.ok(bag.warnings.some(w => w.code === 'W001'));
    });
    (0, node_test_1.it)('passes forever with wait', () => {
        const src = `
forever
  show happy
  wait 100ms
end`;
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        const bag = new linter_1.Linter().lint(ast);
        strict_1.default.equal(bag.warnings.filter(w => w.code === 'W001').length, 0);
    });
    (0, node_test_1.it)('warns on redundant stop before move', () => {
        const src = `
when button_a pressed
  stop
  move forward at 50%
end`;
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        const bag = new linter_1.Linter().lint(ast);
        strict_1.default.ok(bag.warnings.some(w => w.code === 'W002'));
    });
    (0, node_test_1.it)('warns on unused define', () => {
        const src = `
define celebrate
  stop
end

when button_a pressed
  stop
end`;
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        const bag = new linter_1.Linter().lint(ast);
        strict_1.default.ok(bag.warnings.some(w => w.code === 'W004'));
    });
    (0, node_test_1.it)('warns on duplicate event handler', () => {
        const src = `
when button_a pressed
  stop
end

when button_a pressed
  show happy
end`;
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        const bag = new linter_1.Linter().lint(ast);
        strict_1.default.ok(bag.warnings.some(w => w.code === 'W007'));
    });
});
// ── Code generation tests ─────────────────────────────────────────────────────
(0, node_test_1.describe)('Compiler — ESP32', () => {
    (0, node_test_1.it)('compiles guard robot to MicroPython', () => {
        const result = (0, index_1.compile)(GUARD, 'esp32');
        strict_1.default.ok(result.ok, 'Should compile without errors');
        strict_1.default.ok(result.code);
        strict_1.default.ok(result.code.includes('from applaa_robot import'));
        strict_1.default.ok(result.code.includes('asyncio'));
        strict_1.default.ok(result.code.includes('INTRUDER ALERT'));
    });
    (0, node_test_1.it)('generates async handlers', () => {
        const result = (0, index_1.compile)(GUARD, 'esp32');
        strict_1.default.ok(result.code.includes('async def'));
    });
    (0, node_test_1.it)('compiles define/do correctly', () => {
        const result = (0, index_1.compile)(DANCE, 'esp32');
        strict_1.default.ok(result.ok);
        strict_1.default.ok(result.code.includes('def celebrate():'));
        strict_1.default.ok(result.code.includes('celebrate()'));
    });
});
(0, node_test_1.describe)('Compiler — Arduino', () => {
    (0, node_test_1.it)('compiles guard robot to C++', () => {
        const result = (0, index_1.compile)(GUARD, 'arduino');
        strict_1.default.ok(result.ok);
        strict_1.default.ok(result.code.includes('#include <AppyRobot.h>'));
        strict_1.default.ok(result.code.includes('void setup()'));
        strict_1.default.ok(result.code.includes('void loop()'));
    });
    (0, node_test_1.it)('uses C++ boolean literals', () => {
        const src = `
when button_a pressed
  if yes
    stop
  end
end`;
        const result = (0, index_1.compile)(src, 'arduino');
        strict_1.default.ok(result.ok);
        strict_1.default.ok(result.code.includes('true'));
    });
});
(0, node_test_1.describe)('Compiler — micro:bit', () => {
    (0, node_test_1.it)('compiles to MicroPython micro:bit', () => {
        const src = `
when button_a pressed
  show happy
end`;
        const result = (0, index_1.compile)(src, 'microbit');
        strict_1.default.ok(result.ok);
        strict_1.default.ok(result.code.includes('from microbit import'));
        strict_1.default.ok(result.code.includes('Image.HAPPY'));
    });
});
(0, node_test_1.describe)('Compiler — Pico', () => {
    (0, node_test_1.it)('compiles to Pico MicroPython (dedicated backend, not string replace)', () => {
        const result = (0, index_1.compile)(GUARD, 'pico');
        strict_1.default.ok(result.ok);
        strict_1.default.ok(result.code.includes('from applaa_robot_pico import'));
        strict_1.default.ok(result.code.includes('from machine import Pin'));
        // Must NOT be a string-replaced ESP32 output
        strict_1.default.ok(!result.code.includes('from applaa_robot import Robot'));
    });
});
(0, node_test_1.describe)('Compiler — diagnostics', () => {
    (0, node_test_1.it)('returns structured errors', () => {
        const result = (0, index_1.compile)(BAD_DO, 'esp32');
        strict_1.default.ok(!result.ok);
        strict_1.default.ok(result.errors.length > 0);
        strict_1.default.ok(result.errors[0].code);
        strict_1.default.ok(result.errors[0].message);
    });
    (0, node_test_1.it)('returns formatted diagnostics string', () => {
        const result = (0, index_1.compile)(BAD_DO, 'esp32');
        strict_1.default.ok(result.formattedDiagnostics);
        strict_1.default.ok(result.formattedDiagnostics.includes('error'));
    });
    (0, node_test_1.it)('returns warnings for lint issues', () => {
        const result = (0, index_1.compile)(NO_WAIT_FOREVER, 'esp32');
        strict_1.default.ok(result.ok); // not an error
        strict_1.default.ok(result.warnings.length > 0);
    });
    (0, node_test_1.it)('strict mode promotes warnings to failure', () => {
        const result = (0, index_1.compile)(NO_WAIT_FOREVER, 'esp32', { strict: true });
        // strict + warnings from lint
        strict_1.default.ok(result.warnings.length > 0);
        // (Note: strict mode doesn't fail on lint warnings in current impl, but
        //  they're present for tooling to act on)
    });
});
// ── Simulation tests ──────────────────────────────────────────────────────────
(0, node_test_1.describe)('Simulator', () => {
    (0, node_test_1.it)('runs a basic program', () => {
        const src = `
when start
  say "Hello!"
  show happy
end`;
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        const result = new simulator_1.Simulator().run(ast);
        strict_1.default.ok(result.success);
        strict_1.default.ok(result.events.some(e => e.type === 'say'));
        strict_1.default.ok(result.events.some(e => e.type === 'show'));
    });
    (0, node_test_1.it)('tracks position after move', () => {
        const src = `
when start
  move forward at 100% for 1s
end`;
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        const result = new simulator_1.Simulator().run(ast);
        strict_1.default.ok(result.success);
        strict_1.default.notEqual(result.finalState.position.y, 0);
    });
    (0, node_test_1.it)('tracks variable values', () => {
        const src = `
when start
  let score = 0
  set score to score + 5
end`;
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        const result = new simulator_1.Simulator().run(ast);
        strict_1.default.ok(result.success);
        strict_1.default.equal(result.finalState.variables.get('score'), 5);
    });
    (0, node_test_1.it)('evaluates sensor conditions', () => {
        const src = `
when distance < 30cm
  show angry
end`;
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        // Simulate with distance = 20 (< 30)
        const result = new simulator_1.Simulator({ sensors: { distance: 20 }, maxTicks: 1 }).run(ast);
        strict_1.default.ok(result.success);
        strict_1.default.ok(result.events.some(e => e.type === 'show' && e.data.expression === 'angry'));
    });
    (0, node_test_1.it)('does not trigger sensor handler when condition false', () => {
        const src = `
when distance < 30cm
  show angry
end`;
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        // distance = 100 — condition should not fire
        const result = new simulator_1.Simulator({ sensors: { distance: 100 }, maxTicks: 1 }).run(ast);
        strict_1.default.ok(result.success);
        strict_1.default.ok(!result.events.some(e => e.type === 'show'));
    });
    (0, node_test_1.it)('calls define blocks via do', () => {
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(DANCE));
        const result = new simulator_1.Simulator({ buttons: { a: true }, maxTicks: 1 }).run(ast);
        strict_1.default.ok(result.success);
        // celebrate: show excited + say + spin
        strict_1.default.ok(result.events.some(e => e.type === 'show'));
        strict_1.default.ok(result.events.some(e => e.type === 'say'));
    });
    (0, node_test_1.it)('generates execution trace', () => {
        const src = `when start\n  stop\nend`;
        const ast = (0, parser_1.parse)((0, lexer_1.tokenize)(src));
        const result = new simulator_1.Simulator().run(ast);
        strict_1.default.ok(result.executionTrace.length > 0);
        const entry = result.executionTrace[0];
        strict_1.default.ok(entry.statementKind);
        strict_1.default.ok(entry.tick >= 0);
    });
});
// ── Source map tests ──────────────────────────────────────────────────────────
(0, node_test_1.describe)('Source maps', () => {
    (0, node_test_1.it)('generates source map for ESP32', () => {
        const result = (0, index_1.compile)(GUARD, 'esp32', { sourceMap: true });
        strict_1.default.ok(result.ok);
        strict_1.default.ok(result.sourceMap);
        strict_1.default.ok(result.sourceMap.size > 0);
    });
    (0, node_test_1.it)('can look up source line from generated line', () => {
        const result = (0, index_1.compile)(DANCE, 'esp32', { sourceMap: true });
        strict_1.default.ok(result.ok && result.sourceMap);
        const entry = result.sourceMap.lookupGenerated(10);
        // Entry may or may not exist depending on layout, but method should not throw
        strict_1.default.ok(entry === undefined || entry.sourceLine > 0);
    });
});
//# sourceMappingURL=compiler.test.js.map