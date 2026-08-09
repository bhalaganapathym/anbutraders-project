import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Capture console and page errors
        page.on('console', lambda msg: print(f'CONSOLE [{msg.type}]: {msg.text}'))
        page.on('pageerror', lambda err: print(f'PAGE ERROR: {err}'))
        
        print('Navigating to root (to ensure login state)')
        await page.goto('http://localhost:5173', wait_until='networkidle')
        try:
            print('Clicking Login')
            await page.fill('input[type="text"]', 'admin')
            await page.fill('input[type="password"]', 'password123')
            await page.click('text="Sign In"')
            await page.wait_for_timeout(2000)
        except Exception as e:
            print('Login might not be needed:', e)

        print('Navigating to orders')
        await page.goto('http://localhost:5173/orders', wait_until='networkidle')
        await page.wait_for_timeout(2000)
        print('Navigated successfully')
        
        await page.screenshot(path="orders_crash_before.png")
        
        print('Clicking New Order')
        await page.click('button:has-text("New Order")')
        await page.wait_for_timeout(2000)
        print('Clicked New Order successfully')
        
        await page.screenshot(path="orders_crash2.png")
        await page.click('button.hover\\:underline >> text="ORD1-09082026"')
        await page.wait_for_timeout(2000)
        print('Order clicked')
        
        await page.screenshot(path="orders_crash2.png")
        
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
