#!/usr/bin/env node
// AppyScript CLI — v2
// Usage:
//   appyscript compile <file> --target <target> [--strict] [--source-map]
//   appyscript validate <file>
//   appyscript explain <file>
//   appyscript simulate <file> [--sensor-distance=50] [--button-a]
//   appyscript list-targets
//   appyscript list-keywords
//   appyscript serve [--port 3001]

import * as fs from 'node:fs'
import * as path from 'node:path'
import { compile, validate, explain, TARGETS, KEYWORDS } from './compiler'
import { simulate } from './simulation/simulator'
import { tokenize } from './lexer'
import { parse } from './parser'
import { skillsCommand } from './skills-installer'

const args = process.argv.slice(2)
const command = args[0]

function flag(name: string): boolean {
  return args.some(a => a === `--${name}`)
}

function option(name: string): string | undefined {
  // Handle --key value (space)
  const spaceIdx = args.indexOf(`--${name}`)
  if (spaceIdx !== -1 && spaceIdx + 1 < args.length && !args[spaceIdx + 1].startsWith("--")) {
    return args[spaceIdx + 1]
  }
  const prefix = `--${name}=`
  const arg = args.find(a => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

function printDivider() {
  console.log('─'.repeat(60))
}

switch (command) {
  case 'compile': {
    const file = args[1]
    if (!file) { console.error('Usage: appyscript compile <file> --target <target>'); process.exit(1) }
    const target = option('target') ?? 'esp32'
    const strict  = flag('strict')
    const withMap = flag('source-map')
    const source  = readFile(file)

    console.log(`\nAppyScript Compiler v2`)
    printDivider()
    console.log(`  File   : ${path.resolve(file)}`)
    console.log(`  Target : ${target}`)
    if (strict)  console.log(`  Mode   : strict (warnings = errors)`)
    printDivider()

    const result = compile(source, target, { strict, sourceMap: withMap })

    if (result.formattedDiagnostics) {
      console.log('\n' + result.formattedDiagnostics)
    }

    if (result.ok && result.code) {
      const ext: Record<string, string> = {
        arduino: 'ino',
        esp32: 'py', pico: 'py', microbit: 'py', circuitpython: 'py',
        homeassistant: 'yaml', esphome: 'yaml',
        nodered: 'json', home: 'json',
      }
      const outFile = file.replace(/\.appy$/, `.${ext[target] ?? 'txt'}`)
      fs.writeFileSync(outFile, result.code)
      console.log(`\n✔ Compiled → ${outFile}`)
      const langLabel: Record<string, string> = {
        arduino: 'C++',
        esp32: 'MicroPython', pico: 'MicroPython', microbit: 'MicroPython',
        circuitpython: 'CircuitPython',
        homeassistant: 'Home Assistant YAML', esphome: 'ESPHome YAML',
        nodered: 'Node-RED JSON', home: 'JSON',
      }
      console.log(`  ${result.code.split('\n').length} lines of ${langLabel[target] ?? 'code'}`)

      if (withMap && result.sourceMap) {
        const mapFile = outFile + '.map'
        fs.writeFileSync(mapFile, JSON.stringify(result.sourceMap.toJSON(), null, 2))
        console.log(`  Source map → ${mapFile}`)
      }

      if (result.warnings.length > 0) {
        console.log(`\n  ${result.warnings.length} warning(s) — run with --strict to treat as errors`)
      }
    } else {
      console.error(`\n✖ Compilation failed — ${result.errors.length} error(s)`)
      process.exit(1)
    }
    break
  }

  case 'validate': {
    const file = args[1]
    if (!file) { console.error('Usage: appyscript validate <file>'); process.exit(1) }
    const source = readFile(file)
    const result = validate(source)
    if (result.valid) {
      console.log(`✔ ${file} — valid AppyScript`)
      if (result.warnings.length > 0) {
        console.log(`  ${result.warnings.length} warning(s)`)
        for (const w of result.warnings) {
          console.log(`  ⚠ [${w.code}] ${w.message}`)
          if (w.span) console.log(`    → Line ${w.span.line}`)
        }
      }
    } else {
      console.error(`✖ ${file} — ${result.errors.length} error(s)`)
      for (const e of result.errors) {
        console.error(`  ✖ [${e.code}] ${e.message}`)
        if (e.span) console.error(`    → Line ${e.span.line}:${e.span.col}`)
        if (e.hint) console.error(`    ℹ ${e.hint}`)
      }
      process.exit(1)
    }
    break
  }

  case 'explain': {
    const file = args[1]
    if (!file) { console.error('Usage: appyscript explain <file>'); process.exit(1) }
    const source = readFile(file)
    console.log(`\nProgram summary: ${path.basename(file)}`)
    printDivider()
    console.log(explain(source))
    break
  }

  case 'simulate': {
    const file = args[1]
    if (!file) { console.error('Usage: appyscript simulate <file>'); process.exit(1) }
    const source = readFile(file)

    // Parse sensor overrides from CLI
    const sensors: Record<string, number> = {}
    for (const sName of ['distance', 'light', 'temperature', 'touch', 'acceleration']) {
      const val = option(`sensor-${sName}`)
      if (val !== undefined) sensors[sName] = Number(val)
    }

    const tokens = tokenize(source)
    const ast = parse(tokens)

    const result = simulate(ast, {
      sensors: sensors as any,
      buttons: { a: flag('button-a'), b: flag('button-b') },
      triggerEvents: [
        ...(flag('shaken') ? ['shaken'] : []),
        ...(flag('tilted') ? ['tilted'] : []),
      ],
      maxTicks: Number(option('max-ticks') ?? '50'),
    })

    console.log(`\nSimulation: ${path.basename(file)}`)
    printDivider()
    console.log(`  Result : ${result.success ? '✔ Success' : '✖ Error'}`)
    console.log(`  Ticks  : ${result.ticks}`)
    console.log(`  Events : ${result.events.length}`)
    if (result.error) console.log(`  Error  : ${result.error}`)
    printDivider()
    console.log('\nEvent log:')
    for (const ev of result.events) {
      const detail = Object.entries(ev.data).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(', ')
      console.log(`  [${String(ev.tick).padStart(3)}] ${ev.type.padEnd(10)} ${detail}`)
    }
    printDivider()
    const s = result.finalState
    console.log('\nFinal robot state:')
    console.log(`  Position   : x=${s.position.x.toFixed(1)}, y=${s.position.y.toFixed(1)}, heading=${s.position.heading}°`)
    console.log(`  Expression : ${s.expression}`)
    console.log(`  Display    : ${s.displayText || '(blank)'}`)
    if (s.variables.size > 0) {
      console.log('  Variables  :')
      for (const [k, v] of s.variables) console.log(`    ${k} = ${v}`)
    }
    break
  }

  case 'list-targets': {
    console.log('\nSupported hardware targets:\n')
    for (const t of TARGETS) {
      console.log(`  ${t.id.padEnd(10)} ${t.name.padEnd(30)} (${t.runtime})`)
      console.log(`             ${t.description}`)
      console.log()
    }
    break
  }

  case 'list-keywords': {
    console.log('\nAppyScript keywords:\n')
    const cols = 6
    for (let i = 0; i < KEYWORDS.length; i += cols) {
      console.log('  ' + KEYWORDS.slice(i, i + cols).map(k => k.padEnd(14)).join(''))
    }
    console.log()
    break
  }

  case 'skills': {
    // Robotics Skills Database installer — async, keeps event loop alive until done
    void skillsCommand(args.slice(1))
    break
  }


  case 'serve': {
    const port = parseInt(option('port') ?? '3001')
    const { startServer } = require('./api/server')
    startServer(port)
    break
  }

  default: {
    console.log(`
AppyScript v2 — The English-first robotics language

Usage:
  appyscript compile   <file.appy> --target <target> [--strict] [--source-map]
  appyscript validate  <file.appy>
  appyscript explain   <file.appy>
  appyscript simulate  <file.appy> [--sensor-distance=50] [--button-a] [--shaken]
  appyscript list-targets
  appyscript list-keywords
//   appyscript serve [--port 3001]
  appyscript skills    list | add <name> [--all] [--agent claude|cursor|codex]

Targets: esp32 | arduino | pico | microbit | circuitpython
`)
    break
  }
}

// ── Skills command (appended at build-time) ────────────────────────────────────
// appyscript skills list
// appyscript skills add <name> [--agent claude|cursor|codex]
// Usage wired into the main switch below via `skills` case.
// The actual implementation lives in src/skills-installer.ts.
