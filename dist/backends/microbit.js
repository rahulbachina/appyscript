"use strict";
// AppyScript → MicroPython (BBC micro:bit V2) — v2
// Refactored to extend BaseCodegen.
Object.defineProperty(exports, "__esModule", { value: true });
exports.microbitBackend = void 0;
exports.generateMicrobit = generateMicrobit;
const base_1 = require("../codegen/base");
const MICROBIT_SENSORS = {
    distance: '999', // no built-in distance sensor
    light: 'display.read_light_level()',
    temperature: 'temperature()',
    touch: 'pin_logo.is_touched()',
    acceleration: 'abs(accelerometer.get_z())',
};
class MicrobitCodegen extends base_1.BaseCodegen {
    sensorCall(sensor) {
        return MICROBIT_SENSORS[sensor] ?? '0';
    }
    generate(program, profile) {
        this.lines = [];
        this.indentLevel = 0;
        this.definedFunctions.clear();
        this.emitHeader(profile.name, profile.runtime);
        this.emit('from microbit import *');
        this.emit('import utime');
        this.emitBlank();
        const defines = program.blocks.filter(b => b.kind === 'define');
        const whenBlocks = program.blocks.filter(b => b.kind === 'when');
        const foreverBlocks = program.blocks.filter(b => b.kind === 'forever');
        const startBlocks = whenBlocks.filter(b => b.kind === 'when' && b.trigger.kind === 'start');
        const pollBlocks = whenBlocks.filter(b => b.kind === 'when' && b.trigger.kind !== 'start');
        // User-defined behaviours
        for (const block of defines) {
            if (block.kind !== 'define')
                continue;
            this.definedFunctions.add(block.name);
            this.emit(`def ${block.name}():`, block.loc?.line);
            this.indent();
            this.emitStatements(block.body);
            this.dedent();
            this.emitBlank();
        }
        // Run start blocks once, at top level
        for (const b of startBlocks) {
            if (b.kind === 'when')
                this.emitStatements(b.body);
        }
        if (pollBlocks.length > 0 || foreverBlocks.length > 0) {
            this.emit('while True:');
            this.indent();
            for (const block of pollBlocks) {
                if (block.kind !== 'when')
                    continue;
                const cond = this.triggerCondition(block.trigger);
                if (!cond)
                    continue;
                this.emit(`if ${cond}:`, block.loc?.line);
                this.indent();
                this.emitStatements(block.body);
                this.dedent();
            }
            for (const block of foreverBlocks) {
                if (block.kind !== 'forever')
                    continue;
                this.emitStatements(block.body);
            }
            this.emit('sleep(50)');
            this.dedent();
        }
        return this.result();
    }
    triggerCondition(trigger) {
        switch (trigger.kind) {
            case 'button_a': return 'button_a.is_pressed()';
            case 'button_b': return 'button_b.is_pressed()';
            case 'shaken': return 'accelerometer.is_gesture("shake")';
            case 'tilted':
                if (trigger.direction === 'left')
                    return 'accelerometer.is_gesture("left")';
                if (trigger.direction === 'right')
                    return 'accelerometer.is_gesture("right")';
                return 'accelerometer.is_gesture("face up")';
            case 'sensor':
                return `${this.sensorCall(trigger.sensor)} ${trigger.op} ${trigger.threshold}`;
            default: return null;
        }
    }
    emitStatements(stmts) {
        if (stmts.length === 0) {
            this.emit('pass');
            return;
        }
        for (const stmt of stmts)
            this.emitStatement(stmt);
    }
    emitStatement(stmt) {
        const loc = stmt.loc?.line;
        switch (stmt.kind) {
            case 'move': {
                const speed = stmt.speed ?? 50;
                const duty = Math.round(speed * 10.23);
                this.emit(`pin0.write_analog(${duty})   # ${stmt.direction} at ${speed}%`, loc);
                if (stmt.duration) {
                    this.emit(`sleep(${this.durationMs(stmt.duration)})`);
                    this.emit('pin0.write_analog(0)');
                    this.emit('pin1.write_analog(0)');
                }
                break;
            }
            case 'turn':
                this.emit(`# turn ${stmt.direction} ${stmt.degrees}°`, loc);
                break;
            case 'stop':
                this.emit('pin0.write_analog(0)', loc);
                this.emit('pin1.write_analog(0)');
                break;
            case 'say':
                this.emit(`display.scroll(${JSON.stringify(stmt.text)})`, loc);
                break;
            case 'play':
                this.emit(`# play "${stmt.sound}"`, loc);
                this.emit('audio.play(audio.SoundEffect(freq_start=440, freq_end=440, duration=500))');
                break;
            case 'show':
                this.emit(`display.show(${base_1.MICROBIT_IMAGES[stmt.expression] ?? 'Image.HAPPY'})`, loc);
                break;
            case 'show_text':
                this.emit(`display.scroll(${JSON.stringify(stmt.text)})`, loc);
                break;
            case 'show_number':
                this.emit(`display.scroll(str(${this.emitValue(stmt.value)}))`, loc);
                break;
            case 'wait':
                this.emit(`sleep(${this.durationMs(stmt.duration)})`, loc);
                break;
            case 'let':
                this.emit(`${stmt.name} = ${this.emitValue(stmt.value)}`, loc);
                break;
            case 'set':
                this.emit(`${stmt.name} = ${this.emitValue(stmt.value)}`, loc);
                break;
            case 'do':
                this.emit(this.definedFunctions.has(stmt.name) ? `${stmt.name}()` : `# Warning: '${stmt.name}' not defined`, loc);
                break;
            case 'if':
                this.emit(`if ${this.emitCondition(stmt.condition)}:`, loc);
                this.indent();
                this.emitStatements(stmt.then);
                this.dedent();
                if (stmt.else) {
                    this.emit('else:');
                    this.indent();
                    this.emitStatements(stmt.else);
                    this.dedent();
                }
                break;
            case 'repeat':
                this.emit(`for _i in range(${this.emitValue(stmt.count)}):`, loc);
                this.indent();
                this.emitStatements(stmt.body);
                this.dedent();
                break;
            case 'while':
                this.emit(`while ${this.emitCondition(stmt.condition)}:`, loc);
                this.indent();
                this.emitStatements(stmt.body);
                this.emit('sleep(10)');
                this.dedent();
                break;
            case 'send':
                this.emit(`radio.send(str(${this.emitValue(stmt.message)}))`, loc);
                break;
            case 'remember':
                this.emit(`# remember — micro:bit uses RAM only; add NVM library if needed`, loc);
                break;
        }
    }
}
exports.microbitBackend = {
    targetId: 'microbit',
    name: 'BBC micro:bit V2 MicroPython Backend',
    version: '2.0.0',
    generate(program, profile) {
        return new MicrobitCodegen().generate(program, profile);
    },
};
/** @deprecated */
function generateMicrobit(program) {
    return exports.microbitBackend.generate(program, {
        id: 'microbit', name: 'BBC micro:bit V2', runtime: 'MicroPython',
        description: '', sensors: { distance: false, light: true, temperature: true, touch: true, acceleration: true },
        memory: { flashKB: 512, ramKB: 128 }, supportsAsync: false, hasDisplay: true, hasRadio: true,
    }).code;
}
//# sourceMappingURL=microbit.js.map