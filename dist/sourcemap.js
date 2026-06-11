"use strict";
// AppyScript Source Map
// Maps lines in generated code back to lines in the original .appy source.
// Useful for debuggers and error reporting in IDEs.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceMap = void 0;
class SourceMap {
    entries = [];
    record(generatedLine, sourceLine, sourceCol = 1) {
        this.entries.push({ generatedLine, sourceLine, sourceCol });
    }
    /** Look up which .appy line produced a given generated line */
    lookupGenerated(generatedLine) {
        // Find the last entry at or before this line
        let best;
        for (const e of this.entries) {
            if (e.generatedLine <= generatedLine)
                best = e;
        }
        return best;
    }
    /** Look up which generated lines correspond to a given .appy line */
    lookupSource(sourceLine) {
        return this.entries.filter(e => e.sourceLine === sourceLine);
    }
    /** Serialise to a simple JSON format */
    toJSON() {
        return { version: 1, entries: this.entries };
    }
    /** Emit a compact VLQ-style mapping string (simplified — not full Source Map v3) */
    toInlineComment() {
        const compact = this.entries
            .map(e => `${e.generatedLine}:${e.sourceLine}:${e.sourceCol}`)
            .join(',');
        return `# sourceMappingURL=data:application/json,${JSON.stringify({ mappings: compact })}`;
    }
    get size() { return this.entries.length; }
}
exports.SourceMap = SourceMap;
//# sourceMappingURL=sourcemap.js.map