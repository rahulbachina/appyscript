import type { Program } from '../ast';
import { DiagnosticBag } from '../diagnostics';
export declare class Linter {
    private bag;
    private triggerCounts;
    private usedBehaviours;
    private definedBehaviours;
    lint(program: Program): DiagnosticBag;
    private collectUsedBehaviours;
    private lintBlock;
    private lintStatements;
    private triggerKey;
}
