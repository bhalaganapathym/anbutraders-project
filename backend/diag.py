import requests, sys
sys.stdout.reconfigure(encoding='utf-8')

BASE = 'http://localhost:8080/api/v1'

print("=== STEP 1: Login ===")
r = requests.post(f'{BASE}/login/access-token',
    data={'username': 'admin', 'password': 'password123'},
    headers={'Content-Type': 'application/x-www-form-urlencoded'})
print(f"Login: {r.status_code}")
if r.status_code != 200:
    print("ERROR:", r.text); exit(1)

token = r.json()['access_token']
auth = {'Authorization': f'Bearer {token}'}
print("Login OK")

print("\n=== STEP 2: /users/me ===")
r = requests.get(f'{BASE}/users/me', headers=auth)
print(f"Status: {r.status_code} | Response: {r.text[:150]}")

print("\n=== STEP 3: /dispatches ===")
r = requests.get(f'{BASE}/dispatches', headers=auth)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    d = r.json()
    billing = [x for x in d if x['status'] == 'sent_to_billing']
    print(f"Total dispatches: {len(d)}, Awaiting billing: {len(billing)}")
else:
    print("ERROR:", r.text[:200])

print("\n=== STEP 4: /drivers ===")
r = requests.get(f'{BASE}/drivers', headers=auth)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    drivers = r.json()
    print(f"Drivers count: {len(drivers)}")
    for drv in drivers:
        print(f"  - {drv['name']} / {drv.get('vehicle_number')}")
else:
    print("ERROR:", r.text[:200])

print("\n=== STEP 5: Vite proxy test ===")
try:
    r2 = requests.get('http://localhost:5173/api/dispatches',
        headers={'Authorization': f'Bearer {token}'})
    print(f"Proxy /api/dispatches: {r2.status_code}")
    if r2.status_code == 200:
        print("Proxy working correctly!")
    else:
        print("Proxy error:", r2.text[:200])
except Exception as e:
    print("Proxy failed:", e)

print("\n=== DONE ===")
