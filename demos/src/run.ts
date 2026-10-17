/**
 * Narrated demo runner against a LIVE backend.
 *
 *   cd backend && npm start
 *   cd demos && npm run demo
 *   npm run demo -- mexico-vacation groceries-plus-tv --events
 *   npm run demo -- --group phish
 *   API=http://localhost:8787/api npm run demo
 */
import { VaultClient } from './client'
import { runScenario, type Actor, type StepResult } from './runner'
import { SCENARIOS, SCENARIO_IDS, type Group } from './scenarios'

const args = process.argv.slice(2)
const flag = (f: string) => args.includes(f)
const groupArg = args[args.indexOf('--group') + 1] as Group | undefined
const wantGroup = args.includes('--group') ? groupArg : undefined
const ids = args.filter(a => !a.startsWith('--') && a !== wantGroup)

const base = process.env.API ?? 'http://localhost:8787/api'
const color = !process.env.NO_COLOR && process.stdout.isTTY
const c = (code: string, s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s)
const bold = (s: string) => c('1', s)
const dim = (s: string) => c('2', s)
const green = (s: string) => c('32', s)
const red = (s: string) => c('31', s)

const ACTOR_STYLE: Record<Actor, string> = {
  member: '36', 'shopping agent': '35', 'agent a': '33', 'agent b': '33', vault: '34', network: '37', attacker: '31', narrator: '2',
}

function printStep(s: StepResult) {
  const tag = c(ACTOR_STYLE[s.actor], s.actor.toUpperCase().padEnd(14))
  console.log(`  ${dim(String(s.index).padStart(2))}  ${tag} ${s.actor === 'narrator' ? dim(s.title) : s.title}`)
  for (const l of s.lines) console.log(`${' '.repeat(22)}${dim('·')} ${l}`)
  for (const k of s.checks) console.log(`${' '.repeat(22)}${k.ok ? green('✔') : red('✘')} ${k.what}${k.ok ? '' : red(`  got ${k.got ?? '(nothing)'}`)}`)
}

async function main() {
  const client = new VaultClient(base, (url, init) => fetch(url, init))
  try {
    const h = await client.health()
    if (h.status !== 200) throw new Error(String(h.status))
  } catch (e) {
    console.error(red(`Backend not reachable at ${base} (${(e as Error).message}). Start it with: cd backend && npm start`))
    process.exit(2)
  }

  let selected = SCENARIOS
  if (wantGroup) selected = selected.filter(s => s.group === wantGroup)
  if (ids.length) {
    const unknown = ids.filter(id => !SCENARIO_IDS.includes(id))
    if (unknown.length) { console.error(red(`Unknown scenario id(s): ${unknown.join(', ')}\nKnown: ${SCENARIO_IDS.join(', ')}`)); process.exit(2) }
    selected = selected.filter(s => ids.includes(s.id))
  }

  let failed = 0
  for (const sc of selected) {
    await client.reset()
    const before = client.exchanges.length
    console.log(`\n${bold(`▶ ${sc.id}`)}  ${dim(`[${sc.group} · proves ${sc.proves.join(', ')}]`)}\n  ${sc.title}\n`)
    const result = await runScenario(sc, client, printStep)
    if (flag('--events')) {
      const ev = await client.events()
      console.log(`\n  ${dim('audit feed (member-side):')}`)
      for (const e of ev.json ?? []) console.log(`${' '.repeat(4)}${dim(`#${e.seq}`)} ${String(e.actor).padEnd(14)} ${e.type.padEnd(18)} ${e.summary}`)
    }
    const checks = result.steps.reduce((n, s) => n + s.checks.length, 0)
    const ok = result.failures.length === 0
    if (!ok) failed++
    console.log(`\n  ${ok ? green('✔ PASS') : red('✘ FAIL')}  ${checks} checks · ${result.agentResponses} agent-facing responses scanned · ${result.leaks.length === 0 ? green('0 leaks') : red(`${result.leaks.length} LEAKS`)}`)
    for (const f of result.failures) console.log(`    ${red('✘')} ${f}`)
    client.exchanges.splice(before)
  }

  console.log(`\n${failed === 0 ? green(bold(`All ${selected.length} scenario(s) passed.`)) : red(bold(`${failed} of ${selected.length} scenario(s) FAILED.`))}\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
