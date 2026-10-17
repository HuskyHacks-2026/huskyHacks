// Drives the website's "Test cases" view in a real browser: usage `node e2e/test-cases.mjs <site-url> [screenshot-dir]`
import { chromium } from 'playwright-core'
const URL = process.argv[2] ?? 'http://localhost:5173'
const SHOTS = process.argv[3]
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const IDS = ['groceries-week', 'mexico-vacation', 'dinner-for-four', 'household-reorder', 'groceries-plus-tv', 'mexico-wire-fee',
  'injection-gift-cards', 'phish-for-account-numbers', 'stolen-card-mid-shopping', 'total-agent-failure',
  'boat-member-approves', 'boat-member-rejects', 'casino-denied']

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
// scenarios deliberately trigger 4xx refusals (insufficient funds, denied mint...); the browser logs those as console errors
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text()) && errors.push('console: ' + m.text()))
let failed = false
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed = true }
const T = (id) => page.getByTestId(id)

await page.goto(URL)
await T('view-tests').click()
check('Test cases view renders all scenarios', (await page.locator('[data-testid^="tc-status-"]').count()) === IDS.length)

await T('run-all').click()
const deadline = Date.now() + 120_000
let summary = ''
while (Date.now() < deadline) {
  summary = await T('tc-summary').innerText()
  if (/^13 passed/.test(summary) || /[1-9]\d* failed/.test(summary)) break
  await page.waitForTimeout(500)
}
check('summary shows 13 passed, 0 failed', /^13 passed · 0 failed/.test(summary), JSON.stringify(summary))
for (const id of IDS) {
  const st = await T(`tc-status-${id}`).getAttribute('data-status')
  check(`scenario ${id}`, st === 'pass', st)
}

await T('tc-total-agent-failure').click()
const verdict = await T('tc-verdict').getAttribute('data-status')
const text = await T('tc-steps').innerText()
check('detail shows verdict pass', verdict === 'pass')
check('detail shows attacker blocked + no-leak line', /attacker/i.test(text) && /no account number, routing, member id/i.test(text))
if (SHOTS) await page.screenshot({ path: `${SHOTS}/test-cases.png` })

// the other view still works after switching back
await T('view-demo').click()
check('Live demo view still reachable', await T('open-agent-pay').isVisible())

console.log('browser errors:', errors.length ? errors : 'none')
check('no browser errors', errors.length === 0)
await browser.close()
process.exit(failed ? 1 : 0)
