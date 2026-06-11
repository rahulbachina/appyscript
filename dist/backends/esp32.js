"use strict";
// AppyScript → MicroPython (ESP32 / M5Stack Core S3 SE) — v2
// Refactored to extend BaseCodegen. Async event handlers via uasyncio.
Object.defineProperty(exports, "__esModule", { value: true });
exports.esp32Backend = void 0;
exports.generateESP32 = generateESP32;
const base_1 = require("../codegen/base");
const ESP32_SENSORS = {
    distance: 'robot.sensor.distance()',
    light: 'robot.sensor.light()',
    temperature: 'robot.sensor.temperature()',
    touch: 'robot.sensor.touch()',
    acceleration: 'robot.sensor.acceleration_magnitude()',
};
class ESP32Codegen extends base_1.BaseCodegen {
    sensorCall(sensor) {
        return ESP32_SENSORS[sensor] ?? `robot.sensor.${sensor}()`;
    }
    generate(program, profile) {
        this.lines = [];
        this.indentLevel = 0;
        this.definedFunctions.clear();
        this.emitHeader(profile.name, profile.runtime);
        this.emit('from applaa_robot import Robot, wait_ms');
        this.emit('import uasyncio as asyncio');
        this.emitBlank();
        this.emit('robot = Robot()');
        this.emitBlank();
        const defines = program.blocks.filter(b => b.kind === 'define');
        const whenBlocks = program.blocks.filter(b => b.kind === 'when');
        const foreverBlocks = program.blocks.filter(b => b.kind === 'forever');
        // User-defined behaviours → Python functions
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
        // Event handlers → async tasks
        for (const block of whenBlocks) {
            if (block.kind === 'when')
                this.emitWhenHandler(block);
        }
        // Forever loops → async task
        for (const block of foreverBlocks) {
            if (block.kind !== 'forever')
                continue;
            this.emit('async def _forever_loop():', block.loc?.line);
            this.indent();
            this.emit('while True:');
            this.indent();
            this.emitStatements(block.body);
            this.emit('await asyncio.sleep_ms(10)');
            this.dedent();
            this.dedent();
            this.emitBlank();
        }
        // Main coroutine wires everything together
        this.emit('async def main():');
        this.indent();
        this.emit('tasks = []');
        for (const block of whenBlocks) {
            if (block.kind === 'when') {
                this.emit(`tasks.append(asyncio.create_task(_handler_${this.triggerName(block.trigger)}()))`);
            }
        }
        if (foreverBlocks.length > 0) {
            this.emit('tasks.append(asyncio.create_task(_forever_loop()))');
        }
        this.emit('await asyncio.gather(*tasks)');
        this.dedent();
        this.emitBlank();
        this.emit('asyncio.run(main())');
        return this.result();
    }
    emitWhenHandler(block) {
        const name = this.triggerName(block.trigger);
        this.emit(`async def _handler_${name}():`, block.loc?.line);
        this.indent();
        const { setup, condition, interval } = this.triggerToPolling(block.trigger);
        if (setup)
            this.emit(setup);
        if (condition) {
            this.emit('while True:');
            this.indent();
            if (interval) {
                // Timer: just run body then sleep
                this.emitStatements(block.body);
                this.emit(`await asyncio.sleep_ms(${interval})`);
            }
            else {
                this.emit(`if ${condition}:`);
                this.indent();
                this.emitStatements(block.body);
                this.dedent();
                this.emit('await asyncio.sleep_ms(50)');
            }
            this.dedent();
        }
        else {
            // One-shot (start)
            this.emitStatements(block.body);
        }
        this.dedent();
        this.emitBlank();
    }
    triggerName(trigger) {
        switch (trigger.kind) {
            case 'button_a': return 'button_a';
            case 'button_b': return 'button_b';
            case 'shaken': return 'shaken';
            case 'tilted': return `tilted${trigger.direction ? '_' + trigger.direction : ''}`;
            case 'start': return 'start';
            case 'timer': return `timer_${this.durationMs(trigger.interval)}ms`;
            case 'received': return 'received';
            case 'sensor': return `sensor_${trigger.sensor}`;
        }
    }
    triggerToPolling(trigger) {
        switch (trigger.kind) {
            case 'button_a': return { condition: 'robot.button_a()' };
            case 'button_b': return { condition: 'robot.button_b()' };
            case 'shaken': return { condition: 'robot.sensor.shaken()' };
            case 'tilted': return {
                condition: trigger.direction
                    ? `robot.sensor.tilted("${trigger.direction}")`
                    : 'robot.sensor.tilted()'
            };
            case 'start': return {}; // one-shot
            case 'timer': {
                const ms = this.durationMs(trigger.interval);
                return { condition: 'True', interval: ms };
            }
            case 'received': return { condition: 'robot.radio.received()' };
            case 'sensor': {
                const call = this.sensorCall(trigger.sensor);
                return { condition: `${call} ${trigger.op} ${trigger.threshold}` };
            }
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
                const ms = stmt.duration ? this.durationMs(stmt.duration) : 0;
                this.emit(`robot.move.${stmt.direction}(speed=${speed})`, loc);
                if (ms > 0) {
                    this.emit(`await asyncio.sleep_ms(${ms})`);
                    this.emit('robot.move.stop()');
                }
                break;
            }
            case 'turn':
                this.emit(`robot.move.turn_${stmt.direction}(degrees=${stmt.degrees})`, loc);
                break;
            case 'stop':
                this.emit('robot.move.stop()', loc);
                break;
            case 'say':
                this.emit(`robot.voice.say(${JSON.stringify(stmt.text)})`, loc);
                this.emit('await asyncio.sleep_ms(500)');
                break;
            case 'play':
                this.emit(`robot.voice.play(${JSON.stringify(stmt.sound)})`, loc);
                break;
            case 'show':
                this.emit(`robot.display.expression(${JSON.stringify(stmt.expression)})`, loc);
                break;
            case 'show_text':
                this.emit(`robot.display.show(${JSON.stringify(stmt.text)})`, loc);
                break;
            case 'show_number':
                this.emit(`robot.display.number(${this.emitValue(stmt.value)})`, loc);
                break;
            case 'wait':
                this.emit(`await asyncio.sleep_ms(${this.durationMs(stmt.duration)})`, loc);
                break;
            case 'send':
                this.emit(`robot.radio.send(${this.emitValue(stmt.message)})`, loc);
                break;
            case 'let':
                this.emit(`${stmt.name} = ${this.emitValue(stmt.value)}`, loc);
                break;
            case 'set':
                this.emit(`${stmt.name} = ${this.emitValue(stmt.value)}`, loc);
                break;
            case 'remember':
                this.emit(`robot.brain.remember(${JSON.stringify(stmt.name)}, ${stmt.name})`, loc);
                break;
            case 'do':
                if (this.definedFunctions.has(stmt.name)) {
                    this.emit(`${stmt.name}()`, loc);
                }
                else {
                    this.emit(`# Warning: '${stmt.name}' is not defined`, loc);
                }
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
                this.emit('await asyncio.sleep_ms(10)');
                this.dedent();
                break;
        }
    }
}
exports.esp32Backend = {
    targetId: 'esp32',
    name: 'ESP32 MicroPython Backend',
    version: '2.0.0',
    generate(program, profile) {
        return new ESP32Codegen().generate(program, profile);
    },
};
/** @deprecated Use esp32Backend.generate() */
function generateESP32(program) {
    const { code } = new ESP32Codegen().generate(program, {
        id: 'esp32', name: 'ESP32', runtime: 'MicroPython',
        description: '', sensors: { distance: true, light: true, temperature: true, touch: true, acceleration: true },
        memory: { flashKB: 8192, ramKB: 512 }, supportsAsync: true, hasDisplay: true, hasRadio: true,
    });
    return code;
}
//# sourceMappingURL=esp32.js.map