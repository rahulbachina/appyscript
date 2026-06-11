import type { Program, SensorName } from '../ast';
export interface RobotState {
    position: {
        x: number;
        y: number;
        heading: number;
    };
    speed: number;
    moving: boolean;
    expression: string;
    displayText: string;
    variables: Map<string, number | string | boolean>;
    memory: Map<string, number | string | boolean>;
    sensors: Record<SensorName, number>;
}
export interface SimEvent {
    type: 'say' | 'play' | 'show' | 'show_text' | 'move' | 'turn' | 'stop' | 'send' | 'wait' | 'log';
    data: Record<string, unknown>;
    tick: number;
}
export interface SimulationResult {
    success: boolean;
    events: SimEvent[];
    finalState: RobotState;
    ticks: number;
    error?: string;
    executionTrace: ExecutionTraceEntry[];
}
export interface ExecutionTraceEntry {
    tick: number;
    blockKind: string;
    statementKind: string;
    sourceLine?: number;
    stateSnapshot: Partial<RobotState>;
}
export interface SimulationOptions {
    /** Maximum number of loop iterations to prevent infinite loops */
    maxTicks?: number;
    /** Simulated sensor values */
    sensors?: Partial<Record<SensorName, number>>;
    /** Simulated button states */
    buttons?: {
        a?: boolean;
        b?: boolean;
    };
    /** Which events to trigger ('button_a', 'shaken', etc.) */
    triggerEvents?: string[];
}
export declare class Simulator {
    private state;
    private events;
    private trace;
    private tick;
    private maxTicks;
    private options;
    constructor(options?: SimulationOptions);
    run(program: Program): SimulationResult;
    private initialState;
    private evalTrigger;
    private execStatements;
    private execStatement;
    private evalCondition;
    private evalValue;
    private compare;
    private emitEvent;
}
/** Convenience function */
export declare function simulate(program: Program, options?: SimulationOptions): SimulationResult;
