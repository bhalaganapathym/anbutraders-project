import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        page.on('console', lambda msg: print(f'CONSOLE: {msg.type}: {msg.text}'))
        page.on('pageerror', lambda err: print(f'PAGE ERROR: {err}'))
        
        print('Navigating to http://localhost:5173')
        await page.goto('http://localhost:5173', wait_until='networkidle')
        
        print('Clicking Login')
        await page.fill('input[type="text"]', 'admin')
        await page.fill('input[type="password"]', 'password123')
        await page.click('text="Sign In"')
        
        await page.wait_for_timeout(2000)
        
        print('Navigating to Dispatches')
        await page.click('text="Dispatches"')
        await page.wait_for_timeout(2000)
        
        print('Opening ready for loading dispatch')
        try:
            # We will click the first dispatch link
            dispatch_link = page.locator('button.text-indigo-700').first
            await dispatch_link.click(timeout=3000)
            await page.wait_for_timeout(2000)
            print('Successfully opened Dispatch detail. URL:', page.url)
        except Exception as e:
            print('Failed to open dispatch detail:', e)
            await page.screenshot(path='dispatch_page_error.png')
            
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
