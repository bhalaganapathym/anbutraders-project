from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import time

opts = Options()
opts.add_argument('--headless')
try:
    driver = webdriver.Chrome(options=opts)
except Exception as e:
    print('Failed to start chrome:', e)
    exit(1)

driver.get('http://localhost:5173')
time.sleep(2)

try:
    driver.find_element(By.XPATH, '//button[contains(., "Dispatch Team")]').click()
except Exception as e:
    print('Could not click Dispatch Team:', e)
    print(driver.page_source[:500])

time.sleep(2)
print('Current URL after login:', driver.current_url)

try:
    driver.find_element(By.XPATH, '//button[contains(., "Dispatches")]').click()
except Exception as e:
    print('Could not click Dispatches:', e)

time.sleep(2)
print('Current URL after Dispatches:', driver.current_url)

logs = driver.get_log('browser')
for log in logs:
    if log['level'] == 'SEVERE':
        print('SEVERE ERROR:', log['message'])
    else:
        print('LOG:', log['level'], log['message'])

driver.quit()
