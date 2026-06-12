// AppyScript → Node-RED Flow JSON
// Import directly: Node-RED menu → Import → paste JSON

import type { Program, Block, Statement, Trigger } from '../ast'
import type { HardwareProfile, GenerateResult } from '../plugins'

let _id = 1
const newId = () => `appyscript_${_id++}`

export const noderedBackend = {
  targetId: 'nodered',
  name: 'Node-RED Flow Backend',
  version: '1.0.0',
  generate(program: Program, _profile: HardwareProfile): GenerateResult {
    _id = 1
    const nodes: object[] = []
    let y = 50

    for(const block of program.blocks) {
      if(block.kind!=='when') continue
      const {trigger, body} = block
      const trigId   = newId()
      const actionId = newId()
      const debugId  = newId()
      const x_trig   = 100, x_action = 350, x_debug = 600

      // Trigger node
      nodes.push(triggerNode(trigId, trigger, x_trig, y, [actionId]))

      // Function node (runs the body)
      const code = bodyToJS(body)
      nodes.push({
        id: actionId, type: 'function', name: `AppyScript block ${_id}`,
        func: code, outputs: 1, x: x_action, y,
        wires: [[debugId]]
      })

      // Debug output
      nodes.push({
        id: debugId, type: 'debug', name: 'AppyScript output',
        active: true, tosidebar: true, x: x_debug, y, wires: []
      })

      y += 80
    }

    // Tab node
    const tabId = newId()
    nodes.forEach((n: any) => { if(!n.z) n.z = tabId })
    nodes.push({ id: tabId, type: 'tab', label: 'AppyScript', disabled: false })

    return { code: JSON.stringify(nodes, null, 2) }
  }
}

function triggerNode(id: string, trigger: Trigger, x: number, y: number, wires: string[][]|string[]): object {
  switch(trigger.kind) {
    case 'button_a':
    case 'button_b':
      return { id, type: 'inject', name: trigger.kind, payload: '{}', payloadType: 'json', x, y, wires }
    case 'timer': {
      const ms = trigger.interval.unit==='ms'?trigger.interval.value:trigger.interval.unit==='s'?trigger.interval.value*1000:trigger.interval.value*60000
      return { id, type: 'inject', name: `Every ${trigger.interval.value}${trigger.interval.unit}`, repeat: String(ms/1000), crontab: '', once: false, x, y, wires }
    }
    case 'time_of_day': {
      const h=String(trigger.hour).padStart(2,'0'), m=String(trigger.minute).padStart(2,'0')
      return { id, type: 'inject', name: `At ${h}:${m}`, crontab: `${m} ${h} * * *`, x, y, wires }
    }
    case 'motion':
      return { id, type: 'mqtt in', name: 'Motion detected', topic: `home/motion/${trigger.room??'sensor'}`, qos: '2', x, y, wires }
    case 'sensor':
      return { id, type: 'mqtt in', name: `${trigger.sensor} ${trigger.op} ${trigger.threshold}`, topic: `home/sensor/${trigger.sensor}`, x, y, wires }
    case 'received':
      return { id, type: 'mqtt in', name: 'Received message', topic: 'home/appyscript/messages', x, y, wires }
    default:
      return { id, type: 'inject', name: String(trigger.kind), x, y, wires: [wires as any] }
  }
}

function bodyToJS(stmts: Statement[]): string {
  const lines = ['// AppyScript generated — Node-RED function node', 'const out = [];', '']
  for(const stmt of stmts) {
    switch(stmt.kind) {
      case 'lights_on':  lines.push(`out.push({ topic: 'home/lights/${stmt.room??'all'}', payload: 'ON' });`); break
      case 'lights_off': lines.push(`out.push({ topic: 'home/lights/${stmt.room??'all'}', payload: 'OFF' });`); break
      case 'lights_dim': lines.push(`out.push({ topic: 'home/lights/${stmt.room??'all'}/brightness', payload: JSON.stringify({brightness: ${stmt.level.kind==='number'?stmt.level.value:50}}) });`); break
      case 'thermostat': lines.push(`out.push({ topic: 'home/thermostat/set', payload: JSON.stringify({temperature: ${stmt.temperature.kind==='number'?stmt.temperature.value:20}}) });`); break
      case 'notify':     lines.push(`node.warn(${stmt.message.kind==='string'?JSON.stringify(stmt.message.value):`msg.payload`});`); break
      case 'say':        lines.push(`node.warn(${stmt.text.kind==='string'?JSON.stringify(stmt.text.value):`msg.payload`});`); break
      case 'lock':       lines.push(`out.push({ topic: 'home/lock/${stmt.device??'door'}', payload: 'LOCK' });`); break
      case 'unlock':     lines.push(`out.push({ topic: 'home/lock/${stmt.device??'door'}', payload: 'UNLOCK' });`); break
      case 'scene':      lines.push(`out.push({ topic: 'home/scene', payload: ${JSON.stringify(stmt.name)} });`); break
      case 'wait':       lines.push(`// wait ${stmt.duration.value}${stmt.duration.unit} — use delay node in Node-RED`); break
      case 'let':        lines.push(`let ${stmt.name} = ${stmt.value.kind==='number'?stmt.value.value:0};`); break
      case 'set':        lines.push(`${stmt.name} = ${stmt.value.kind==='number'?stmt.value.value:0};`); break
      case 'send':       lines.push(`out.push({ topic: 'home/appyscript/messages', payload: msg.payload });`); break
      default:           lines.push(`// [${stmt.kind}]`); break
    }
  }
  lines.push('', `return out.length === 1 ? [out[0]] : [{ payload: out }];`)
  return lines.join('\n')
}
