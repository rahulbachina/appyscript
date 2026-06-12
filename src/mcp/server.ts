#!/usr/bin/env node
// AppyScript MCP Server — v2
// Any AI agent (Claude, GPT, Gemini) can use this to generate, compile,
// validate, explain, and simulate AppyScript programs.
//
// Start:   node dist/mcp/server.js
// Claude Desktop: add to claude_desktop_config.json

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { compile, validate, explain, TARGETS, KEYWORDS, type Target } from '../compiler'
import { tokenize } from '../lexer'
import { parse } from '../parser'
import { simulate } from '../simulation/simulator'
import { formatDiagnostics } from '../diagnostics'
import { HARDWARE_PROFILES } from '../plugins'

const server = new Server(
  { name: 'appyscript', version: '2.0.0' },
  { capabilities: { tools: {} } }
)

// ── Tool definitions ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'appyscript_compile',
      description: [
        'Compile AppyScript source code to hardware-ready code for a specific robot chip.',
        'Returns MicroPython (ESP32, Pico, micro:bit) or Arduino C++ ready to flash.',
        'Also returns structured diagnostics — errors AND warnings — so you can fix issues before presenting to the student.',
        'Use appyscript_validate first to check syntax, then appyscript_compile to generate code.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'AppyScript source code to compile' },
          target: {
            type: 'string',
            enum: ['esp32', 'arduino', 'pico', 'microbit'],
            description: 'Target hardware platform',
          },
          strict: {
            type: 'boolean',
            description: 'Treat warnings as errors (default false)',
          },
        },
        required: ['source', 'target'],
      },
    },
    {
      name: 'appyscript_validate',
      description: [
        'Check if AppyScript source code is valid — syntax AND semantic checks.',
        'Returns errors with line numbers and fix suggestions.',
        'Also returns warnings (e.g. infinite loops without wait, unused behaviours).',
        'Always validate before presenting code to a student.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'AppyScript source code to validate' },
          target: {
            type: 'string',
            enum: ['esp32', 'arduino', 'pico', 'microbit'],
            description: 'Optional: target hardware for hardware-specific checks (e.g. sensor availability)',
          },
        },
        required: ['source'],
      },
    },
    {
      name: 'appyscript_explain',
      description: [
        'Explain what an AppyScript program does in plain English.',
        'Useful for showing students a summary of their robot\'s behaviour before flashing.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'AppyScript source code to explain' },
        },
        required: ['source'],
      },
    },
    {
      name: 'appyscript_simulate',
      description: [
        'Simulate an AppyScript program in JavaScript — no hardware required.',
        'Runs the program and returns: all events the robot would emit (say, show, move, turn, etc.),',
        'the final robot state (position, expression, variables), and an execution trace.',
        'Use this to verify a program behaves correctly before presenting it to a student.',
        'You can inject sensor values and button presses to test conditional logic.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'AppyScript source code to simulate' },
          sensors: {
            type: 'object',
            description: 'Override sensor readings: { distance: 20, light: 80, temperature: 25 }',
            properties: {
              distance:     { type: 'number' },
              light:        { type: 'number' },
              temperature:  { type: 'number' },
              touch:        { type: 'number' },
              acceleration: { type: 'number' },
            },
          },
          buttons: {
            type: 'object',
            description: 'Button states: { a: true, b: false }',
            properties: {
              a: { type: 'boolean' },
              b: { type: 'boolean' },
            },
          },
          triggerEvents: {
            type: 'array',
            items: { type: 'string', enum: ['shaken', 'tilted', 'received'] },
            description: 'Which event triggers to fire',
          },
          maxTicks: {
            type: 'number',
            description: 'Max simulation loop iterations (default 50)',
          },
        },
        required: ['source'],
      },
    },
    {
      name: 'appyscript_hardware_info',
      description: [
        'Get detailed hardware capability information for a specific target.',
        'Shows: available sensors, memory (flash/RAM), async support, display, radio.',
        'Use this to know which sensors are available before writing sensor-based code.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            enum: ['esp32', 'arduino', 'pico', 'microbit'],
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'appyscript_list_targets',
      description: 'List all supported robot hardware platforms that AppyScript can compile for.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'appyscript_list_keywords',
      description: [
        'List all valid AppyScript keywords.',
        'Use this to check what words are available when generating AppyScript programs.',
      ].join(' '),
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}))

