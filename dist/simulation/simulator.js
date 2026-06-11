"use strict";
// AppyScript Simulation Engine
// Executes the AppyScript AST in plain JavaScript — no hardware required.
// Useful for: testing programs, showing students what will happen,
// automated test suites, and the Applaa playground.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Simulator = void 0;
exports.simulate = simulate;
function durationMs(d) {
    if (d.unit === 'ms')
        return d.value;
    if (d.unit === 's')
        return d.value * 1000;
    return d.value * 60000;
}
// ── Simulator ─────────────────────────────────────────────────────────────────
class Simulator {
    state;
    events = [];
    trace = [];
    tick = 0;
    maxTicks;
    options;
    constructor(options = {}) {
        this.options = options;
        this.maxTicks = options.maxTicks ?? 1000;
    }
    run(program) {
        this.state = this.initialState();
        this.events = [];
        this.trace = [];
        this.tick = 0;
        // Apply sensor overrides
        if (this.options.sensors) {
            for (const [k, v] of Object.entries(this.options.sensors)) {
                this.state.sensors[k] = v;
            }
        }
        try {
            const defines = new Map();
            const starts = [];
            const polls = [];
            const forevers = [];
            for (const block of program.blocks) {
                if (block.kind === 'define')
                    defines.set(block.name, block);
                else if (block.kind === 'when' && block.trigger.kind === 'start')
                    starts.push(block);
                else if (block.kind === 'when')
                    polls.push(block);
                else if (block.kind === 'forever')
                    forevers.push(block);
            }
            // Run start blocks once
            for (const block of starts) {
                this.execStatements(block.body, defines, block.kind);
            }
            // Poll-based simulation: run up to maxTicks poll cycles
            for (let cycle = 0; cycle < this.maxTicks; cycle++) {
                this.tick++;
                for (const block of polls) {
                    if (block.kind !== 'when')
                        continue;
                    if (this.evalTrigger(block.trigger)) {
                        this.execStatements(block.body, defines, `when:${block.trigger.kind}`);
                    }
                }
                for (const block of forevers) {
                    if (block.kind !== 'forever')
                        continue;
                    this.execStatements(block.body, defines, 'forever');
                }
                // Stop if no forever or poll blocks
                if (polls.length === 0 && forevers.length === 0)
                    break;
            }
            return {
                success: true,
                events: this.events,
                finalState: this.state,
                ticks: this.tick,
                executionTrace: this.trace,
            };
        }
        catch (err) {
            return {
                success: false,
                events: this.events,
                finalState: this.state,
                ticks: this.tick,
                error: err instanceof Error ? err.message : String(err),
                executionTrace: this.trace,
            };
        }
    }
    initialState() {
        return {
            position: { x: 0, y: 0, heading: 0 },
            speed: 0,
            moving: false,
            expression: 'calm',
            displayText: '',
            variables: new Map(),
            memory: new Map(),
            sensors: {
                distance: 100,
                light: 50,
                temperature: 20,
                touch: 0,
                acceleration: 0,
            },
        };
    }
    evalTrigger(trigger) {
        switch (trigger.kind) {
            case 'button_a': return this.options.buttons?.a ?? false;
            case 'button_b': return this.options.buttons?.b ?? false;
            case 'shaken': return (this.options.triggerEvents ?? []).includes('shaken');
            case 'tilted': return (this.options.triggerEvents ?? []).includes('tilted');
            case 'received': return (this.options.triggerEvents ?? []).includes('received');
            case 'timer': return true; // simplified: always fires in sim
            case 'sensor': {
                const actual = this.state.sensors[trigger.sensor] ?? 0;
                return this.compare(actual, trigger.op, trigger.threshold);
            }
            default: return false;
        }
    }
    execStatements(stmts, defines, context) {
        for (const stmt of stmts) {
            this.execStatement(stmt, defines, context);
        }
    }
    execStatement(stmt, defines, context) {
        this.trace.push({
            tick: this.tick,
            blockKind: context,
            statementKind: stmt.kind,
            sourceLine: stmt.loc?.line,
            stateSnapshot: {
                position: { ...this.state.position },
                expression: this.state.expression,
            },
        });
        switch (stmt.kind) {
            case 'move': {
                const speed = stmt.speed ?? 50;
                const ms = stmt.duration ? durationMs(stmt.duration) : 0;
                this.state.moving = true;
                this.state.speed = speed;
                this.emitEvent('move', { direction: stmt.direction, speed, durationMs: ms });
                if (ms > 0) {
                    // Simulate position change
                    const dist = (speed / 100) * (ms / 1000) * 20; // 20 units/s at 100%
                    const heading = this.state.position.heading * (Math.PI / 180);
                    const dx = Math.sin(heading) * dist * (stmt.direction === 'backward' ? -1 : 1);
                    const dy = Math.cos(heading) * dist * (stmt.direction === 'backward' ? -1 : 1);
                    this.state.position.x += dx;
                    this.state.position.y += dy;
                    this.state.moving = false;
                    this.state.speed = 0;
                }
                break;
            }
            case 'turn': {
                const delta = stmt.direction === 'right' ? stmt.degrees : -stmt.degrees;
                this.state.position.heading = (this.state.position.heading + delta + 360) % 360;
                this.emitEvent('turn', { direction: stmt.direction, degrees: stmt.degrees });
                break;
            }
            case 'stop':
                this.state.moving = false;
                this.state.speed = 0;
                this.emitEvent('stop', {});
                break;
            case 'say':
                this.state.displayText = stmt.text;
                this.emitEvent('say', { text: stmt.text });
                break;
            case 'play':
                this.emitEvent('play', { sound: stmt.sound });
                break;
            case 'show':
                this.state.expression = stmt.expression;
                this.emitEvent('show', { expression: stmt.expression });
                break;
            case 'show_text':
                this.state.displayText = stmt.text;
                this.emitEvent('show_text', { text: stmt.text });
                break;
            case 'show_number':
                this.state.displayText = String(this.evalValue(stmt.value));
                this.emitEvent('show_text', { text: this.state.displayText });
                break;
            case 'wait':
                this.emitEvent('wait', { ms: durationMs(stmt.duration) });
                break;
            case 'send':
                this.emitEvent('send', { message: this.evalValue(stmt.message) });
                break;
            case 'let':
                this.state.variables.set(stmt.name, this.evalValue(stmt.value));
                break;
            case 'set':
                this.state.variables.set(stmt.name, this.evalValue(stmt.value));
                break;
            case 'remember':
                this.state.memory.set(stmt.name, this.state.variables.get(stmt.name) ?? 0);
                break;
            case 'do': {
                const def = defines.get(stmt.name);
                if (def && def.kind === 'define') {
                    this.execStatements(def.body, defines, `define:${stmt.name}`);
                }
                break;
            }
            case 'if': {
                const branch = this.evalCondition(stmt.condition);
                if (branch) {
                    this.execStatements(stmt.then, defines, context);
                }
                else if (stmt.else) {
                    this.execStatements(stmt.else, defines, context);
                }
                break;
            }
            case 'repeat': {
                const count = Number(this.evalValue(stmt.count));
                for (let i = 0; i < count && this.tick < this.maxTicks; i++) {
                    this.execStatements(stmt.body, defines, context);
                    this.tick++;
                }
                break;
            }
            case 'while': {
                let guard = 0;
                while (this.evalCondition(stmt.condition) && guard++ < 1000) {
                    this.execStatements(stmt.body, defines, context);
                    this.tick++;
                }
                break;
            }
        }
    }
    evalCondition(cond) {
        switch (cond.kind) {
            case 'sensor': return this.compare(this.state.sensors[cond.sensor] ?? 0, cond.op, cond.threshold);
            case 'variable': return this.compare(this.state.variables.get(cond.name) ?? 0, cond.op, this.evalValue(cond.value));
            case 'bool': return cond.value;
            case 'not': return !this.evalCondition(cond.condition);
            case 'and': return this.evalCondition(cond.left) && this.evalCondition(cond.right);
            case 'or': return this.evalCondition(cond.left) || this.evalCondition(cond.right);
        }
    }
    evalValue(value) {
        switch (value.kind) {
            case 'number': return value.value;
            case 'string': return value.value;
            case 'bool': return value.value;
            case 'variable': return this.state.variables.get(value.name) ?? 0;
            case 'sensor': return this.state.sensors[value.sensor] ?? 0;
            case 'binary': {
                const l = Number(this.evalValue(value.left));
                const r = Number(this.evalValue(value.right));
                switch (value.op) {
                    case '+': return l + r;
                    case '-': return l - r;
                    case '*': return l * r;
                    case '/': return r !== 0 ? l / r : 0;
                }
            }
        }
    }
    compare(left, op, right) {
        const l = Number(left), r = Number(right);
        switch (op) {
            case '<': return l < r;
            case '>': return l > r;
            case '<=': return l <= r;
            case '>=': return l >= r;
            case '==': return l === r;
            default: return false;
        }
    }
    emitEvent(type, data) {
        this.events.push({ type, data, tick: this.tick });
    }
}
exports.Simulator = Simulator;
/** Convenience function */
function simulate(program, options = {}) {
    return new Simulator(options).run(program);
}
//# sourceMappingURL=simulator.js.map