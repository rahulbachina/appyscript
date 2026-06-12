// AppyScript OpenAPI 3.0 Specification
// Enables AI agents to autodiscover and use the AppyScript API

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'AppyScript API',
    version: '1.0.0',
    description: 'Compile, validate, simulate, and explain AppyScript programs. AppyScript is an English-first programming language for educational robotics and home automation.',
    contact: { name: 'Applaa', url: 'https://github.com/rahulbachina/appyscript' },
    license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
  },
  servers: [
    { url: 'https://api.appyscript.dev', description: 'Production API' },
    { url: 'http://localhost:3001', description: 'Local development' },
  ],
  tags: [
    { name: 'compiler',  description: 'Compile and validate AppyScript programs' },
    { name: 'runtime',   description: 'Simulate execution without hardware' },
    { name: 'discovery', description: 'Discover available targets and keywords' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['discovery'],
        summary: 'Health check',
        operationId: 'health',
        responses: {
          '200': { description: 'API is running', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' }, version: { type: 'string', example: '1.0.0' } } } } } }
        }
      }
    },
    '/api/targets': {
      get: {
        tags: ['discovery'],
        summary: 'List all supported hardware targets',
        operationId: 'listTargets',
        description: 'Returns all hardware platforms AppyScript can compile for. Use the target id in /api/compile.',
        responses: {
          '200': { description: 'List of targets', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Target' } } } } }
        }
      }
    },
    '/api/keywords': {
      get: {
        tags: ['discovery'],
        summary: 'List all AppyScript keywords',
        operationId: 'listKeywords',
        responses: {
          '200': { description: 'Keyword list', content: { 'application/json': { schema: { type: 'object', properties: { keywords: { type: 'array', items: { type: 'string' } } } } } } }
        }
      }
    },
    '/api/compile': {
      post: {
        tags: ['compiler'],
        summary: 'Compile AppyScript to hardware code',
        operationId: 'compile',
        description: 'Compiles AppyScript source to MicroPython, Arduino C++, Home Assistant YAML, ESPHome YAML, or Node-RED JSON. Returns generated code plus any errors or warnings.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/CompileRequest' },
              examples: {
                'guard-robot': {
                  summary: 'Guard robot for ESP32',
                  value: { source: 'when distance < 30cm\n  say "INTRUDER!"\n  show angry\nend', target: 'esp32' }
                },
                'home-automation': {
                  summary: 'Home automation for Home Assistant',
                  value: { source: 'when motion detected\n  turn on lights\n  notify "Someone is home!"\nend', target: 'homeassistant' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Compiled successfully', content: { 'application/json': { schema: { '$ref': '#/components/schemas/CompileResult' } } } },
          '422': { description: 'Compilation errors', content: { 'application/json': { schema: { '$ref': '#/components/schemas/CompileResult' } } } },
          '400': { description: 'Missing source' }
        }
      }
    },
    '/api/validate': {
      post: {
        tags: ['compiler'],
        summary: 'Validate AppyScript syntax and semantics',
        operationId: 'validate',
        description: 'Check if AppyScript source code is valid. Returns errors with line numbers, fix suggestions, and warnings. Always validate before presenting code to a user.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/ValidateRequest' } } }
        },
        responses: {
          '200': { description: 'Validation result', content: { 'application/json': { schema: { '$ref': '#/components/schemas/ValidateResult' } } } }
        }
      }
    },
    '/api/simulate': {
      post: {
        tags: ['runtime'],
        summary: 'Simulate program execution without hardware',
        operationId: 'simulate',
        description: 'Runs an AppyScript program in a JavaScript simulation. Inject sensor values and button states. Returns all events the robot/device would fire, final state, and execution trace. Use this to verify a program works before presenting to a student.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/SimulateRequest' },
              examples: {
                'basic': {
                  summary: 'Simulate with distance sensor',
                  value: { source: 'when distance < 30cm\n  show angry\nend', sensors: { distance: 20 }, maxTicks: 5 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Simulation result', content: { 'application/json': { schema: { '$ref': '#/components/schemas/SimulateResult' } } } },
          '422': { description: 'Compilation errors must be fixed first' }
        }
      }
    },
    '/api/explain': {
      post: {
        tags: ['compiler'],
        summary: 'Explain a program in plain English',
        operationId: 'explain',
        description: 'Returns a plain English summary of what an AppyScript program does. Useful for showing students a summary before flashing.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { source: { type: 'string' } }, required: ['source'] } } }
        },
        responses: {
          '200': { description: 'Plain English explanation', content: { 'application/json': { schema: { type: 'object', properties: { explanation: { type: 'string' } } } } } }
        }
      }
    }
  },
  components: {
    schemas: {
      Target: {
        type: 'object',
        properties: {
          id:          { type: 'string', example: 'esp32' },
          name:        { type: 'string', example: 'ESP32 / M5Stack Core S3 SE' },
          runtime:     { type: 'string', example: 'MicroPython' },
          description: { type: 'string' },
        }
      },
      Diagnostic: {
        type: 'object',
        properties: {
          code:     { type: 'string', example: 'E020' },
          severity: { type: 'string', enum: ['error','warning','hint'] },
          message:  { type: 'string' },
          line:     { type: 'integer', nullable: true },
          col:      { type: 'integer', nullable: true },
          hint:     { type: 'string', nullable: true },
          fix:      { type: 'string', nullable: true },
        }
      },
      CompileRequest: {
        type: 'object',
        required: ['source'],
        properties: {
          source: { type: 'string', description: 'AppyScript source code' },
          target: { type: 'string', description: 'Hardware target', default: 'esp32',
            enum: ['esp32','pico','microbit','arduino','circuitpython','homeassistant','esphome','nodered'] },
          strict: { type: 'boolean', description: 'Treat warnings as errors', default: false },
        }
      },
      CompileResult: {
        type: 'object',
        properties: {
          ok:       { type: 'boolean' },
          target:   { type: 'string' },
          code:     { type: 'string', nullable: true },
          errors:   { type: 'array', items: { '$ref': '#/components/schemas/Diagnostic' } },
          warnings: { type: 'array', items: { '$ref': '#/components/schemas/Diagnostic' } },
          stats:    { type: 'object', nullable: true, properties: { lines: { type: 'integer' }, chars: { type: 'integer' } } }
        }
      },
      ValidateRequest: {
        type: 'object',
        required: ['source'],
        properties: {
          source: { type: 'string' },
          target: { type: 'string', default: 'esp32' },
        }
      },
      ValidateResult: {
        type: 'object',
        properties: {
          valid:    { type: 'boolean' },
          errors:   { type: 'array', items: { '$ref': '#/components/schemas/Diagnostic' } },
          warnings: { type: 'array', items: { '$ref': '#/components/schemas/Diagnostic' } },
        }
      },
      SimulateRequest: {
        type: 'object',
        required: ['source'],
        properties: {
          source:       { type: 'string' },
          sensors:      { type: 'object', properties: { distance:{type:'number'}, light:{type:'number'}, temperature:{type:'number'}, touch:{type:'number'}, acceleration:{type:'number'} } },
          buttons:      { type: 'object', properties: { a:{type:'boolean'}, b:{type:'boolean'} } },
          triggerEvents:{ type: 'array', items: { type: 'string', enum: ['shaken','tilted','received'] } },
          maxTicks:     { type: 'integer', default: 50 },
          askResponses: { type: 'object', additionalProperties: { type: 'string' } },
        }
      },
      SimulateResult: {
        type: 'object',
        properties: {
          success:    { type: 'boolean' },
          ticks:      { type: 'integer' },
          error:      { type: 'string', nullable: true },
          events:     { type: 'array', items: { type: 'object' } },
          finalState: { type: 'object' },
        }
      }
    }
  }
}