// ── Tool handlers ─────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {

      // ── compile ─────────────────────────────────────────────────────────────
      case 'appyscript_compile': {
        const source  = args?.source as string
        const target  = args?.target as Target
        const strict  = (args?.strict as boolean) ?? false
        const result  = compile(source, target, { strict })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success:    result.ok,
              target,
              code:       result.code ?? null,
              errors:     result.errors.map(d => ({
                code: d.code, message: d.message,
                line: d.span?.line, col: d.span?.col,
                hint: d.hint, fix: d.fix?.description,
              })),
              warnings:   result.warnings.map(d => ({
                code: d.code, message: d.message,
                line: d.span?.line, hint: d.hint,
              })),
              formatted:  result.formattedDiagnostics ?? null,
            }, null, 2),
          }],
          isError: !result.ok,
        }
      }

      // ── validate ─────────────────────────────────────────────────────────────
      case 'appyscript_validate': {
        const source = args?.source as string
        const target = (args?.target as Target | undefined) ?? 'esp32'
        const result = compile(source, target, { skipLint: false })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              valid:    result.ok,
              errors:   result.errors.map(d => ({
                code: d.code, message: d.message,
                line: d.span?.line, col: d.span?.col,
                hint: d.hint, fix: d.fix?.description,
              })),
              warnings: result.warnings.map(d => ({
                code: d.code, message: d.message,
                line: d.span?.line, hint: d.hint,
              })),
            }, null, 2),
          }],
        }
      }

      // ── explain ───────────────────────────────────────────────────────────────
      case 'appyscript_explain': {
        const source = args?.source as string
        const description = explain(source)
        return { content: [{ type: 'text', text: description }] }
      }

      // ── simulate ──────────────────────────────────────────────────────────────
      case 'appyscript_simulate': {
        const source = args?.source as string

        // First validate
        const valResult = compile(source, 'esp32', { skipLint: true })
        if (!valResult.ok) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Program has syntax errors — fix them before simulating',
                errors: valResult.errors.map(d => ({ message: d.message, line: d.span?.line })),
              }, null, 2),
            }],
            isError: true,
          }
        }

        const tokens = tokenize(source)
        const ast    = parse(tokens)
        const result = simulate(ast, {
          sensors:      (args?.sensors as any) ?? {},
          buttons:      (args?.buttons as any) ?? {},
          triggerEvents: (args?.triggerEvents as string[]) ?? [],
          maxTicks:     (args?.maxTicks as number) ?? 50,
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              ticks:   result.ticks,
              error:   result.error ?? null,
              events:  result.events.map(e => ({
                tick: e.tick,
                type: e.type,
                ...e.data,
              })),
              finalState: {
                position:    result.finalState.position,
                expression:  result.finalState.expression,
                displayText: result.finalState.displayText,
                variables:   Object.fromEntries(result.finalState.variables),
              },
              executionTrace: result.executionTrace.slice(0, 20).map(t => ({
                tick:    t.tick,
                block:   t.blockKind,
                stmt:    t.statementKind,
                line:    t.sourceLine,
              })),
            }, null, 2),
          }],
        }
      }

      // ── hardware_info ─────────────────────────────────────────────────────────
      case 'appyscript_hardware_info': {
        const target  = args?.target as string
        const profile = HARDWARE_PROFILES[target]
        if (!profile) {
          return {
            content: [{ type: 'text', text: `Unknown target: ${target}` }],
            isError: true,
          }
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id:           profile.id,
              name:         profile.name,
              runtime:      profile.runtime,
              description:  profile.description,
              sensors: {
                distance:     { available: profile.sensors.distance,     note: profile.sensors.distance ? 'HC-SR04 compatible' : 'Not built-in' },
                light:        { available: profile.sensors.light },
                temperature:  { available: profile.sensors.temperature },
                touch:        { available: profile.sensors.touch },
                acceleration: { available: profile.sensors.acceleration, note: profile.sensors.acceleration ? 'Built-in IMU' : 'No built-in IMU' },
              },
              memory: {
                flashKB: profile.memory.flashKB,
                ramKB:   profile.memory.ramKB,
              },
              features: {
                asyncEventHandlers: profile.supportsAsync,
                builtInDisplay:     profile.hasDisplay,
                wirelessRadio:      profile.hasRadio,
              },
              agentGuidance: [
                profile.sensors.distance ? null : `⚠ No distance sensor — avoid "when distance < Xcm"`,
                profile.sensors.acceleration ? null : `⚠ No accelerometer — avoid "when shaken"`,
                !profile.hasDisplay ? `ℹ No built-in display — show/say commands use serial output` : null,
                profile.memory.ramKB < 10 ? `⚠ Very limited RAM (${profile.memory.ramKB}KB) — keep programs short` : null,
              ].filter(Boolean),
            }, null, 2),
          }],
        }
      }

      // ── list_targets ──────────────────────────────────────────────────────────
      case 'appyscript_list_targets': {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(TARGETS, null, 2),
          }],
        }
      }

      // ── list_keywords ─────────────────────────────────────────────────────────
      case 'appyscript_list_keywords': {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ keywords: KEYWORDS }, null, 2),
          }],
        }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        }
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Internal error: ${err}` }],
      isError: true,
    }
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('AppyScript MCP server v2 running on stdio')
}

main().catch(console.error)
