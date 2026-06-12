#!/usr/bin/env node
// AppyScript REST API Server
// Start: node dist/api/server.js  OR  appyscript serve --port 3001
//
// Endpoints:
//   GET  /api/health           → { status, version }
//   GET  /api/targets          → [{ id, name, runtime, description }]
//   GET  /api/keywords         → { keywords: string[] }
//   GET  /api/openapi.json     → OpenAPI 3.0 spec
//   POST /api/compile          → { source, target } → CompileResult
//   POST /api/validate         → { source, target? } → ValidationResult
//   POST /api/simulate         → { source, sensors?, buttons?, maxTicks? } → SimResult
//   POST /api/explain          → { source } → { explanation: string }

import * as http from 'node:http'
import { compile, validate, explain, TARGETS, KEYWORDS } from '../compiler'
import { tokenize } from '../lexer'
import { parse } from '../parser'
import { simulate } from '../simulation/simulator'
import { openApiSpec } from './openapi'

const DEFAULT_PORT = 3001
const VERSION = '1.0.0'

// ── CORS headers ──────────────────────────────────────────────────────────────

function cors(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// ── JSON helpers ──────────────────────────────────────────────────────────────

function json(res: http.ServerResponse, status: number, data: unknown) {
  cors(res)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data, null, 2))
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

async function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readBody(req)
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

// ── Request handler ───────────────────────────────────────────────────────────

async function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = req.url ?? '/'
  const method = req.method ?? 'GET'

  // Preflight
  if (method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return }

  // ── GET routes ─────────────────────────────────────────────────────────────

  if (method === 'GET') {
    if (url === '/api/health' || url === '/') {
      return json(res, 200, {
        status: 'ok',
        service: 'appyscript-api',
        version: VERSION,
        targets: TARGETS.map(t => t.id),
        docs: '/api/openapi.json',
      })
    }

    if (url === '/api/targets') {
      return json(res, 200, TARGETS)
    }

    if (url === '/api/keywords') {
      return json(res, 200, { keywords: KEYWORDS })
    }

    if (url === '/api/openapi.json') {
      cors(res)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(openApiSpec, null, 2))
    }

    return json(res, 404, { error: 'Not found', hint: 'Try GET /api/health or POST /api/compile' })
  }

  // ── POST routes ────────────────────────────────────────────────────────────

  if (method === 'POST') {
    const body = await parseBody(req)

    if (url === '/api/compile') {
      const source = String(body.source ?? '')
      const target = String(body.target ?? 'esp32')
      const strict = Boolean(body.strict ?? false)

      if (!source) return json(res, 400, { error: 'source is required' })

      const result = compile(source, target, { strict })

      return json(res, result.ok ? 200 : 422, {
        ok:       result.ok,
        target,
        code:     result.code ?? null,
        errors:   result.errors.map(d => ({
          code: d.code, severity: d.severity, message: d.message,
          line: d.span?.line ?? null, col: d.span?.col ?? null,
          hint: d.hint ?? null, fix: d.fix?.description ?? null,
        })),
        warnings: result.warnings.map(d => ({
          code: d.code, message: d.message,
          line: d.span?.line ?? null, hint: d.hint ?? null,
        })),
        stats: result.code ? {
          lines: result.code.split('\n').length,
          chars: result.code.length,
        } : null,
      })
    }

    if (url === '/api/validate') {
      const source = String(body.source ?? '')
      const target = String(body.target ?? 'esp32')
      if (!source) return json(res, 400, { error: 'source is required' })

      const result = compile(source, target, { skipLint: false })
      return json(res, 200, {
        valid:    result.ok,
        errors:   result.errors.map(d => ({
          code: d.code, message: d.message,
          line: d.span?.line ?? null, hint: d.hint ?? null, fix: d.fix?.description ?? null,
        })),
        warnings: result.warnings.map(d => ({
          code: d.code, message: d.message, line: d.span?.line ?? null,
        })),
      })
    }

    if (url === '/api/simulate') {
      const source = String(body.source ?? '')
      if (!source) return json(res, 400, { error: 'source is required' })

      // First validate
      const valResult = compile(source, 'esp32', { skipLint: true })
      if (!valResult.ok) {
        return json(res, 422, {
          success: false,
          error: 'Compilation errors — fix them before simulating',
          errors: valResult.errors.map(d => ({ code: d.code, message: d.message, line: d.span?.line ?? null })),
        })
      }

      const ast = parse(tokenize(source))
      const result = simulate(ast, {
        sensors:      (body.sensors as any) ?? {},
        buttons:      (body.buttons as any) ?? {},
        triggerEvents: (body.triggerEvents as string[]) ?? [],
        maxTicks:     Number(body.maxTicks ?? 50),
        askResponses: (body.askResponses as any) ?? {},
      })

      return json(res, 200, {
        success: result.success,
        ticks:   result.ticks,
        error:   result.error ?? null,
        events:  result.events.map(e => ({ tick: e.tick, type: e.type, ...e.data })),
        finalState: {
          position:    result.finalState.position,
          expression:  result.finalState.expression,
          displayText: result.finalState.displayText,
          variables:   Object.fromEntries(result.finalState.variables),
          lists:       Object.fromEntries([...result.finalState.lists.entries()].map(([k,v])=>[k,[...v]])),
        },
        trace: result.executionTrace.slice(0, 30),
      })
    }

    if (url === '/api/explain') {
      const source = String(body.source ?? '')
      if (!source) return json(res, 400, { error: 'source is required' })
      return json(res, 200, { explanation: explain(source) })
    }

    return json(res, 404, { error: 'Unknown endpoint', endpoints: ['/api/compile','/api/validate','/api/simulate','/api/explain'] })
  }

  return json(res, 405, { error: 'Method not allowed' })
}

// ── Start server ──────────────────────────────────────────────────────────────

export function startServer(port = DEFAULT_PORT) {
  const server = http.createServer(async (req, res) => {
    try {
      await handler(req, res)
    } catch (err) {
      json(res, 500, { error: 'Internal server error', message: String(err) })
    }
  })

  server.listen(port, () => {
    console.log(`\nAppyScript API v${VERSION} running on http://localhost:${port}`)
    console.log(`  GET  /api/health`)
    console.log(`  GET  /api/targets`)
    console.log(`  POST /api/compile   { source, target }`)
    console.log(`  POST /api/validate  { source }`)
    console.log(`  POST /api/simulate  { source, sensors, buttons }`)
    console.log(`  POST /api/explain   { source }`)
    console.log(`  GET  /api/openapi.json`)
    console.log(`\nPress Ctrl+C to stop\n`)
  })

  return server
}

// Run if invoked directly
if (require.main === module) {
  const port = parseInt(process.env.PORT ?? process.argv[2] ?? String(DEFAULT_PORT))
  startServer(port)
}
