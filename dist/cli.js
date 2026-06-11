#!/usr/bin/env node
"use strict";
// AppyScript CLI — v2
// Usage:
//   appyscript compile <file> --target <target> [--strict] [--source-map]
//   appyscript validate <file>
//   appyscript explain <file>
//   appyscript simulate <file> [--sensor-distance=50] [--button-a]
//   appyscript list-targets
//   appyscript list-keywords
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const compiler_1 = require("./compiler");
const simulator_1 = require("./simulation/simulator");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const args = process.argv.slice(2);
const command = args[0];
function flag(name) {
    return args.some(a => a === `--${name}`);
}
function option(name) {
    // Handle --key value (space)
    const spaceIdx = args.indexOf(`--${name}`);
    if (spaceIdx !== -1 && spaceIdx + 1 < args.length && !args[spaceIdx + 1].startsWith("--")) {
        return args[spaceIdx + 1];
    }
    const prefix = `--${name}=`;
    const arg = args.find(a => a.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : undefined;
}
function readFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    return fs.readFileSync(filePath, 'utf-8');
}
function printDivider() {
    console.log('─'.repeat(60));
}
switch (command) {
    case 'compile': {
        const file = args[1];
        if (!file) {
            console.error('Usage: appyscript compile <file> --target <target>');
            process.exit(1);
        }
        const target = option('target') ?? 'esp32';
        const strict = flag('strict');
        const withMap = flag('source-map');
        const source = readFile(file);
        console.log(`\nAppyScript Compiler v2`);
        printDivider();
        console.log(`  File   : ${path.resolve(file)}`);
        console.log(`  Target : ${target}`);
        if (strict)
            console.log(`  Mode   : strict (warnings = errors)`);
        printDivider();
        const result = (0, compiler_1.compile)(source, target, { strict, sourceMap: withMap });
        if (result.formattedDiagnostics) {
            console.log('\n' + result.formattedDiagnostics);
        }
        if (result.ok && result.code) {
            const outFile = file.replace(/\.appy$/, `.${target === 'arduino' ? 'ino' : 'py'}`);
            fs.writeFileSync(outFile, result.code);
            console.log(`\n✔ Compiled → ${outFile}`);
            console.log(`  ${result.code.split('\n').length} lines of ${target === 'arduino' ? 'C++' : 'MicroPython'}`);
            if (withMap && result.sourceMap) {
                const mapFile = outFile + '.map';
                fs.writeFileSync(mapFile, JSON.stringify(result.sourceMap.toJSON(), null, 2));
                console.log(`  Source map → ${mapFile}`);
            }
            if (result.warnings.length > 0) {
                console.log(`\n  ${result.warnings.length} warning(s) — run with --strict to treat as errors`);
            }
        }
        else {
            console.error(`\n✖ Compilation failed — ${result.errors.length} error(s)`);
            process.exit(1);
        }
        break;
    }
    case 'validate': {
        const file = args[1];
        if (!file) {
            console.error('Usage: appyscript validate <file>');
            process.exit(1);
        }
        const source = readFile(file);
        const result = (0, compiler_1.validate)(source);
        if (result.valid) {
            console.log(`✔ ${file} — valid AppyScript`);
            if (result.warnings.length > 0) {
                console.log(`  ${result.warnings.length} warning(s)`);
                for (const w of result.warnings) {
                    console.log(`  ⚠ [${w.code}] ${w.message}`);
                    if (w.span)
                        console.log(`    → Line ${w.span.line}`);
                }
            }
        }
        else {
            console.error(`✖ ${file} — ${result.errors.length} error(s)`);
            for (const e of result.errors) {
                console.error(`  ✖ [${e.code}] ${e.message}`);
                if (e.span)
                    console.error(`    → Line ${e.span.line}:${e.span.col}`);
                if (e.hint)
                    console.error(`    ℹ ${e.hint}`);
            }
            process.exit(1);
        }
        break;
    }
    case 'explain': {
        const file = args[1];
        if (!file) {
            console.error('Usage: appyscript explain <file>');
            process.exit(1);
        }
        const source = readFile(file);
        console.log(`\nProgram summary: ${path.basename(file)}`);
        printDivider();
        console.log((0, compiler_1.explain)(source));
        break;
    }
    case 'simulate': {
        const file = args[1];
        if (!file) {
            console.error('Usage: appyscript simulate <file>');
            process.exit(1);
        }
        const source = readFile(file);
        // Parse sensor overrides from CLI
        const sensors = {};
        for (const sName of ['distance', 'light', 'temperature', 'touch', 'acceleration']) {
            const val = option(`sensor-${sName}`);
            if (val !== undefined)
                sensors[sName] = Number(val);
        }
        const tokens = (0, lexer_1.tokenize)(source);
        const ast = (0, parser_1.parse)(tokens);
        const result = (0, simulator_1.simulate)(ast, {
            sensors: sensors,
            buttons: { a: flag('button-a'), b: flag('button-b') },
            triggerEvents: [
                ...(flag('shaken') ? ['shaken'] : []),
                ...(flag('tilted') ? ['tilted'] : []),
            ],
            maxTicks: Number(option('max-ticks') ?? '50'),
        });
        console.log(`\nSimulation: ${path.basename(file)}`);
        printDivider();
        console.log(`  Result : ${result.success ? '✔ Success' : '✖ Error'}`);
        console.log(`  Ticks  : ${result.ticks}`);
        console.log(`  Events : ${result.events.length}`);
        if (result.error)
            console.log(`  Error  : ${result.error}`);
        printDivider();
        console.log('\nEvent log:');
        for (const ev of result.events) {
            const detail = Object.entries(ev.data).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
            console.log(`  [${String(ev.tick).padStart(3)}] ${ev.type.padEnd(10)} ${detail}`);
        }
        printDivider();
        const s = result.finalState;
        console.log('\nFinal robot state:');
        console.log(`  Position   : x=${s.position.x.toFixed(1)}, y=${s.position.y.toFixed(1)}, heading=${s.position.heading}°`);
        console.log(`  Expression : ${s.expression}`);
        console.log(`  Display    : ${s.displayText || '(blank)'}`);
        if (s.variables.size > 0) {
            console.log('  Variables  :');
            for (const [k, v] of s.variables)
                console.log(`    ${k} = ${v}`);
        }
        break;
    }
    case 'list-targets': {
        console.log('\nSupported hardware targets:\n');
        for (const t of compiler_1.TARGETS) {
            console.log(`  ${t.id.padEnd(10)} ${t.name.padEnd(30)} (${t.runtime})`);
            console.log(`             ${t.description}`);
            console.log();
        }
        break;
    }
    case 'list-keywords': {
        console.log('\nAppyScript keywords:\n');
        const cols = 6;
        for (let i = 0; i < compiler_1.KEYWORDS.length; i += cols) {
            console.log('  ' + compiler_1.KEYWORDS.slice(i, i + cols).map(k => k.padEnd(14)).join(''));
        }
        console.log();
        break;
    }
    default: {
        console.log(`
AppyScript v2 — The English-first robotics language

Usage:
  appyscript compile   <file.appy> --target <target> [--strict] [--source-map]
  appyscript validate  <file.appy>
  appyscript explain   <file.appy>
  appyscript simulate  <file.appy> [--sensor-distance=50] [--button-a] [--shaken]
  appyscript list-targets
  appyscript list-keywords

Targets: esp32 | arduino | pico | microbit
`);
        break;
    }
}
//# sourceMappingURL=cli.js.map