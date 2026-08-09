import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        page.on('console', lambda msg: print(f'CONSOLE [{msg.type}]: {msg.text}'))
        page.on('pageerror', lambda err: print(f'PAGE ERROR: {err}'))
        
        await page.goto('http://localhost:5173', wait_until='networkidle')
        await page.fill('input[type="text"]', 'admin')
        await page.fill('input[type="password"]', 'admin123')
        await page.click('text="Sign In"')
        await page.wait_for_timeout(2000)
        
        print("Going to dispatches")
        await page.goto('http://localhost:5173/dispatches', wait_until='networkidle')
        await page.wait_for_timeout(2000)
        
        print("Skipping click, getting HTML")
        print("Getting HTML")
        html = await page.content()
        with open('dispatches_html.txt', 'w', encoding='utf-8') as f:
            f.write(html)
        print("Done")
        await browser.close()

asyncio.run(main())
