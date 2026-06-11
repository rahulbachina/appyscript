#!/usr/bin/env node
"use strict";
// AppyScript MCP Server
// Any AI agent (Claude, GPT, Gemini) can use this to generate + compile AppyScript.
//
// Start: node dist/mcp/server.js
// In Claude Desktop: add to claude_desktop_config.json
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const compiler_1 = require("../compiler");
const server = new index_js_1.Server({ name: 'appyscript', version: '0.1.0' }, { capabilities: { tools: {} } });
// ── Tool definitions ──────────────────────────────────────────────────────────
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'appyscript_compile',
            description: [
                'Compile AppyScript source code to hardware-ready code for a specific robot chip.',
                'Returns the compiled code (MicroPython or Arduino C++) ready to flash to the device.',
                'Use this to validate your AppyScript output before presenting it to the student.',
            ].join(' '),
            inputSchema: {
                type: 'object',
                properties: {
                    source: {
                        type: 'string',
                        description: 'AppyScript source code to compile',
                    },
                    target: {
                        type: 'string',
                        enum: ['esp32', 'arduino', 'pico', 'microbit'],
                        description: 'Target hardware platform',
                    },
                },
                required: ['source', 'target'],
            },
        },
        {
            name: 'appyscript_validate',
            description: [
                'Check if AppyScript source code is syntactically valid.',
                'Returns a list of errors with line numbers if invalid.',
                'Always validate before presenting code to a student.',
            ].join(' '),
            inputSchema: {
                type: 'object',
                properties: {
                    source: { type: 'string', description: 'AppyScript source code to validate' },
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
}));
// ── Tool handlers ─────────────────────────────────────────────────────────────
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
        case 'appyscript_compile': {
            const source = args?.source;
            const target = args?.target;
            const result = (0, compiler_1.compile)(source, target);
            if (result.ok && result.code) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                target,
                                code: result.code,
                            }, null, 2),
                        },
                    ],
                };
            }
            else {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: false,
                                errors: result.errors,
                            }, null, 2),
                        },
                    ],
                };
            }
        }
        case 'appyscript_validate': {
            const source = args?.source;
            const result = (0, compiler_1.validate)(source);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        case 'appyscript_explain': {
            const source = args?.source;
            const description = (0, compiler_1.explain)(source);
            return {
                content: [{ type: 'text', text: description }],
            };
        }
        case 'appyscript_list_targets': {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(compiler_1.TARGETS, null, 2),
                    },
                ],
            };
        }
        case 'appyscript_list_keywords': {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ keywords: compiler_1.KEYWORDS }, null, 2),
                    },
                ],
            };
        }
        default:
            return {
                content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                isError: true,
            };
    }
});
// ── Start ─────────────────────────────────────────────────────────────────────
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('AppyScript MCP server running on stdio');
}
main().catch(console.error);
//# sourceMappingURL=server.js.map