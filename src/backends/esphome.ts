// AppyScript → ESPHome YAML — v2
//
// ESPHome automation model: automations are INLINED inside the component that
// triggers them, not in a separate section. This backend correctly produces:
//
//   binary_sensor:       ← motion/door/button component definition
//     - platform: gpio
//       on_press:        ← automation lives HERE, not somewhere else
//         then:
//           - light.turn_on: status_light
//
//   sensor:              ← distance/light/temperature
//     - platform: ultrasonic
//       on_value_range:  ← threshold automation inlined
//         - below: 30.0
//           then: ...
//
// Boot (when start), interval, time-of-day, and sun are separate top-level keys.

import type { Program, Block, Statement, Trigger, Condition, Value, SensorName } from '../ast'
import type { HardwareProfile, GenerateResult } from '../plugins'

// ── Indent helper ─────────────────────────────────────────────────────────────

const I = (n: number) => '  '.repeat(n)

// ── Expression emitters (C++ lambda context for conditions) ──────────────────

const SENSOR_ID: Record<SensorName, string> = {
  distance: 'distance_sensor',
  light: 'light_sensor',
  temperature: 'temp_sensor',
  touch: 'touch_sensor',
  acceleration: 'accel_sensor',
}

function emitValueLambda(v: Value): string {
  switch (v.kind) {
    case 'number':    return String(v.value)
    case 'string':    return `"${v.value.replace(/"/g, '\\"')}"`
    case 'bool':      return v.value ? 'true' : 'false'
    case 'variable':  return `id(${v.name})`
    case 'sensor':    return `id(${SENSOR_ID[v.sensor]}).state`
    case 'binary':    return `(${emitValueLambda(v.left)} ${v.op} ${emitValueLambda(v.right)})`
    case 'round':     return `roundf(${emitValueLambda(v.value)})`
    case 'abs':       return `fabsf(${emitValueLambda(v.value)})`
    case 'min':       return `min(${emitValueLambda(v.left)}, ${emitValueLambda(v.right)})`
    case 'max':       return `max(${emitValueLambda(v.left)}, ${emitValueLambda(v.right)})`
    default:          return '0'
  }
}

function emitCondLambda(cond: Condition): string {
  switch (cond.kind) {
    case 'sensor':   return `id(${SENSOR_ID[cond.sensor]}).state ${cond.op} ${cond.threshold}f`
    case 'variable': return `id(${cond.name}) ${cond.op} ${emitValueLambda(cond.value)}`
    case 'bool':     return cond.value ? 'true' : 'false'
    case 'not':      return `!(${emitCondLambda(cond.condition)})`
    case 'and':      return `(${emitCondLambda(cond.left)} && ${emitCondLambda(cond.right)})`
    case 'or':       return `(${emitCondLambda(cond.left)} || ${emitCondLambda(cond.right)})`
  }
}

// YAML scalar value (for data: fields)
// Produce a bare Jinja2 / literal string fragment (no outer quotes)
function jinjaFragment(v: Value): string {
  switch (v.kind) {
    case 'number':    return String(v.value)
    case 'string':    return v.value
    case 'bool':      return v.value ? 'true' : 'false'
    case 'variable':  return `{{ id(${v.name}) }}`
    case 'sensor':    return `{{ id(${SENSOR_ID[v.sensor]}).state }}`
    case 'binary':
      if (v.op === '+') return `${jinjaFragment(v.left)}${jinjaFragment(v.right)}`
      return `{{ ${emitValueLambda(v)} }}`
    case 'round':     return `{{ id(${(v as any).value?.name ?? '?'}) | round }}`
    case 'abs':       return `{{ ${emitValueLambda(v)} }}`
    default:          return '(dynamic)'
  }
}

// Emit a YAML scalar value: plain numbers stay plain, everything else becomes a quoted string
function emitValueYaml(v: Value): string {
  if (v.kind === 'number') return String(v.value)
  if (v.kind === 'bool')   return v.value ? 'true' : 'false'
  // All string / template / sensor / variable values → single-quoted Jinja string
  return `"${jinjaFragment(v).replace(/"/g, '\'\'')}"`
}

// ── Action body emitter ───────────────────────────────────────────────────────

