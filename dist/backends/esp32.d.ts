import type { Program } from '../ast';
import type { HardwareProfile, GenerateResult } from '../plugins';
export declare const esp32Backend: {
    targetId: string;
    name: string;
    version: string;
    generate(program: Program, profile: HardwareProfile): GenerateResult;
};
/** @deprecated Use esp32Backend.generate() */
export declare function generateESP32(program: Program): string;
