"use strict";
// AppyScript Plugin System
// Allows external backends and hardware profiles to be registered at runtime.
// Backends: compile AST → target-language string
// HardwareProfiles: describe what each chip can do (used by semantic analyser)
Object.defineProperty(exports, "__esModule", { value: true });
exports.registry = exports.HARDWARE_PROFILES = void 0;
exports.HARDWARE_PROFILES = {
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
};
// ── Plugin Registry ───────────────────────────────────────────────────────────
class PluginRegistry {
    backends = new Map();
    register(plugin) {
        this.backends.set(plugin.targetId, plugin);
    }
    get(targetId) {
        return this.backends.get(targetId);
    }
    list() {
        return [...this.backends.values()];
    }
    has(targetId) {
        return this.backends.has(targetId);
    }
}
exports.registry = new PluginRegistry();
//# sourceMappingURL=plugins.js.map