function emitActions(stmts: Statement[], ind: number): string[] {
  const out: string[] = []
  const p = I(ind)

  for (const stmt of stmts) {
    switch (stmt.kind) {

      // ── Lighting ──────────────────────────────────────────────────────────

      case 'lights_on':
        out.push(`${p}- light.turn_on:`)
        out.push(`${p}    id: status_light`)
        if (stmt.brightness !== undefined)
          out.push(`${p}    brightness_pct: ${stmt.brightness}`)
        break

      case 'lights_off':
        out.push(`${p}- light.turn_off: status_light`)
        break

      case 'lights_dim':
        out.push(`${p}- light.turn_on:`)
        out.push(`${p}    id: status_light`)
        out.push(`${p}    brightness_pct: ${emitValueLambda(stmt.level)}`)
        break

      // ── Robot LEDs / NeoPixel face expressions ─────────────────────────────

      case 'show': {
        const COLOURS: Record<string, [number, number, number]> = {
          happy:    [0,   255, 0],
          sad:      [0,   0,   255],
          angry:    [255, 0,   0],
          excited:  [255, 165, 0],
          alert:    [255, 255, 0],
          calm:     [0,   128, 128],
          thinking: [128, 0,   128],
          sleep:    [0,   0,   20],
          confused: [255, 20,  147],
          dizzy:    [255, 255, 255],
        }
        const [r, g, b] = COLOURS[stmt.expression] ?? [128, 128, 128]
        out.push(`${p}- light.turn_on:`)
        out.push(`${p}    id: status_light`)
        out.push(`${p}    red: ${(r/255).toFixed(2)}`)
        out.push(`${p}    green: ${(g/255).toFixed(2)}`)
        out.push(`${p}    blue: ${(b/255).toFixed(2)}`)
        break
      }

      // ── Notification / logging ─────────────────────────────────────────────

      case 'say':
        out.push(`${p}- logger.log:`)
        out.push(`${p}    format: "${escapeFormat(stmt.text)}"`)
        break

      case 'notify':
        out.push(`${p}- homeassistant.action:`)
        out.push(`${p}    action: notify.notify`)
        out.push(`${p}    data:`)
        out.push(`${p}      message: ${emitValueYaml(stmt.message)}`)
        break

      case 'show_text':
        out.push(`${p}- logger.log:`)
        out.push(`${p}    format: "${escapeFormat(stmt.text)}"`)
        break

      case 'show_number':
        out.push(`${p}- logger.log:`)
        out.push(`${p}    format: "%.1f"`)
        out.push(`${p}    args: ['${emitValueLambda(stmt.value)}']`)
        break

      // ── Sound ──────────────────────────────────────────────────────────────

      case 'play': {
        const TONES: Record<string, Array<[number, number]>> = {
          success: [[523,100],[659,100],[784,200]],
          fail:    [[392,200],[330,400]],
          beep:    [[440,100]],
          tada:    [[523,80],[523,80],[784,300]],
          alert:   [[880,100],[880,100]],
        }
        const tones = TONES[stmt.sound] ?? [[440, 200]]
        for (const [freq, ms] of tones) {
          out.push(`${p}- output.ledc.set_frequency:`)
          out.push(`${p}    id: buzzer_output`)
          out.push(`${p}    frequency: ${freq}Hz`)
          out.push(`${p}- output.set_level:`)
          out.push(`${p}    id: buzzer_output`)
          out.push(`${p}    level: 50%`)
          out.push(`${p}- delay: ${ms}ms`)
          out.push(`${p}- output.turn_off: buzzer_output`)
        }
        break
      }

      // ── Motor control ──────────────────────────────────────────────────────

      case 'move': {
        const sp = (stmt.speed ?? 50) / 100
        out.push(`${p}- output.set_level:`)
        out.push(`${p}    id: motor_a_fwd`)
        out.push(`${p}    level: ${sp}`)
        out.push(`${p}- output.set_level:`)
        out.push(`${p}    id: motor_b_fwd`)
        out.push(`${p}    level: ${sp}`)
        if (stmt.duration) {
          const ms = stmt.duration.unit === 'ms' ? stmt.duration.value
            : stmt.duration.unit === 's' ? stmt.duration.value * 1000
            : stmt.duration.value * 60000
          out.push(`${p}- delay: ${ms}ms`)
          out.push(`${p}- output.turn_off: motor_a_fwd`)
          out.push(`${p}- output.turn_off: motor_b_fwd`)
        }
        break
      }

      case 'stop':
      case 'stop_all':
        out.push(`${p}- output.turn_off: motor_a_fwd`)
        out.push(`${p}- output.turn_off: motor_b_fwd`)
        break

      case 'turn': {
        const ms = Math.round(stmt.degrees * 1000 / 180)
        const leftLevel  = stmt.direction === 'left' ? 0 : 0.5
        const rightLevel = stmt.direction === 'left' ? 0.5 : 0
        out.push(`${p}- output.set_level: {id: motor_a_fwd, level: ${leftLevel}}`)
        out.push(`${p}- output.set_level: {id: motor_b_fwd, level: ${rightLevel}}`)
        out.push(`${p}- delay: ${ms}ms`)
        out.push(`${p}- output.turn_off: motor_a_fwd`)
        out.push(`${p}- output.turn_off: motor_b_fwd`)
        break
      }

      // ── HA service calls (lock, unlock, thermostat, scene) ─────────────────

      case 'thermostat':
        out.push(`${p}- homeassistant.action:`)
        out.push(`${p}    action: climate.set_temperature`)
        out.push(`${p}    target:`)
        out.push(`${p}      entity_id: climate.thermostat`)
        out.push(`${p}    data:`)
        out.push(`${p}      temperature: ${emitValueLambda(stmt.temperature)}`)
        break

      case 'lock':
        out.push(`${p}- homeassistant.action:`)
        out.push(`${p}    action: lock.lock`)
        out.push(`${p}    target:`)
        out.push(`${p}      entity_id: lock.${stmt.device ?? 'front_door'}`)
        break

      case 'unlock':
        out.push(`${p}- homeassistant.action:`)
        out.push(`${p}    action: lock.unlock`)
        out.push(`${p}    target:`)
        out.push(`${p}      entity_id: lock.${stmt.device ?? 'front_door'}`)
        break

      case 'scene':
        out.push(`${p}- homeassistant.action:`)
        out.push(`${p}    action: scene.turn_on`)
        out.push(`${p}    target:`)
        out.push(`${p}      entity_id: scene.${stmt.name.toLowerCase().replace(/\s+/g, '_')}`)
        break

      // ── Timing ────────────────────────────────────────────────────────────

      case 'wait': {
        const ms = stmt.duration.unit === 'ms' ? stmt.duration.value
          : stmt.duration.unit === 's' ? stmt.duration.value * 1000
          : stmt.duration.value * 60000
        out.push(`${p}- delay: ${ms}ms`)
        break
      }

      case 'wait_until':
        // ESPHome has no built-in wait_until — poll with component.lambda
        out.push(`${p}- wait_until:`)
        out.push(`${p}    lambda: 'return ${emitCondLambda(stmt.condition)};'`)
        break

      case 'send':
        out.push(`${p}- homeassistant.action:`)
        out.push(`${p}    action: notify.notify`)
        out.push(`${p}    data:`)
        out.push(`${p}      message: ${emitValueYaml(stmt.message)}`)
        break

      // ── Variables ──────────────────────────────────────────────────────────

      case 'let':
      case 'set':
        out.push(`${p}- lambda: 'id(${stmt.name}) = ${emitValueLambda(stmt.value)};'`)
        break

      case 'save':
        out.push(`${p}- globals.set:`)
        out.push(`${p}    id: ${stmt.name}`)
        out.push(`${p}    value: !lambda 'return id(${stmt.name});'`)
        break

      case 'load':
        // restore_value: true handles this at boot
        out.push(`${p}- lambda: 'ESP_LOGI("appyscript", "Loaded ${stmt.name}: %d", id(${stmt.name}));'`)
        break

      // ── Control flow ───────────────────────────────────────────────────────

      case 'if':
        out.push(`${p}- if:`)
        out.push(`${p}    condition:`)
        out.push(`${p}      lambda: 'return ${emitCondLambda(stmt.condition)};'`)
        out.push(`${p}    then:`)
        out.push(...emitActions(stmt.then, ind + 3))
        if (stmt.else && stmt.else.length > 0) {
          out.push(`${p}    else:`)
          out.push(...emitActions(stmt.else, ind + 3))
        }
        break

      case 'repeat':
        out.push(`${p}- repeat:`)
        out.push(`${p}    count: ${emitValueLambda(stmt.count)}`)
        out.push(`${p}    sequence:`)
        out.push(...emitActions(stmt.body, ind + 3))
        break

      case 'while':
        out.push(`${p}- while:`)
        out.push(`${p}    condition:`)
        out.push(`${p}      lambda: 'return ${emitCondLambda(stmt.condition)};'`)
        out.push(`${p}    then:`)
        out.push(...emitActions(stmt.body, ind + 3))
        break

      case 'do':
        out.push(`${p}- script.execute: ${stmt.name}`)
        break

      case 'list_add':
        out.push(`${p}- lambda: '/* list.append not supported in ESPHome lambda */'`)
        break

      default:
        out.push(`${p}# [${(stmt as any).kind}] not applicable in ESPHome`)
    }
  }

  return out
}

