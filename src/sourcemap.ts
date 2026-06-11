// AppyScript Source Map
// Maps lines in generated code back to lines in the original .appy source.
// Useful for debuggers and error reporting in IDEs.

export interface SourceMapEntry {
  /** 1-indexed line in generated output */
  generatedLine: number
  /** 1-indexed line in .appy source */
  sourceLine: number
  /** 1-indexed col in .appy source */
  sourceCol: number
}

export class SourceMap {
  private entries: SourceMapEntry[] = []

  record(generatedLine: number, sourceLine: number, sourceCol = 1) {
    this.entries.push({ generatedLine, sourceLine, sourceCol })
  }

  /** Look up which .appy line produced a given generated line */
  lookupGenerated(generatedLine: number): SourceMapEntry | undefined {
    // Find the last entry at or before this line
    let best: SourceMapEntry | undefined
    for (const e of this.entries) {
      if (e.generatedLine <= generatedLine) best = e
    }
    return best
  }

  /** Look up which generated lines correspond to a given .appy line */
  lookupSource(sourceLine: number): SourceMapEntry[] {
    return this.entries.filter(e => e.sourceLine === sourceLine)
  }

  /** Serialise to a simple JSON format */
  toJSON(): object {
    return { version: 1, entries: this.entries }
  }

  /** Emit a compact VLQ-style mapping string (simplified — not full Source Map v3) */
  toInlineComment(): string {
    const compact = this.entries
      .map(e => `${e.generatedLine}:${e.sourceLine}:${e.sourceCol}`)
      .join(',')
    return `# sourceMappingURL=data:application/json,${JSON.stringify({ mappings: compact })}`
  }

  get size(): number { return this.entries.length }
}
