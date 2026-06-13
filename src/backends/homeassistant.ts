// AppyScript → Home Assistant YAML Automations
// Output: standard HA automation YAML, paste into automations.yaml

import type { Program, Block, Statement, Trigger, Condition, Value } from '../ast'
import type { HardwareProfile, GenerateResult } from '../plugins'

function indent(n: number, s: string): string {
  return s.split('\n').map(l => l ? '  '.repeat(n) + l : l).join('\n')
}

function yamlStr(s: string): string {
  return s.includes("'") ? `"${s}"` : `'${s}'`
}

// Produce a bare Jinja2 expression (NO surrounding {{ }}).
function jinjaExpr(v: Value): string {
  switch(v.kind) {
    case 'number':   return String(v.value)
    case 'string':   return `'${v.value.replace(/'/g, "\\'")}'`
    case 'bool':     return v.value ? 'true' : 'false'
    case 'variable': return v.name
    case 'sensor':   return `states('sensor.${v.sensor}') | float`
    case 'binary': {
      // String concatenation uses ~ in Jinja2; arithmetic uses the operator
      const op = v.op === '+' && (isStringy(v.left) || isStringy(v.right)) ? '~' : v.op
      return `(${jinjaExpr(v.left)} ${op} ${jinjaExpr(v.right)})`
    }
    case 'random':   return `range(${jinjaExpr(v.min)}, ${jinjaExpr(v.max)}) | random`
    case 'round':    return `(${jinjaExpr(v.value)}) | round`
    case 'abs':      return `(${jinjaExpr(v.value)}) | abs`
    case 'min':      return `[${jinjaExpr(v.left)}, ${jinjaExpr(v.right)}] | min`
    case 'max':      return `[${jinjaExpr(v.left)}, ${jinjaExpr(v.right)}] | max`
    case 'length':   return `(${jinjaExpr(v.value)}) | string | length`
    default:         return '0'
  }
}

function isStringy(v: Value): boolean {
  if (v.kind === 'string') return true
  if (v.kind === 'binary' && v.op === '+') return isStringy(v.left) || isStringy(v.right)
  return false
}

// A value used where HA expects a literal/templated scalar.
// Plain literals stay plain; anything dynamic gets wrapped in {{ }} once.
function emitValue(v: Value): string {
  if (v.kind === 'number') return String(v.value)
  if (v.kind === 'string') return yamlStr(v.value)
  if (v.kind === 'bool')   return v.value ? 'true' : 'false'
  return `"{{ ${jinjaExpr(v)} }}"`
}

function emitConditionYaml(cond: Condition, ind: number): string {
  switch(cond.kind) {
    case 'sensor':
      return `${'  '.repeat(ind)}- condition: numeric_state\n${'  '.repeat(ind+1)}entity_id: sensor.${cond.sensor}\n${'  '.repeat(ind+1)}${cond.op==='<'?'below':'above'}: ${cond.threshold}`
    case 'variable':
      return `${'  '.repeat(ind)}- condition: template\n${'  '.repeat(ind+1)}value_template: >-\n${'  '.repeat(ind+2)}{{ ${cond.name} ${cond.op} ${jinjaExpr(cond.value)} }}`
    case 'bool':
      return cond.value ? '' : `${'  '.repeat(ind)}- condition: template\n${'  '.repeat(ind+1)}value_template: 'false'`
    case 'not':
      return `${'  '.repeat(ind)}- condition: not\n${'  '.repeat(ind+1)}conditions:\n${emitConditionYaml(cond.condition, ind+2)}`
    case 'and':
      return `${'  '.repeat(ind)}- condition: and\n${'  '.repeat(ind+1)}conditions:\n${emitConditionYaml(cond.left,ind+2)}\n${emitConditionYaml(cond.right,ind+2)}`
    case 'or':
      return `${'  '.repeat(ind)}- condition: or\n${'  '.repeat(ind+1)}conditions:\n${emitConditionYaml(cond.left,ind+2)}\n${emitConditionYaml(cond.right,ind+2)}`
  }
}

function triggerYaml(trigger: Trigger): string {
  switch(trigger.kind) {
    case 'button_a':    return `- platform: event\n  event_type: appyscript_button_a`
    case 'button_b':    return `- platform: event\n  event_type: appyscript_button_b`
    case 'shaken':      return `- platform: event\n  event_type: appyscript_shaken`
    case 'start':       return `- platform: homeassistant\n  event: start`
    case 'timer':       return `- platform: time_pattern\n  seconds: "/${trigger.interval.value}"`
    case 'received':    return `- platform: event\n  event_type: appyscript_message`
    case 'sensor':      return `- platform: numeric_state\n  entity_id: sensor.${trigger.sensor}\n  ${trigger.op==='<'?'below':'above'}: ${trigger.threshold}`
    case 'motion':      return `- platform: state\n  entity_id: binary_sensor.${trigger.room?trigger.room+'_':''}motion\n  to: 'on'`
    case 'door':        return `- platform: state\n  entity_id: binary_sensor.${trigger.door??'door'}\n  to: '${trigger.event==='opens'?'on':'off'}'`
    case 'presence':    return `- platform: state\n  entity_id: person.${trigger.person??'person'}\n  to: '${trigger.event==='arrives'?'home':'not_home'}'`
    case 'time_of_day': return `- platform: time\n  at: '${String(trigger.hour).padStart(2,'0')}:${String(trigger.minute).padStart(2,'0')}:00'`
    case 'sun':         return `- platform: sun\n  event: ${trigger.event==='rises'?'sunrise':'sunset'}`
    case 'tilted':      return `- platform: event\n  event_type: appyscript_tilted`
  }
}

