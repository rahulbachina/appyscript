---
title: Tools Reference
nav_order: 2
---

# AppyScript MCP Tools Reference

Version: **2.0.0**

All tools are called via JSON-RPC 2.0 over stdio. Parameters are passed as a single JSON object. All responses are JSON objects.

---

## 1. `appyscript_compile`

Compile AppyScript source code to the output language for a specific hardware target.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | yes | AppyScript source code to compile |
| `target` | `string` | yes | Target backend identifier. Must be one of the values returned by `appyscript_list_targets`. |

### Return Type

```ts
{
  success: boolean
  code?: string          // generated output code (present when success is true)
  errors?: Diagnostic[]  // compile errors (present when success is false)
}

type Diagnostic = {
  line: number
  column: number
  message: string
  severity: "error" | "warning"
}
```

### Example — Success

Request:
```json
{
  "source": "pin led = 2\nloop:\n  led.on()\n  wait 500ms\n  led.off()\n  wait 500ms",
  "target": "esp32"
}
```

Response:
```json
{
  "success": true,
  "code": "#define LED_PIN 2\nvoid setup() { pinMode(LED_PIN, OUTPUT); }\nvoid loop() { digitalWrite(LED_PIN, HIGH); delay(500); digitalWrite(LED_PIN, LOW); delay(500); }"
}
```

### Example — Compile Error

Response:
```json
{
  "success": false,
  "errors": [
    {
      "line": 3,
      "column": 5,
      "message": "Unknown identifier 'blink' — did you mean 'led.on()'?",
      "severity": "error"
    }
  ]
}
```

---

## 2. `appyscript_validate`

Parse and semantically check AppyScript source without compiling to any specific target. Useful for early error detection before the target is known.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | yes | AppyScript source code to validate |

### Return Type

```ts
{
  valid: boolean
  diagnostics: Diagnostic[]  // empty array when valid is true
}

type Diagnostic = {
  line: number
  column: number
  message: string
  severity: "error" | "warning"
}
```

### Example — Valid Code

Request:
```json
{
  "source": "pin led = 13\nloop:\n  led.on()\n  wait 1s\n  led.off()\n  wait 1s"
}
```

Response:
```json
{
  "valid": true,
  "diagnostics": []
}
```

### Example — Invalid Code

Response:
```json
{
  "valid": false,
  "diagnostics": [
    {
      "line": 2,
      "column": 1,
      "message": "Expected block keyword ('loop', 'setup', 'on') but found 'lop'",
      "severity": "error"
    }
  ]
}
```

---

## 3. `appyscript_explain`

Return a plain-English explanation of what an AppyScript program does. Useful for commenting generated code or summarising user-submitted programs.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | yes | AppyScript source code to explain |

### Return Type

```ts
{
  explanation: string   // human-readable description
  summary: string       // one-sentence summary
  steps: string[]       // ordered list of what the program does
}
```

### Example

Request:
```json
{
  "source": "pin button = 5\npin led = 13\non button.press:\n  led.toggle()"
}
```

Response:
```json
{
  "explanation": "This program watches a button on pin 5. Each time the button is pressed, it toggles an LED on pin 13 — turning it on if it was off, or off if it was on.",
  "summary": "Toggle an LED whenever a button is pressed.",
  "steps": [
    "Declare pin 5 as a button input",
    "Declare pin 13 as an LED output",
    "Register a press event handler on the button",
    "Inside the handler, toggle the LED state"
  ]
}
```

---

## 4. `appyscript_simulate`

Run AppyScript in a JavaScript simulator. No physical hardware needed. Returns a trace of events, the final hardware state, and a step-by-step execution log.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | yes | AppyScript source code to simulate |
| `opts` | `SimulateOptions` | no | Simulation options (see below) |

```ts
type SimulateOptions = {
  durationMs?: number        // how long to simulate in ms (default: 5000)
  inputs?: InputEvent[]      // synthetic hardware events to inject
  maxSteps?: number          // safety cap on execution steps (default: 10000)
}

type InputEvent = {
  timeMs: number             // when to fire the event
  pin: number                // which pin
  event: "press" | "release" | "analog"
  value?: number             // for analog events
}
```

