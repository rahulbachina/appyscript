"use strict";
// AppyScript Semantic Analyser
// Walks the AST after parsing and checks:
//   - All `do` targets reference a defined behaviour
//   - Variables are declared before they're read
//   - No duplicate `define` blocks
//   - Sensors referenced in conditions are plausible
//   - `remember` is called on an in-scope variable
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticAnalyser = void 0;
const diagnostics_1 = require("../diagnostics");
class SemanticAnalyser {
    bag = new diagnostics_1.DiagnosticBag();
    definedBehaviours = new Set();
    declaredVars = new Set();
    analyse(program, hardware) {
        this.bag = new diagnostics_1.DiagnosticBag();
        this.definedBehaviours.clear();
        this.declaredVars.clear();
        // First pass: collect all define names (allows forward references in separate blocks)
        for (const block of program.blocks) {
            if (block.kind === 'define') {
                if (this.definedBehaviours.has(block.name)) {
                    this.bag.error(diagnostics_1.CODES.SEM_DUPLICATE_DEFINE, `Behaviour "${block.name}" is defined more than once`, block.loc, `Remove or rename one of the "${block.name}" define blocks`);
                }
                this.definedBehaviours.add(block.name);
            }
        }
        // Second pass: full analysis
        for (const block of program.blocks) {
            this.analyseBlock(block, hardware);
        }
        return this.bag;
    }
    analyseBlock(block, hardware) {
        if (block.kind === 'when') {
            this.analyseTriggerHardware(block.trigger, hardware, block.loc);
            this.analyseStatements(block.body, hardware);
        }
        else if (block.kind === 'forever') {
            this.analyseStatements(block.body, hardware);
        }
        else if (block.kind === 'define') {
            this.analyseStatements(block.body, hardware);
        }
    }
    analyseTriggerHardware(trigger, hardware, loc) {
        if (!hardware)
            return;
        if (trigger.kind === 'sensor') {
            const sensor = trigger.sensor;
            if (!hardware.sensors[sensor]) {
                this.bag.error(diagnostics_1.CODES.SEM_SENSOR_NOT_AVAILABLE, `Sensor "${sensor}" is not available on ${hardware.name}`, loc, `Remove this handler or choose a target that has a ${sensor} sensor`);
            }
        }
    }
    analyseStatements(stmts, hardware) {
        for (const stmt of stmts) {
            this.analyseStatement(stmt, hardware);
        }
    }
    analyseStatement(stmt, hardware) {
        const loc = stmt.loc;
        switch (stmt.kind) {
            case 'let':
                this.analyseValue(stmt.value, loc);
                this.declaredVars.add(stmt.name);
                break;
            case 'set':
                this.analyseValue(stmt.value, loc);
                if (!this.declaredVars.has(stmt.name)) {
                    this.bag.warning(diagnostics_1.CODES.SEM_UNDEFINED_VARIABLE, `Variable "${stmt.name}" is set but was never declared with "let"`, loc, `Add "let ${stmt.name} = 0" before this line`, { description: `Add let ${stmt.name} = 0 before this block` });
                    // Auto-register it so we don't spam the same warning
                    this.declaredVars.add(stmt.name);
                }
                break;
            case 'remember':
                if (!this.declaredVars.has(stmt.name)) {
                    this.bag.warning(diagnostics_1.CODES.LINT_REMEMBER_UNDEFINED, `"remember ${stmt.name}" — variable "${stmt.name}" has not been declared`, loc, `Declare the variable first with "let ${stmt.name} = value"`);
                }
                break;
            case 'do':
                if (!this.definedBehaviours.has(stmt.name)) {
                    this.bag.error(diagnostics_1.CODES.SEM_UNDEFINED_BEHAVIOUR, `Behaviour "${stmt.name}" is not defined`, loc, `Add a "define ${stmt.name}" block, or check the spelling`, { description: `Add: define ${stmt.name}\n  ...\nend` });
                }
                break;
            case 'if':
                this.analyseCondition(stmt.condition, loc, hardware);
                this.analyseStatements(stmt.then, hardware);
                if (stmt.else)
                    this.analyseStatements(stmt.else, hardware);
                break;
            case 'repeat':
                this.analyseValue(stmt.count, loc);
                this.analyseStatements(stmt.body, hardware);
                break;
            case 'while':
                this.analyseCondition(stmt.condition, loc, hardware);
                this.analyseStatements(stmt.body, hardware);
                break;
            case 'move':
            case 'turn':
            case 'stop':
            case 'say':
            case 'play':
            case 'show':
            case 'show_text':
            case 'wait':
                // No semantic checks needed for these primitive actions
                break;
            case 'show_number':
                this.analyseValue(stmt.value, loc);
                break;
            case 'send':
                this.analyseValue(stmt.message, loc);
                break;
        }
    }
    analyseCondition(cond, loc, hardware) {
        if (cond.kind === 'variable') {
            if (!this.declaredVars.has(cond.name)) {
                this.bag.warning(diagnostics_1.CODES.SEM_UNDEFINED_VARIABLE, `Variable "${cond.name}" used in condition but never declared with "let"`, loc, `Add "let ${cond.name} = 0" before this block`);
            }
        }
        if (cond.kind === 'sensor' && hardware && !hardware.sensors[cond.sensor]) {
            this.bag.error(diagnostics_1.CODES.SEM_SENSOR_NOT_AVAILABLE, `Sensor "${cond.sensor}" is not available on ${hardware.name}`, loc);
        }
        if (cond.kind === 'not')
            this.analyseCondition(cond.condition, loc, hardware);
        if (cond.kind === 'and' || cond.kind === 'or') {
            this.analyseCondition(cond.left, loc, hardware);
            this.analyseCondition(cond.right, loc, hardware);
        }
    }
    analyseValue(value, loc) {
        if (value.kind === 'variable') {
            if (!this.declaredVars.has(value.name)) {
                this.bag.warning(diagnostics_1.CODES.SEM_UNDEFINED_VARIABLE, `Variable "${value.name}" used but never declared with "let"`, loc, `Add "let ${value.name} = 0" before this block`);
            }
        }
        if (value.kind === 'binary') {
            this.analyseValue(value.left, loc);
            this.analyseValue(value.right, loc);
        }
    }
}
exports.SemanticAnalyser = SemanticAnalyser;
//# sourceMappingURL=semantic.js.map