function statementsYaml(stmts: Statement[], ind: number): string[] {
  const lines: string[] = []
  const p = '  '.repeat(ind)

  for(const stmt of stmts) {
    switch(stmt.kind) {
      case 'lights_on':
        lines.push(`${p}- service: light.turn_on`)
        lines.push(`${p}  target:`)
        lines.push(`${p}    entity_id: light.${stmt.room??'all'}`)
        if(stmt.brightness!==undefined) lines.push(`${p}  data:\n${p}    brightness_pct: ${stmt.brightness}`)
        break
      case 'lights_off':
        lines.push(`${p}- service: light.turn_off`)
        lines.push(`${p}  target:\n${p}    entity_id: light.${stmt.room??'all'}`)
        break
      case 'lights_dim':
        lines.push(`${p}- service: light.turn_on`)
        lines.push(`${p}  target:\n${p}    entity_id: light.${stmt.room??'all'}`)
        lines.push(`${p}  data:\n${p}    brightness_pct: ${emitValue(stmt.level)}`)
        break
      case 'thermostat':
        lines.push(`${p}- service: climate.set_temperature`)
        lines.push(`${p}  target:\n${p}    entity_id: climate.thermostat`)
        lines.push(`${p}  data:\n${p}    temperature: ${emitValue(stmt.temperature)}`)
        break
      case 'lock':
        lines.push(`${p}- service: lock.lock`)
        lines.push(`${p}  target:\n${p}    entity_id: lock.${stmt.device??'front_door'}`)
        break
      case 'unlock':
        lines.push(`${p}- service: lock.unlock`)
        lines.push(`${p}  target:\n${p}    entity_id: lock.${stmt.device??'front_door'}`)
        break
      case 'scene':
        lines.push(`${p}- service: scene.turn_on`)
        lines.push(`${p}  target:\n${p}    entity_id: scene.${stmt.name.toLowerCase().replace(/ /g,'_')}`)
        break
      case 'notify':
        lines.push(`${p}- service: notify.notify`)
        lines.push(`${p}  data:\n${p}    message: ${emitValue(stmt.message)}`)
        break
      case 'say':
        lines.push(`${p}- service: notify.notify`)
        lines.push(`${p}  data:\n${p}    message: ${emitValue(stmt.text)}`)
        break
      case 'set_device':
        lines.push(`${p}- service: homeassistant.turn_on`)
        lines.push(`${p}  target:\n${p}    entity_id: ${stmt.device}`)
        break
      case 'wait':
        const ms = stmt.duration.unit==='ms'?stmt.duration.value:stmt.duration.unit==='s'?stmt.duration.value*1000:stmt.duration.value*60000
        const secs = Math.floor(ms/1000), mins = Math.floor(secs/60)
        lines.push(`${p}- delay:\n${p}    hours: 0\n${p}    minutes: ${mins}\n${p}    seconds: ${secs%60}`)
        break
      case 'if':
        lines.push(`${p}- if:`)
        lines.push(emitConditionYaml(stmt.condition, ind+1))
        lines.push(`${p}  then:`)
        lines.push(...statementsYaml(stmt.then, ind+2))
        if(stmt.else) { lines.push(`${p}  else:`); lines.push(...statementsYaml(stmt.else, ind+2)) }
        break
      case 'repeat':
        lines.push(`${p}- repeat:`)
        lines.push(`${p}    count: ${emitValue(stmt.count)}`)
        lines.push(`${p}    sequence:`)
        lines.push(...statementsYaml(stmt.body, ind+3))
        break
      case 'let':
      case 'set':
        lines.push(`${p}- variables:`)
        lines.push(`${p}    ${stmt.name}: ${emitValue(stmt.value)}`)
        break
      case 'show':
        lines.push(`${p}- service: light.turn_on`)
        const colour: Record<string,string> = {happy:'green',sad:'blue',angry:'red',alert:'yellow',excited:'orange',calm:'teal',sleep:'purple',thinking:'magenta',confused:'pink',dizzy:'white'}
        lines.push(`${p}  data:\n${p}    color_name: ${colour[stmt.expression]??'white'}`)
        break
      default:
        lines.push(`${p}# [${stmt.kind}] — not applicable in Home Assistant`)
    }
  }
  return lines
}

function blockToYaml(block: Block, index: number, defines: Map<string,Block>): string {
  if(block.kind!=='when') return ''

  const alias = `AppyScript ${index+1}`
  const lines: string[] = []
  lines.push(`- alias: ${yamlStr(alias)}`)
  lines.push(`  trigger:`)
  lines.push(indent(2, triggerYaml(block.trigger)))
  lines.push(`  action:`)
  lines.push(...statementsYaml(block.body, 2))
  lines.push('')
  return lines.join('\n')
}

export const homeassistantBackend = {
  targetId: 'homeassistant',
  name: 'Home Assistant YAML Backend',
  version: '1.0.0',
  generate(program: Program, _profile: HardwareProfile): GenerateResult {
    const defines = new Map<string,Block>()
    for(const b of program.blocks) if(b.kind==='define') defines.set(b.name,b)

    const lines: string[] = [
      '# Generated by AppyScript — https://github.com/rahulbachina/appyscript',
      '# Paste this into your Home Assistant automations.yaml',
      '# or import via: Settings → Automations → ⋮ → Edit in YAML',
      '',
    ]

    program.blocks.forEach((block, i) => {
      if(block.kind==='when') lines.push(blockToYaml(block, i, defines))
    })

    return { code: lines.join('\n') }
  }
}