### Return Type

```ts
{
  success: boolean
  events: SimEvent[]         // all hardware events that occurred
  finalState: PinState[]     // pin states at end of simulation
  executionTrace: TraceStep[]
  error?: string             // set when success is false
}

type SimEvent = {
  timeMs: number
  type: string               // e.g. "pin.write", "serial.print"
  pin?: number
  value?: number | boolean
  message?: string
}

type PinState = {
  pin: number
  mode: "input" | "output" | "pwm"
  value: number | boolean
}

type TraceStep = {
  timeMs: number
  line: number
  description: string
}
```

### Example

Request:
```json
{
  "source": "pin led = 2\nloop:\n  led.on()\n  wait 200ms\n  led.off()\n  wait 200ms",
  "opts": { "durationMs": 1000 }
}
```

Response:
```json
{
  "success": true,
  "events": [
    { "timeMs": 0,   "type": "pin.write", "pin": 2, "value": true },
    { "timeMs": 200, "type": "pin.write", "pin": 2, "value": false },
    { "timeMs": 400, "type": "pin.write", "pin": 2, "value": true },
    { "timeMs": 600, "type": "pin.write", "pin": 2, "value": false },
    { "timeMs": 800, "type": "pin.write", "pin": 2, "value": true },
    { "timeMs": 1000,"type": "pin.write", "pin": 2, "value": false }
  ],
  "finalState": [
    { "pin": 2, "mode": "output", "value": false }
  ],
  "executionTrace": [
    { "timeMs": 0,   "line": 2, "description": "Entered loop block" },
    { "timeMs": 0,   "line": 3, "description": "led.on() — set pin 2 HIGH" },
    { "timeMs": 200, "line": 4, "description": "wait 200ms — resumed" },
    { "timeMs": 200, "line": 5, "description": "led.off() — set pin 2 LOW" }
  ]
}
```

---

## 5. `appyscript_hardware_info`

Return the `HardwareProfile` for a specific target. Use this before writing code to understand pin layout, available peripherals, and board constraints.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `target` | `string` | yes | Target backend identifier |

### Return Type

```ts
type HardwareProfile = {
  target: string
  displayName: string
  clockMhz: number
  flashKb: number
  ramKb: number
  pins: PinDefinition[]
  peripherals: string[]      // e.g. ["i2c", "spi", "uart", "pwm", "adc"]
  outputLanguage: string     // e.g. "arduino-cpp", "micropython", "typescript"
  notes: string[]
}

type PinDefinition = {
  number: number
  name: string               // e.g. "LED_BUILTIN", "A0"
  modes: ("input" | "output" | "pwm" | "adc" | "i2c" | "spi" | "uart")[]
  defaultFunction?: string
}
```

### Example

Request:
```json
{ "target": "esp32" }
```

Response:
```json
{
  "target": "esp32",
  "displayName": "ESP32 (generic)",
  "clockMhz": 240,
  "flashKb": 4096,
  "ramKb": 520,
  "pins": [
    { "number": 2,  "name": "LED_BUILTIN", "modes": ["output", "pwm"], "defaultFunction": "onboard LED" },
    { "number": 4,  "name": "D4",          "modes": ["input", "output", "pwm"] },
    { "number": 34, "name": "A0",          "modes": ["input", "adc"] }
  ],
  "peripherals": ["i2c", "spi", "uart", "pwm", "adc", "wifi", "bluetooth"],
  "outputLanguage": "arduino-cpp",
  "notes": [
    "Pins 34–39 are input-only",
    "PWM is available on most output pins via ledc",
    "WiFi and Bluetooth share the same radio"
  ]
}
```

---

## 6. `appyscript_list_targets`

List all supported compilation targets. Call this first to get the valid values for the `target` parameter in other tools.

### Parameters

None.

### Return Type

```ts
{
  targets: TargetSummary[]
}

type TargetSummary = {
  id: string             // use this as the target argument in other tools
  displayName: string
  outputLanguage: string
  description: string
}
```

