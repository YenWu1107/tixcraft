// 用法：先 npm run dev，再執行 BASE_URL=<開發伺服器網址> npm run screenshots（預設 http://localhost:5179）
// 依作業分鏡 7-1～7-9 走一遍購票流程並截圖（1440×900，2 倍解析度 PNG）
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const OUT = process.argv[2] ?? 'screenshots'
const BASE = process.env.BASE_URL ?? 'http://localhost:5179'
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
})
const page = await browser.newPage()
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.log('  console:', m.text()))
page.on('pageerror', (e) => console.log('  pageerror:', e.message))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ready = async () => {
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => (i.onload = i.onerror = r)))))
}
const scrollTo = (y) => page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y)
const shot = async (name) => {
  await page.mouse.move(2, 2)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('saved', name)
}
const clickText = async (selector, text) => {
  const handles = await page.$$(selector)
  for (const h of handles) {
    const t = await h.evaluate((el) => el.textContent.trim())
    if (t.includes(text)) return h.evaluate((el) => el.click())
  }
  throw new Error(`找不到 ${selector}「${text}」`)
}

// 7-1 首頁
await page.goto(BASE + '/', { waitUntil: 'networkidle0' })
await page.evaluate(() => sessionStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })
await ready()
await sleep(1500)
await shot('7-1_首頁')
// 7-1 補充：搜尋列展開「類別」選單
await scrollTo(330)
await clickText('form[role="search"] button', '類別')
await sleep(400)
await shot('7-1b_首頁_搜尋列篩選')

// 7-2 搜尋結果
await page.goto(BASE + '/search?cat=演唱會&date=2026-11_12&region=north', { waitUntil: 'networkidle0' })
await ready()
await sleep(800)
await shot('7-2_搜尋結果')

// 7-3 活動詳情
await page.goto(BASE + '/event', { waitUntil: 'networkidle0' })
await ready()
await sleep(800)
await shot('7-3_活動詳情')
await scrollTo(548)
await sleep(400)
await shot('7-3b_活動詳情_選擇場次')

// 7-4 選擇票區：點選特區 A3
await clickText('a', '立即購票')
await page.waitForSelector('canvas')
await sleep(5000)
await clickText('aside button', 'A3')
await sleep(2500)
await scrollTo(120)
await sleep(800)
await shot('7-4_選擇票區')

// 7-5 選擇張數：3D 座位視野
await clickText('a', '下一步：選擇張數')
await page.waitForSelector('canvas')
await sleep(6000)
await shot('7-5_選擇張數')

// 7-6 安全驗證：故意輸入錯誤
await clickText('a', '下一步：安全驗證')
await page.waitForSelector('#captcha')
await ready()
await page.type('#captcha', 'abcde')
await page.keyboard.press('Enter')
await sleep(800)
await shot('7-6_安全驗證_輸入錯誤')

// 7-7 登入提示：輸入正確驗證碼後跳出
const code = await page.$$eval('[aria-label="驗證碼圖片"] > span', (els) =>
  els.map((e) => e.textContent.trim()).filter((t) => t.length === 1).join(''),
)
await page.type('#captcha', code)
await page.keyboard.press('Enter')
await page.waitForSelector('[role="dialog"]')
await sleep(3000)
await shot('7-7_登入提示')

// 7-8 付款
await clickText('[role="dialog"] button', '登入並繼續付款')
await page.waitForSelector('[role="timer"]')
await ready()
await sleep(3000)
await shot('7-8_付款')

// 7-9 購票成功
await page.click('input[autocomplete="cc-csc"]', { clickCount: 3 })
await page.type('input[autocomplete="cc-csc"]', '421')
await clickText('aside button', '確認付款')
await page.waitForFunction(() => location.pathname === '/success')
await ready()
await sleep(1200)
await shot('7-9_購票成功')

await browser.close()
