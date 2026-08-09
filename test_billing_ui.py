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
        
        print('Current URL:', page.url)
        content = await page.content()
        if 'Dashboard' in content or 'Dispatch' in content:
            print('Login successful!')
            await page.click('text="Billing"')
            await page.wait_for_timeout(1000)
            
            # Click Review & Bill
            print('Clicking Review & Bill')
            try:
                await page.click('text="Review & Bill"', timeout=3000)
                await page.wait_for_timeout(2000)
                
                print('Selecting Driver')
                await page.select_option('select:has-text("Select a driver...")', index=1)
                await page.wait_for_timeout(1000)
                
                print('Clicking Confirm & Send to Dispatch')
                await page.click('text="Confirm & Send to Dispatch"', timeout=3000)
                await page.wait_for_timeout(2000)
                
                print('Navigating to Dispatches')
                await page.click('text="Dispatches"')
                await page.wait_for_timeout(2000)
                
                print('Opening ready for loading dispatch')
                dispatch_link = page.locator('button.text-indigo-700').first
                try:
                    await dispatch_link.click(timeout=3000)
                    await page.wait_for_timeout(2000)
                    print('Current URL:', page.url)
                except Exception as e:
                    print('Click failed, taking screenshot')
                    await page.screenshot(path='dispatch_page.png')
                    raise e
            except Exception as e:
                print('Error:', e)
        else:
            print('Billing page not found')
        
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