### Example

Request:
```json
{}
```

Response:
```json
{
  "targets": [
    {
      "id": "esp32",
      "displayName": "ESP32",
      "outputLanguage": "arduino-cpp",
      "description": "Espressif ESP32 family — WiFi + Bluetooth, 240 MHz, compiled via Arduino framework"
    },
    {
      "id": "arduino-uno",
      "displayName": "Arduino Uno",
      "outputLanguage": "arduino-cpp",
      "description": "Classic ATmega328P board, 16 MHz, 32 KB flash"
    },
    {
      "id": "rpi-pico",
      "displayName": "Raspberry Pi Pico",
      "outputLanguage": "micropython",
      "description": "RP2040 dual-core board, outputs MicroPython"
    },
    {
      "id": "microbit",
      "displayName": "BBC micro:bit",
      "outputLanguage": "micropython",
      "description": "micro:bit v2 with onboard 5x5 LED matrix, accelerometer, and radio"
    },
    {
      "id": "simulator",
      "displayName": "JS Simulator",
      "outputLanguage": "typescript",
      "description": "Browser/Node.js simulator for testing without hardware"
    },
    {
      "id": "embedded",
      "displayName": "Generic Embedded",
      "outputLanguage": "c",
      "description": "Portable C output for any bare-metal target without a specific profile"
    }
  ]
}
```

---

## 7. `appyscript_list_keywords`

List all AppyScript language keywords. Use this to avoid inventing syntax and to understand what the language supports.

### Parameters

None.

### Return Type

```ts
{
  keywords: Keyword[]
}

type Keyword = {
  name: string
  category: string       // e.g. "control", "io", "timing", "events", "data", "math"
  description: string
  syntax: string         // usage template
  example?: string
}
```

### Example

Request:
```json
{}
```

Response (excerpt):
```json
{
  "keywords": [
    {
      "name": "pin",
      "category": "io",
      "description": "Declare a named hardware pin",
      "syntax": "pin <name> = <number>",
      "example": "pin led = 13"
    },
    {
      "name": "loop",
      "category": "control",
      "description": "Repeat a block forever",
      "syntax": "loop:\n  <body>",
      "example": "loop:\n  led.on()\n  wait 1s"
    },
    {
      "name": "on",
      "category": "events",
      "description": "Register an event handler for a pin event",
      "syntax": "on <pin>.<event>:\n  <body>",
      "example": "on button.press:\n  led.toggle()"
    },
    {
      "name": "wait",
      "category": "timing",
      "description": "Pause execution for a duration",
      "syntax": "wait <number><unit>  (units: ms, s)",
      "example": "wait 500ms"
    },
    {
      "name": "if",
      "category": "control",
      "description": "Conditional branch",
      "syntax": "if <condition>:\n  <body>\nelse:\n  <body>",
      "example": "if sensor.value > 100:\n  led.on()"
    },
    {
      "name": "print",
      "category": "io",
      "description": "Send a value to the serial output",
      "syntax": "print <value>",
      "example": "print sensor.value"
    }
  ]
}
```

---

## Error Handling

All tools return HTTP-style structured errors when something goes wrong at the MCP layer:

```json
{
  "error": {
    "code": -32602,
    "message": "Invalid params: 'target' must be one of [esp32, arduino-uno, rpi-pico, microbit, simulator, embedded]"
  }
}
```

Application-level failures (bad source code, unknown identifier) are returned inside the tool's normal response shape with `success: false` or `valid: false` — they are not MCP errors.

## Recommended Call Order for Code Generation

```
1. appyscript_list_targets()            → pick a target id
2. appyscript_hardware_info(target)     → learn pin layout + peripherals
3. appyscript_list_keywords()           → know valid syntax
4. [write AppyScript source]
5. appyscript_validate(source)          → catch errors early
6. appyscript_compile(source, target)   → get output code
7. appyscript_simulate(source, opts)    → confirm behaviour (optional)
8. appyscript_explain(source)           → generate user-facing description
```
