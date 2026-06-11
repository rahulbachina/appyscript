import type { Program } from './ast';
import type { SourceMap } from './sourcemap';
export interface HardwareProfile {
    /** Short identifier used in CLI / compile() */
    id: string;
    /** Display name */
    name: string;
    /** Runtime language */
    runtime: 'MicroPython' | 'C++' | 'CircuitPython';
    /** Human description */
    description: string;
    /** Which sensors are wired up on this platform */
    sensors: {
        distance: boolean;
        light: boolean;
        temperature: boolean;
        touch: boolean;
        acceleration: boolean;
    };
    /** Rough memory budget */
    memory: {
        flashKB: number;
        ramKB: number;
    };
    /** True if the platform supports async event handlers */
    supportsAsync: boolean;
    /** True if the platform supports a built-in display */
    hasDisplay: boolean;
    /** True if wireless comms are available */
    hasRadio: boolean;
}
export declare const HARDWARE_PROFILES: Record<string, HardwareProfile>;
export interface GenerateResult {
    code: string;
    sourceMap?: SourceMap;
    warnings?: string[];
}
export interface BackendPlugin {
    /** Matches HardwareProfile.id */
    targetId: string;
    /** Human-readable name */
    name: string;
    /** Plugin version */
    version: string;
    /**
     * Generate target code from the parsed AST.
     * Must not throw — return errors in the result.
     */
    generate(program: Program, profile: HardwareProfile): GenerateResult;
}
declare class PluginRegistry {
    private backends;
    register(plugin: BackendPlugin): void;
    get(targetId: string): BackendPlugin | undefined;
    list(): BackendPlugin[];
    has(targetId: string): boolean;
}
export declare const registry: PluginRegistry;
export {};
