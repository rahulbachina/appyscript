import type { Program } from '../ast';
import type { HardwareProfile, GenerateResult } from '../plugins';
export declare const picoBackend: {
    targetId: string;
    name: string;
    version: string;
    generate(program: Program, profile: HardwareProfile): GenerateResult;
};
export declare function generatePico(program: Program): string;
