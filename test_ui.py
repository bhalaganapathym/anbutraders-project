import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        page.on('console', lambda msg: print(f'CONSOLE: {msg.type}: {msg.text}'))
        
        print('Navigating to http://localhost:5173')
        await page.goto('http://localhost:5173', wait_until='networkidle')
        
        print('Clicking Quick Login for Dispatch Team')
        await page.click('text="Dispatch Team"')
        
        await page.wait_for_timeout(2000)
        
        print('Current URL:', page.url)
        content = await page.content()
        if 'Dashboard' in content:
            print('Dashboard is visible!')
        elif 'Login' in content or 'Sign in' in content:
            print('Still on Login page')
            
        print('Checking active toast errors...')
        # Check for any toast messages
        toasts = await page.locator('.toast, [role="alert"]').all_text_contents()
        if toasts:
            print('Toast errors:', toasts)
            
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
