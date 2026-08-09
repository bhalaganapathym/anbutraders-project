import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        page.on('console', lambda msg: print(f'CONSOLE [{msg.type}]: {msg.text}'))
        page.on('pageerror', lambda err: print(f'PAGE ERROR: {err}'))
        
        print("Navigating to http://localhost:5173/orders")
        try:
            await page.goto("http://localhost:5173/orders", wait_until="networkidle")
            print("Navigation complete.")
            await page.wait_for_timeout(1000)
            
            print("Clicking Completed tab...")
            await page.click("text=Completed")
            await page.wait_for_timeout(1000)
            
            print("Taking screenshot...")
            await page.screenshot(path="orders_crash.png")
            print("Done")
        except Exception as e:
            print(f"Exception: {e}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
