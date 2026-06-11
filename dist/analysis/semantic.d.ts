import type { Program } from '../ast';
import { DiagnosticBag } from '../diagnostics';
import type { HardwareProfile } from '../plugins';
export declare class SemanticAnalyser {
    private bag;
    private definedBehaviours;
    private declaredVars;
    analyse(program: Program, hardware?: HardwareProfile): DiagnosticBag;
    private analyseBlock;
    private analyseTriggerHardware;
    private analyseStatements;
    private analyseStatement;
    private analyseCondition;
    private analyseValue;
}
