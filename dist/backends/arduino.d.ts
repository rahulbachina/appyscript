import type { Program } from '../ast';
import type { HardwareProfile, GenerateResult } from '../plugins';
export declare const arduinoBackend: {
    targetId: string;
    name: string;
    version: string;
    generate(program: Program, profile: HardwareProfile): GenerateResult;
};
/** @deprecated */
export declare function generateArduino(program: Program): string;
