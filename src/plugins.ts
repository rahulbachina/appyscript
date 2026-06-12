// AppyScript Plugin System
// Allows external backends and hardware profiles to be registered at runtime.
// Backends: compile AST → target-language string
// HardwareProfiles: describe what each chip can do (used by semantic analyser)

import type { Program } from './ast'
import type { SourceMap } from './sourcemap'

// ── Hardware Profiles ─────────────────────────────────────────────────────────

export interface HardwareProfile {
  /** Short identifier used in CLI / compile() */
  id: string
  /** Display name */
  name: string
  /** Runtime language */
  runtime: 'MicroPython' | 'C++' | 'CircuitPython'
  /** Human description */
  description: string

  /** Which sensors are wired up on this platform */
  sensors: {
    distance: boolean
    light: boolean
    temperature: boolean
    touch: boolean
    acceleration: boolean
  }

  /** Rough memory budget */
  memory: {
    flashKB: number
    ramKB: number
  }

  /** True if the platform supports async event handlers */
  supportsAsync: boolean
  /** True if the platform supports a built-in display */
  hasDisplay: boolean
  /** True if wireless comms are available */
  hasRadio: boolean
}

export const HARDWARE_PROFILES: Record<string, HardwareProfile> = {
  esp32: {
    id: 'esp32',
    name: 'ESP32 / M5Stack Core S3 SE',
    runtime: 'MicroPython',
    description: 'M5Stack Core S3 SE, ESP32-S3 dev boards. WiFi + display + speaker built in.',
    sensors: { distance: true, light: true, temperature: true, touch: true, acceleration: true },
    memory: { flashKB: 8192, ramKB: 512 },
    supportsAsync: true,
    hasDisplay: true,
    hasRadio: true,
  },
  arduino: {
    id: 'arduino',
    name: 'Arduino Uno / Nano / Mega',
    runtime: 'C++',
    description: 'Arduino Uno, Nano, Mega. Most common beginner robotics boards globally.',
    sensors: { distance: true, light: true, temperature: true, touch: true, acceleration: false },
    memory: { flashKB: 32, ramKB: 2 },
    supportsAsync: false,
    hasDisplay: false,
    hasRadio: false,
  },
  pico: {
    id: 'pico',
    name: 'Raspberry Pi Pico W',
    runtime: 'MicroPython',
    description: 'RP2040 dual-core. WiFi. £4 chip. Popular in UK schools.',
    sensors: { distance: true, light: true, temperature: true, touch: true, acceleration: false },
    memory: { flashKB: 2048, ramKB: 264 },
    supportsAsync: true,
    hasDisplay: false,
    hasRadio: true,
  },
  microbit: {
    id: 'microbit',
    name: 'BBC micro:bit V2',
    runtime: 'MicroPython',
    description: '5×5 LED matrix, 2 buttons, accelerometer. Used by 5M+ UK students.',
    sensors: { distance: false, light: true, temperature: true, touch: true, acceleration: true },
    memory: { flashKB: 512, ramKB: 128 },
    supportsAsync: false,
    hasDisplay: true,
    hasRadio: true,
  },
}

// ── Backend Plugin Interface ───────────────────────────────────────────────────

export interface GenerateResult {
  code: string
  sourceMap?: SourceMap
  warnings?: string[]
}

export interface BackendPlugin {
  /** Matches HardwareProfile.id */
  targetId: string
  /** Human-readable name */
  name: string
  /** Plugin version */
  version: string

  /**
   * Generate target code from the parsed AST.
   * Must not throw — return errors in the result.
   */
  generate(program: Program, profile: HardwareProfile): GenerateResult
}

// ── Plugin Registry ───────────────────────────────────────────────────────────

class PluginRegistry {
  private backends = new Map<string, BackendPlugin>()

  register(plugin: BackendPlugin): void {
    this.backends.set(plugin.targetId, plugin)
  }

  get(targetId: string): BackendPlugin | undefined {
    return this.backends.get(targetId)
  }

  list(): BackendPlugin[] {
    return [...this.backends.values()]
  }

  has(targetId: string): boolean {
    return this.backends.has(targetId)
  }
}

export const registry = new PluginRegistry()

// ── CircuitPython / Adafruit hardware profiles ────────────────────────────────

const circuitPlaygroundProfile: HardwareProfile = {
  id: 'circuitpython',
  name: 'Adafruit Circuit Playground Bluefruit',
  runtime: 'CircuitPython',
  description: 'Circuit Playground Bluefruit. Built-in: 10 NeoPixels, speaker, mic, light sensor, accel, temp, touch pads, BLE.',
  sensors: { distance: false, light: true, temperature: true, touch: true, acceleration: true },
  memory: { flashKB: 1024, ramKB: 256 },
  supportsAsync: false,
  hasDisplay: false,
  hasRadio: true,
}

HARDWARE_PROFILES['circuitpython'] = circuitPlaygroundProfile
