"use strict";
// AppyScript Linter
// Checks for common programming mistakes and style issues that aren't
// hard errors but will cause unexpected robot behaviour.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Linter = void 0;
const diagnostics_1 = require("../diagnostics");
function durationMs(d) {
    if (d.unit === 'ms')
        return d.value;
    if (d.unit === 's')
        return d.value * 1000;
    return d.value * 60000;
}
function bodyHasWait(stmts) {
    for (const stmt of stmts) {
        if (stmt.kind === 'wait')
            return true;
        if (stmt.kind === 'if') {
            if (bodyHasWait(stmt.then))
                return true;
            if (stmt.else && bodyHasWait(stmt.else))
                return true;
        }
        if (stmt.kind === 'repeat' && bodyHasWait(stmt.body))
            return true;
    }
    return false;
}
function countConsecutiveKinds(stmts, kinds) {
    let count = 0;
    for (const s of stmts) {
        if (kinds.includes(s.kind))
            count++;
        else
            count = 0;
    }
    return count;
}
class Linter {
    bag = new diagnostics_1.DiagnosticBag();
    triggerCounts = new Map();
    usedBehaviours = new Set();
    definedBehaviours = new Set();
    lint(program) {
        this.bag = new diagnostics_1.DiagnosticBag();
        this.triggerCounts.clear();
        this.usedBehaviours.clear();
        this.definedBehaviours.clear();
        // Collect defined behaviours and used behaviours
        for (const block of program.blocks) {
            if (block.kind === 'define')
                this.definedBehaviours.add(block.name);
        }
        for (const block of program.blocks) {
            this.collectUsedBehaviours(block.kind !== 'define' ? [] : block.body);
        }
        for (const block of program.blocks) {
            this.lintBlock(block);
        }
        // Warn on unused define blocks
        for (const name of this.definedBehaviours) {
            if (!this.usedBehaviours.has(name)) {
                this.bag.warning(diagnostics_1.CODES.LINT_UNUSED_DEFINE, `Behaviour "${name}" is defined but never called with "do ${name}"`, undefined, `Call it with "do ${name}" or remove it if it's not needed`);
            }
        }
        return this.bag;
    }
    collectUsedBehaviours(stmts) {
        for (const stmt of stmts) {
            if (stmt.kind === 'do')
                this.usedBehaviours.add(stmt.name);
            if (stmt.kind === 'if') {
                this.collectUsedBehaviours(stmt.then);
                if (stmt.else)
                    this.collectUsedBehaviours(stmt.else);
            }
            if (stmt.kind === 'repeat' || stmt.kind === 'while') {
                this.collectUsedBehaviours(stmt.body);
            }
        }
    }
    lintBlock(block) {
        if (block.kind === 'when') {
            // Track duplicate event handlers
            const key = this.triggerKey(block.trigger);
            const count = (this.triggerCounts.get(key) ?? 0) + 1;
            this.triggerCounts.set(key, count);
            if (count === 2) {
                this.bag.warning(diagnostics_1.CODES.LINT_DUPLICATE_HANDLER, `Duplicate event handler: "${key}" is handled more than once`, block.loc, `Only the first matching handler runs on most targets. Merge them into one block.`);
            }
            this.lintStatements(block.body);
        }
        if (block.kind === 'forever') {
            if (!bodyHasWait(block.body)) {
                this.bag.warning(diagnostics_1.CODES.LINT_INFINITE_NO_WAIT, `"forever" loop has no "wait" — it will run at full CPU speed`, block.loc, `Add "wait 10ms" or "wait 100ms" at the end of the loop to prevent the robot from freezing`, { description: 'Add wait 10ms at end of forever block' });
            }
            this.lintStatements(block.body);
        }
        if (block.kind === 'define') {
            this.lintStatements(block.body);
        }
    }
    lintStatements(stmts) {
        for (let i = 0; i < stmts.length; i++) {
            const stmt = stmts[i];
            const next = stmts[i + 1];
            // Redundant stop before move
            if (stmt.kind === 'stop' && next?.kind === 'move') {
                this.bag.warning(diagnostics_1.CODES.LINT_REDUNDANT_STOP, `Redundant "stop" immediately before "move" — move already resets motors`, stmt.loc, `Remove the "stop" line`, { description: 'Remove redundant stop' });
            }
            // Unreachable code after a standalone stop with no condition
            // (only flag if stop is last in a when block — not inside if)
            if (stmt.kind === 'stop' && next && next.kind !== 'wait') {
                // Don't flag — stop doesn't halt the program
            }
            // While with no wait inside
            if (stmt.kind === 'while' && !bodyHasWait(stmt.body)) {
                this.bag.warning(diagnostics_1.CODES.LINT_WHILE_NO_WAIT, `"while" loop has no "wait" — it may spin at full CPU speed`, stmt.loc, `Add "wait 10ms" inside the while loop`);
            }
            // Recurse into nested blocks
            if (stmt.kind === 'if') {
                this.lintStatements(stmt.then);
                if (stmt.else)
                    this.lintStatements(stmt.else);
            }
            if (stmt.kind === 'repeat')
                this.lintStatements(stmt.body);
            if (stmt.kind === 'while')
                this.lintStatements(stmt.body);
        }
    }
    triggerKey(trigger) {
        switch (trigger.kind) {
            case 'button_a': return 'button_a pressed';
            case 'button_b': return 'button_b pressed';
            case 'shaken': return 'shaken';
            case 'tilted': return `tilted ${trigger.direction ?? ''}`;
            case 'start': return 'start';
            case 'timer': return `every ${durationMs(trigger.interval)}ms`;
            case 'received': return 'received';
            case 'sensor': return `sensor:${trigger.sensor} ${trigger.op} ${trigger.threshold}`;
            default: return String(trigger.kind);
        }
    }
}
exports.Linter = Linter;
//# sourceMappingURL=linter.js.map