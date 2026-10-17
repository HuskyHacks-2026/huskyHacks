import { chromium } from 'playwright-core'
const URL = process.argv[2] ?? 'http://localhost:5173'
const shots = process.argv[3] ?? '.'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } })
const errors = []
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
page.on('console', m => m.type() === 'error' && errors.push('console: ' + m.text()))
page.on('requestfailed', r => errors.push('reqfailed: ' + r.url()))
const T = id => page.getByTestId(id)
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) process.exitCode = 1 }
const phase = () => T('agent-pay-screen').getAttribute('data-phase')
const waitPhase = async p => { for (let i = 0; i < 60; i++) { if ((await phase()) === p) return true; await page.waitForTimeout(250) } return false }

await page.goto(URL); await T('open-agent-pay').click()
await T('scenario-groceries').click()
check('groceries: Agent A approved -> card minted, shopping', await waitPhase('shopping'))
check('card OPEN', (await T('virtual-card').getAttribute('data-status')) === 'OPEN')
await T('next-step').click()
check('bad cart rejected by Agent B', await waitPhase('cart_rejected'))
await page.screenshot({ path: `${shots}/1-rejected.png` })
await T('next-step').click()
check('fixed cart approved', await waitPhase('cart_approved'))
await T('next-step').click()
check('purchase -> closed', await waitPhase('closed'))
check('card CLOSED', (await T('card-status').innerText()) === 'CLOSED')
await T('next-step').click()
await page.waitForTimeout(1500)
const rogue = await T('rogue-result').innerText().catch(() => '')
check('rogue charge declined', /declin|blocked|closed/i.test(rogue), JSON.stringify(rogue))
await page.screenshot({ path: `${shots}/2-closed.png` })
const leak = await T('leak-scan').innerText()
check('leak scan clean', !/found|leak(ed)?!/i.test(leak) || /no |0 |clean|never/i.test(leak), JSON.stringify(leak.slice(0, 120)))

await T('restart').click(); await T('scenario-boat').click()
check('boat: needs member override', await waitPhase('needs_override'))
await page.screenshot({ path: `${shots}/3-override.png` })
await T('override-deny').click()
check('boat decline -> denied', await waitPhase('denied'))
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
