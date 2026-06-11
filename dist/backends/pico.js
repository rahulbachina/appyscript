"use strict";
// AppyScript → MicroPython (Raspberry Pi Pico W) — v2
// Dedicated backend — NOT a string-replace of ESP32 output.
// Pico uses machine.Pin, machine.PWM, and uasyncio like ESP32,
// but different pin assignments and no built-in display.
Object.defineProperty(exports, "__esModule", { value: true });
exports.picoBackend = void 0;
exports.generatePico = generatePico;
const base_1 = require("../codegen/base");
const PICO_SENSORS = {
    distance: 'robot.sensor.distance()',
    light: 'robot.sensor.ldr()', // Pico: LDR on ADC pin
    temperature: 'robot.sensor.temperature()', // Pico: internal ADC temp
    touch: 'robot.sensor.touch()',
    acceleration: '0', // Pico W has no built-in IMU
};
class PicoCodegen extends base_1.BaseCodegen {
    sensorCall(sensor) {
        return PICO_SENSORS[sensor] ?? `robot.sensor.${sensor}()`;
    }
    generate(program, profile) {
        this.lines = [];
        this.indentLevel = 0;
        this.definedFunctions.clear();
        this.emitHeader(profile.name, profile.runtime);
        this.emit('# Pico W — applaa_robot_pico library required');
        this.emit('from applaa_robot_pico import Robot, wait_ms');
        this.emit('import uasyncio as asyncio');
        this.emit('from machine import Pin, PWM, ADC');
        this.emitBlank();
        this.emit('robot = Robot()');
        this.emitBlank();
        const defines = program.blocks.filter(b => b.kind === 'define');
        const whenBlocks = program.blocks.filter(b => b.kind === 'when');
        const foreverBlocks = program.blocks.filter(b => b.kind === 'forever');
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
        for (const block of whenBlocks) {
            if (block.kind === 'when')
                this.emitWhenHandler(block);
        }
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
        const { condition, interval } = this.triggerToPolling(block.trigger);
        if (condition) {
            this.emit('while True:');
            this.indent();
            if (interval) {
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
            case 'button_a': return { condition: 'robot.button_a.value() == 0' }; // active low
            case 'button_b': return { condition: 'robot.button_b.value() == 0' };
            case 'shaken': return { condition: 'robot.sensor.shaken()' };
            case 'tilted': return { condition: 'robot.sensor.tilted()' };
            case 'start': return {};
            case 'timer': {
                const ms = this.durationMs(trigger.interval);
                return { condition: 'True', interval: ms };
            }
            case 'received': return { condition: 'robot.radio.received()' };
            case 'sensor': {
                return { condition: `${this.sensorCall(trigger.sensor)} ${trigger.op} ${trigger.threshold}` };
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
                const duty = Math.round(speed * 655.35); // 0-65535 for Pico PWM
                this.emit(`# move ${stmt.direction} at ${speed}%`, loc);
                this.emit(`robot.drive(direction="${stmt.direction}", duty=${duty})`);
                if (ms > 0) {
                    this.emit(`await asyncio.sleep_ms(${ms})`);
                    this.emit('robot.stop()');
                }
                break;
            }
            case 'turn':
                this.emit(`robot.turn(direction="${stmt.direction}", degrees=${stmt.degrees})`, loc);
                break;
            case 'stop':
                this.emit('robot.stop()', loc);
                break;
            case 'say':
                // Pico W has no speaker — scroll over UART or optional I2C OLED
                this.emit(`print(${JSON.stringify(stmt.text)})   # say`, loc);
                break;
            case 'play':
                this.emit(`robot.buzzer.play(${JSON.stringify(stmt.sound)})`, loc);
                break;
            case 'show':
                // Pico has no display — print to serial
                this.emit(`print("expression: ${stmt.expression}")`, loc);
                break;
            case 'show_text':
                this.emit(`print(${JSON.stringify(stmt.text)})`, loc);
                break;
            case 'show_number':
                this.emit(`print(${this.emitValue(stmt.value)})`, loc);
                break;
            case 'wait':
                this.emit(`await asyncio.sleep_ms(${this.durationMs(stmt.duration)})`, loc);
                break;
            case 'send':
                this.emit(`robot.radio.send(str(${this.emitValue(stmt.message)}))`, loc);
                break;
            case 'let':
                this.emit(`${stmt.name} = ${this.emitValue(stmt.value)}`, loc);
                break;
            case 'set':
                this.emit(`${stmt.name} = ${this.emitValue(stmt.value)}`, loc);
                break;
            case 'remember':
                this.emit(`robot.nvm.save(${JSON.stringify(stmt.name)}, ${stmt.name})`, loc);
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
                this.emit('await asyncio.sleep_ms(10)');
                this.dedent();
                break;
        }
    }
}
exports.picoBackend = {
    targetId: 'pico',
    name: 'Raspberry Pi Pico W MicroPython Backend',
    version: '2.0.0',
    generate(program, profile) {
        return new PicoCodegen().generate(program, profile);
    },
};
function generatePico(program) {
    return exports.picoBackend.generate(program, {
        id: 'pico', name: 'Raspberry Pi Pico W', runtime: 'MicroPython',
        description: '', sensors: { distance: true, light: true, temperature: true, touch: true, acceleration: false },
        memory: { flashKB: 2048, ramKB: 264 }, supportsAsync: true, hasDisplay: false, hasRadio: true,
    }).code;
}
//# sourceMappingURL=pico.js.map