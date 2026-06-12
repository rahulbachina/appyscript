// AppyScript Skills Installer
// Installs skills from the Robotics Skills Database (github.com/rahulbachina/robotics-skills)
// into any AI coding agent: Claude Code, Cursor, Codex/AGENTS.md.
//
// Usage (wired into the CLI as the `skills` command):
//   appyscript skills list
//   appyscript skills add pid-control
//   appyscript skills add --all
//   appyscript skills add esp32 --agent cursor
//
// No dependencies — uses node https + fs only.

import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const SKILLS_REPO = 'rahulbachina/robotics-skills'
const RAW_BASE = `https://raw.githubusercontent.com/${SKILLS_REPO}/main`

export type AgentTarget = 'claude' | 'cursor' | 'codex'

export interface CatalogEntry {
  name: string
  cluster: string
  path: string         // e.g. "skills/algorithms/pid-control/SKILL.md"
  description: string
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'appyscript-skills' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchText(res.headers.location!).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

export async function fetchCatalog(): Promise<CatalogEntry[]> {
  const raw = await fetchText(`${RAW_BASE}/catalog.json`)
  return JSON.parse(raw) as CatalogEntry[]
}

// ── Install targets ───────────────────────────────────────────────────────────

function claudeSkillsDir(): string {
  return path.join(os.homedir(), '.claude', 'skills')
}

function cursorRulesDir(cwd: string): string {
  return path.join(cwd, '.cursor', 'rules')
}

/** Convert a SKILL.md into a Cursor .mdc rule file. */
function toCursorRule(skillMd: string): string {
  // SKILL.md frontmatter: name + description → Cursor frontmatter: description + globs
  const fm = skillMd.match(/^---\n([\s\S]*?)\n---\n?/)
  let description = ''
  if (fm) {
    const descMatch = fm[1].match(/description:\s*(.+)/)
    description = descMatch ? descMatch[1].trim() : ''
  }
  const body = fm ? skillMd.slice(fm[0].length) : skillMd
  return `---\ndescription: ${description}\nglobs: []\nalwaysApply: false\n---\n${body}`
}

/** Append a skill reference to AGENTS.md for Codex-style agents. */
function agentsMdEntry(entry: CatalogEntry, localPath: string): string {
  return `- When working on ${entry.name.replace(/-/g, ' ')}: read \`${localPath}\` — ${entry.description}\n`
}

// ── Core installer ────────────────────────────────────────────────────────────

export interface InstallResult {
  name: string
  installedTo: string
}

export async function installSkill(
  entry: CatalogEntry,
  agent: AgentTarget,
  cwd = process.cwd(),
): Promise<InstallResult> {
  const skillMd = await fetchText(`${RAW_BASE}/${entry.path}`)

  switch (agent) {
    case 'claude': {
      const dir = path.join(claudeSkillsDir(), entry.name)
      fs.mkdirSync(dir, { recursive: true })
      const dest = path.join(dir, 'SKILL.md')
      fs.writeFileSync(dest, skillMd, 'utf8')
      return { name: entry.name, installedTo: dest }
    }
    case 'cursor': {
      const dir = cursorRulesDir(cwd)
      fs.mkdirSync(dir, { recursive: true })
      const dest = path.join(dir, `${entry.name}.mdc`)
      fs.writeFileSync(dest, toCursorRule(skillMd), 'utf8')
      return { name: entry.name, installedTo: dest }
    }
    case 'codex': {
      // Store skill locally + reference it from AGENTS.md
      const dir = path.join(cwd, 'skills', entry.cluster, entry.name)
      fs.mkdirSync(dir, { recursive: true })
      const dest = path.join(dir, 'SKILL.md')
      fs.writeFileSync(dest, skillMd, 'utf8')

      const agentsMd = path.join(cwd, 'AGENTS.md')
      const relPath = path.relative(cwd, dest).replace(/\\/g, '/')
      const line = agentsMdEntry(entry, relPath)
      const header = '## Robotics Skills (installed by appyscript)\n'

      let content = fs.existsSync(agentsMd) ? fs.readFileSync(agentsMd, 'utf8') : '# AGENTS.md\n'
      if (!content.includes(header)) {
        content += `\n${header}`
      }
      if (!content.includes(line)) {
        // Insert under the header
        content = content.replace(header, header + line)
        fs.writeFileSync(agentsMd, content, 'utf8')
      }
      return { name: entry.name, installedTo: dest }
    }
  }
}

// ── CLI command handlers ──────────────────────────────────────────────────────

export async function skillsList(): Promise<void> {
  console.log('\nRobotics Skills Database — available skills:\n')
  try {
    const catalog = await fetchCatalog()
    const byCluster = new Map<string, CatalogEntry[]>()
    for (const e of catalog) {
      const list = byCluster.get(e.cluster) ?? []
      list.push(e)
      byCluster.set(e.cluster, list)
    }
    for (const [cluster, entries] of byCluster) {
      console.log(`  ${cluster}/`)
      for (const e of entries) {
        console.log(`    ${e.name.padEnd(28)} ${e.description.slice(0, 70)}`)
      }
    }
    console.log(`\n${catalog.length} skills available.`)
    console.log('Install: appyscript skills add <name> [--agent claude|cursor|codex] [--all]\n')
  } catch (err) {
    console.error(`Could not fetch the skills catalog: ${(err as Error).message}`)
    console.error(`Check your internet connection, or browse: https://github.com/${SKILLS_REPO}`)
    process.exitCode = 1
  }
}

export async function skillsAdd(args: string[]): Promise<void> {
  const all = args.includes('--all')
  const agentIdx = args.indexOf('--agent')
  const agent = (agentIdx >= 0 ? args[agentIdx + 1] : 'claude') as AgentTarget

  if (!['claude', 'cursor', 'codex'].includes(agent)) {
    console.error(`Unknown agent "${agent}". Use: claude, cursor, or codex`)
    process.exitCode = 1
    return
  }

  const names = args.filter((a, i) => !a.startsWith('--') && (agentIdx < 0 || i !== agentIdx + 1))

  if (!all && names.length === 0) {
    console.error('Tell me which skill to add: appyscript skills add pid-control')
    console.error('Or install everything: appyscript skills add --all')
    process.exitCode = 1
    return
  }

  try {
    const catalog = await fetchCatalog()
    const toInstall = all
      ? catalog
      : catalog.filter((e) => names.includes(e.name))

    const missing = names.filter((n) => !catalog.some((e) => e.name === n))
    for (const m of missing) {
      const close = catalog.find((e) => e.name.includes(m) || m.includes(e.name))
      console.error(`Skill "${m}" not found.${close ? ` Did you mean "${close.name}"?` : ''}`)
    }

    if (toInstall.length === 0) {
      process.exitCode = 1
      return
    }

    console.log(`Installing ${toInstall.length} skill(s) for ${agent}...\n`)
    for (const entry of toInstall) {
      const result = await installSkill(entry, agent)
      console.log(`  ✓ ${result.name} → ${result.installedTo}`)
    }
    console.log(`\nDone! Your ${agent === 'claude' ? 'Claude Code' : agent === 'cursor' ? 'Cursor' : 'Codex/AGENTS.md'} agent now has robotics expertise.`)
  } catch (err) {
    console.error(`Install failed: ${(err as Error).message}`)
    process.exitCode = 1
  }
}

/** Entry point called from cli.ts: appyscript skills <list|add> [...] */
export async function skillsCommand(args: string[]): Promise<void> {
  const sub = args[0]
  if (sub === 'list' || sub === undefined) return skillsList()
  if (sub === 'add') return skillsAdd(args.slice(1))
  console.error(`Unknown skills command "${sub}". Use: list, add`)
  process.exitCode = 1
}