// ── Format string helper ──────────────────────────────────────────────────────

function escapeFormat(v: Value): string {
  if (v.kind === 'string') return v.value.replace(/"/g, '\\"')
  if (v.kind === 'binary' && v.op === '+') {
    return `${escapeFormat(v.left)}${escapeFormat(v.right)}`
  }
  return '%s'
}

// ── Block grouping ────────────────────────────────────────────────────────────

interface GroupedBlocks {
  boot:       Statement[][]        // when start
  buttonA:    Statement[][]        // when button_a
  buttonB:    Statement[][]        // when button_b
  motion:     Statement[][]        // when motion detected
  doorOpens:  Statement[][]        // when door opens
  doorCloses: Statement[][]        // when door closes
  shaken:     Statement[][]        // when shaken
  tilted:     Statement[][]        // when tilted
  received:   Statement[][]        // when received
  sensor:     Array<{ sensor: SensorName; op: string; threshold: number; body: Statement[] }>
  timer:      Array<{ interval: number; body: Statement[] }>
  timeOfDay:  Array<{ hour: number; minute: number; body: Statement[] }>
  sunRises:   Statement[][]
  sunSets:    Statement[][]
  forever:    Statement[][]
  defines:    Array<{ name: string; body: Statement[] }>
  globals:    Array<{ name: string; type: string; initial: string; restore: boolean }>
}

function groupBlocks(program: Program): GroupedBlocks {
  const g: GroupedBlocks = {
    boot:[], buttonA:[], buttonB:[], motion:[], doorOpens:[], doorCloses:[],
    shaken:[], tilted:[], received:[], sensor:[], timer:[], timeOfDay:[],
    sunRises:[], sunSets:[], forever:[], defines:[], globals:[],
  }

  for (const block of program.blocks) {
    if (block.kind === 'define') {
      g.defines.push({ name: block.name, body: block.body })
      continue
    }
    if (block.kind === 'forever') {
      g.forever.push(block.body)
      continue
    }
    if (block.kind !== 'when') continue

    const t = block.trigger
    switch (t.kind) {
      case 'start':    g.boot.push(block.body); break
      case 'button_a': g.buttonA.push(block.body); break
      case 'button_b': g.buttonB.push(block.body); break
      case 'motion':   g.motion.push(block.body); break
      case 'shaken':   g.shaken.push(block.body); break
      case 'tilted':   g.tilted.push(block.body); break
      case 'received': g.received.push(block.body); break
      case 'door':
        if (t.event === 'opens')  g.doorOpens.push(block.body)
        else                      g.doorCloses.push(block.body)
        break
      case 'sensor':
        g.sensor.push({ sensor: t.sensor, op: t.op, threshold: t.threshold, body: block.body })
        break
      case 'timer':
        g.timer.push({ interval: timerMs(t), body: block.body })
        break
      case 'time_of_day':
        g.timeOfDay.push({ hour: t.hour, minute: t.minute, body: block.body })
        break
      case 'sun':
        if (t.event === 'rises') g.sunRises.push(block.body)
        else                     g.sunSets.push(block.body)
        break
    }
  }

  // Extract let statements as globals
  for (const block of [
    ...g.boot.flat(), ...g.forever.flat(),
    ...g.buttonA.flat(), ...g.buttonB.flat(),
  ]) {
    if (block.kind === 'let') {
      const restore = false // could detect 'save' calls nearby
      g.globals.push({
        name: block.name,
        type: block.value.kind === 'string' ? 'std::string' : 'float',
        initial: block.value.kind === 'number' ? String(block.value.value)
               : block.value.kind === 'string' ? `"${block.value.value}"` : '0',
        restore,
      })
    }
  }

  return g
}

function timerMs(t: any): number {
  const { value, unit } = t.interval
  return unit === 'ms' ? value : unit === 's' ? value * 1000 : value * 60000
}

// Merge multiple handler bodies by concatenating them (all run on the same trigger)
function merged(bodyArrays: Statement[][]): Statement[] {
  return bodyArrays.flat()
}

// ── Feature detection ─────────────────────────────────────────────────────────

function usesSensor(program: Program, s: SensorName): boolean {
  return JSON.stringify(program).includes(`"sensor":"${s}"`)
}

// ── Main generator ────────────────────────────────────────────────────────────

export const esphomeBackend = {
  targetId: 'esphome',
  name: 'ESPHome YAML Backend v2',
  version: '2.0.0',

  generate(program: Program, _profile: HardwareProfile): GenerateResult {
    const g = groupBlocks(program)
    const out: string[] = []

    const push = (...lines: string[]) => out.push(...lines)
    const blank = () => out.push('')

    // ── Header ────────────────────────────────────────────────────────────────

    push(
      '# Generated by AppyScript — https://github.com/rahulbachina/appyscript',
      '# Target: ESPHome v2024.x  (ESP32 dev board)',
      '# Flash: esphome run this_file.yaml',
      '# Dashboard: add via ESPHome add-on in Home Assistant',
      '',
    )

    // ── Boot / esphome config ─────────────────────────────────────────────────

    const bootBody = merged(g.boot)
    push('esphome:')
    push('  name: appyscript-device')
    push('  friendly_name: AppyScript Device')
    if (bootBody.length > 0) {
      push('  on_boot:')
      push('    priority: -100')
      push('    then:')
      push(...emitActions(bootBody, 3))
    }
    blank()

    // ── Platform ──────────────────────────────────────────────────────────────

    push(
      'esp32:',
      '  board: esp32dev',
      '  framework:',
      '    type: arduino',
      '',
      '# ── Connectivity ──────────────────────────────────────────',
      'wifi:',
      '  ssid: !secret wifi_ssid',
      '  password: !secret wifi_password',
      '  ap:',
      '    ssid: "AppyScript Hotspot"',
      '',
      'api:',
      '  encryption:',
      '    key: !secret api_key',
      '',
      'ota:',
      '  - platform: esphome',
      '    password: !secret ota_password',
      '',
      'logger:',
    )
    blank()

    // ── Global variables ──────────────────────────────────────────────────────

    if (g.globals.length > 0) {
      push('# ── Global variables ──────────────────────────────────────')
      push('globals:')
      for (const v of g.globals) {
        push(`  - id: ${v.name}`)
        push(`    type: ${v.type}`)
        push(`    restore_value: ${v.restore ? 'yes' : 'no'}`)
        push(`    initial_value: '${v.initial}'`)
      }
      blank()
    }

    // ── Reusable scripts (define blocks) ─────────────────────────────────────

    if (g.defines.length > 0) {
      push('# ── Reusable scripts (define blocks) ──────────────────────')
      push('script:')
      for (const d of g.defines) {
        push(`  - id: ${d.name}`)
        push(`    mode: single`)
        push(`    sequence:`)
        push(...emitActions(d.body, 3))
      }
      blank()
    }

    // ── Binary sensors (button / motion / door / shaken / tilted) ─────────────

    const binarySensors: string[] = []

    if (g.buttonA.length > 0) {
      binarySensors.push(
        '  - platform: gpio',
        '    id: button_a',
        '    name: "Button A"',
        '    pin:',
        '      number: GPIO0',
        '      mode: INPUT_PULLUP',
        '      inverted: true',
        '    on_press:',
        '      then:',
        ...emitActions(merged(g.buttonA), 4),
      )
    }

    if (g.buttonB.length > 0) {
      binarySensors.push(
        '  - platform: gpio',
        '    id: button_b',
        '    name: "Button B"',
        '    pin:',
        '      number: GPIO35',
        '      mode: INPUT_PULLUP',
        '      inverted: true',
        '    on_press:',
        '      then:',
        ...emitActions(merged(g.buttonB), 4),
      )
    }

    if (g.motion.length > 0) {
      binarySensors.push(
        '  - platform: gpio',
        '    id: motion_sensor',
        '    name: "Motion"',
        '    device_class: motion',
        '    pin:',
        '      number: GPIO15',
        '      mode: INPUT_PULLDOWN',
        '    on_press:',
        '      then:',
        ...emitActions(merged(g.motion), 4),
      )
    }

    if (g.doorOpens.length > 0 || g.doorCloses.length > 0) {
      binarySensors.push(
        '  - platform: gpio',
        '    id: door_sensor',
        '    name: "Door"',
        '    device_class: door',
        '    pin:',
        '      number: GPIO16',
        '      mode: INPUT_PULLUP',
        '      inverted: true',
      )
      if (g.doorOpens.length > 0) {
        binarySensors.push(
          '    on_press:',
          '      then:',
          ...emitActions(merged(g.doorOpens), 4),
        )
      }
      if (g.doorCloses.length > 0) {
        binarySensors.push(
          '    on_release:',
          '      then:',
          ...emitActions(merged(g.doorCloses), 4),
        )
      }
    }

    if (g.shaken.length > 0) {
      // Shaken via accelerometer — requires MPU6050 or similar
      binarySensors.push(
        '  - platform: template',
        '    id: shaken_sensor',
        '    name: "Shaken"',
        '    # Connect MPU6050 on I2C and configure below',
        '    lambda: |-',
        '      return false; // replace with accelerometer gesture check',
        '    on_press:',
        '      then:',
        ...emitActions(merged(g.shaken), 4),
      )
    }

    if (binarySensors.length > 0) {
      push('# ── Binary sensors ────────────────────────────────────────')
      push('binary_sensor:')
      push(...binarySensors)
      blank()
    }

    // ── Numeric sensors (with on_value_range) ─────────────────────────────────

    const sensorLines: string[] = []
    const sensorBlocks = g.sensor

    const useDist  = usesSensor(program, 'distance')  || sensorBlocks.some(s => s.sensor === 'distance')
    const useLight = usesSensor(program, 'light')      || sensorBlocks.some(s => s.sensor === 'light')
    const useTemp  = usesSensor(program, 'temperature')|| sensorBlocks.some(s => s.sensor === 'temperature')

    if (useDist) {
      const distBlocks = sensorBlocks.filter(s => s.sensor === 'distance')
      sensorLines.push(
        '  - platform: ultrasonic',
        '    id: distance_sensor',
        '    name: "Distance"',
        '    unit_of_measurement: cm',
        '    trigger_pin: GPIO5',
        '    echo_pin: GPIO18',
        '    update_interval: 500ms',
      )
      if (distBlocks.length > 0) {
        sensorLines.push('    on_value_range:')
        for (const sb of distBlocks) {
          const above = sb.op === '>' || sb.op === '>='
          sensorLines.push(`      - ${above ? 'above' : 'below'}: ${sb.threshold}.0`)
          sensorLines.push('        then:')
          sensorLines.push(...emitActions(sb.body, 5))
        }
      }
    }

    if (useLight) {
      const lightBlocks = sensorBlocks.filter(s => s.sensor === 'light')
      sensorLines.push(
        '  - platform: adc',
        '    id: light_sensor',
        '    name: "Light Level"',
        '    pin: GPIO36',
        '    attenuation: 11dB',
        '    filters:',
        '      - lambda: "return x / 40.95;"',
        '    unit_of_measurement: "%"',
        '    update_interval: 1s',
      )
      if (lightBlocks.length > 0) {
        sensorLines.push('    on_value_range:')
        for (const sb of lightBlocks) {
          const above = sb.op === '>' || sb.op === '>='
          sensorLines.push(`      - ${above ? 'above' : 'below'}: ${sb.threshold}.0`)
          sensorLines.push('        then:')
          sensorLines.push(...emitActions(sb.body, 5))
        }
      }
    }

    if (useTemp) {
      const tempBlocks = sensorBlocks.filter(s => s.sensor === 'temperature')
      sensorLines.push(
        '  - platform: dallas_temp',
        '    id: temp_sensor',
        '    name: "Temperature"',
        '    unit_of_measurement: "°C"',
        '    update_interval: 30s',
      )
      if (tempBlocks.length > 0) {
        sensorLines.push('    on_value_range:')
        for (const sb of tempBlocks) {
          const above = sb.op === '>' || sb.op === '>='
          sensorLines.push(`      - ${above ? 'above' : 'below'}: ${sb.threshold}.0`)
          sensorLines.push('        then:')
          sensorLines.push(...emitActions(sb.body, 5))
        }
      }
    }

    if (sensorLines.length > 0) {
      push('# ── Numeric sensors ───────────────────────────────────────')
      push('sensor:')
      push(...sensorLines)
      blank()
    }

    // ── Interval timers ───────────────────────────────────────────────────────

    const timerLines: string[] = []

    // Convert 'forever' loop to an interval timer
    if (g.forever.length > 0) {
      timerLines.push(
        '  - interval: 100ms',
        '    then:',
        ...emitActions(merged(g.forever), 2),
      )
    }

    for (const t of g.timer) {
      const interval = t.interval >= 1000
        ? `${t.interval / 1000}s`
        : `${t.interval}ms`
      timerLines.push(
        `  - interval: ${interval}`,
        '    then:',
        ...emitActions(t.body, 2),
      )
    }

    if (timerLines.length > 0) {
      push('# ── Interval timers ───────────────────────────────────────')
      push('interval:')
      push(...timerLines)
      blank()
    }

    // ── Time of day ───────────────────────────────────────────────────────────

    if (g.timeOfDay.length > 0) {
      push('# ── Scheduled automations ─────────────────────────────────')
      push('time:')
      push('  - platform: homeassistant')
      push('    id: ha_time')
      push('    on_time:')
      for (const t of g.timeOfDay) {
        push(`      - hours: ${t.hour}`)
        push(`        minutes: ${t.minute}`)
        push('        seconds: 0')
        push('        then:')
        push(...emitActions(t.body, 5))
      }
      blank()
    }

    // ── Sun events ────────────────────────────────────────────────────────────

    if (g.sunRises.length > 0 || g.sunSets.length > 0) {
      push('# ── Sun events ────────────────────────────────────────────')
      push('sun:')
      push('  latitude: 0.0°   # set your location')
      push('  longitude: 0.0°')
      if (g.sunRises.length > 0) {
        push('  on_sunrise:')
        push('    - offset: 0min')
        push('      then:')
        push(...emitActions(merged(g.sunRises), 4))
      }
      if (g.sunSets.length > 0) {
        push('  on_sunset:')
        push('    - offset: 0min')
        push('      then:')
        push(...emitActions(merged(g.sunSets), 4))
      }
      blank()
    }

    // ── Motor outputs (always include if any move statements) ─────────────────

    const hasMotors = JSON.stringify(program).includes('"kind":"move"')
      || JSON.stringify(program).includes('"kind":"turn"')
      || JSON.stringify(program).includes('"kind":"stop"')

    if (hasMotors) {
      push('# ── Motor outputs (L298N / DRV8833) ──────────────────────')
      push('output:')
      push('  - platform: ledc')
      push('    id: motor_a_fwd')
      push('    pin: GPIO13')
      push('  - platform: ledc')
      push('    id: motor_a_bck')
      push('    pin: GPIO14')
      push('  - platform: ledc')
      push('    id: motor_b_fwd')
      push('    pin: GPIO25')
      push('  - platform: ledc')
      push('    id: motor_b_bck')
      push('    pin: GPIO26')
      push('  - platform: ledc')
      push('    id: buzzer_output')
      push('    pin: GPIO2')
      blank()
    } else if (JSON.stringify(program).includes('"kind":"play"')) {
      push('output:')
      push('  - platform: ledc')
      push('    id: buzzer_output')
      push('    pin: GPIO2')
      blank()
    }

    // ── Light / NeoPixel (always include for show/lights) ─────────────────────

    push('# ── Status NeoPixel ───────────────────────────────────────')
    push('light:')
    push('  - platform: neopixelbus')
    push('    id: status_light')
    push('    name: "Status Light"')
    push('    pin: GPIO27')
    push('    num_leds: 1')
    push('    type: GRB')
    blank()

    // ── Dallas (one-wire) bus if temperature is used ──────────────────────────

    if (useTemp) {
      push('one_wire:')
      push('  - platform: gpio')
      push('    pin: GPIO4')
      blank()
    }

    return { code: out.join('\n') }
  }
}
