import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Capture console and page errors
        page.on('console', lambda msg: print(f'CONSOLE [{msg.type}]: {msg.text}'))
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
        
        print('Opening first dispatch (DSP-0005)')
        try:
            # Click the exact dispatch they just billed, DSP-0005 or DSP-0004
            dispatch_link = page.locator('text="DSP-0005"').first
            await dispatch_link.click(timeout=3000)
            await page.wait_for_timeout(3000)
            print('Successfully clicked DSP-0005. URL:', page.url)
        except Exception as e:
            print('Failed to click DSP-0005:', e)
        
        try:
            dispatch_link2 = page.locator('text="DSP-0004"').first
            await dispatch_link2.click(timeout=3000)
            await page.wait_for_timeout(3000)
            print('Successfully clicked DSP-0004. URL:', page.url)
        except Exception as e:
            print('Failed to click DSP-0004:', e)

        print('Test finished.')
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
