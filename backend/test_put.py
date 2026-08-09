import requests

BASE = 'http://localhost:8080/api/v1'

r = requests.post(f'{BASE}/login/access-token',
    data={'username': 'admin', 'password': 'password123'},
    headers={'Content-Type': 'application/x-www-form-urlencoded'})
token = r.json()['access_token']
auth = {'Authorization': f'Bearer {token}'}

r = requests.get(f'{BASE}/dispatches', headers=auth)
dispatches = r.json()
if not dispatches:
    print('No dispatches found to test.')
    exit()

detail = dispatches[0]

payload = dict(detail)
payload['status'] = 'sent_to_billing'
payload['weights'] = [{'actual_weight': 100, 'notes': 'Test weight'}]
payload['photos'] = []

r = requests.put(f'{BASE}/dispatches/{detail["id"]}', json=payload, headers=auth)
print(f'PUT response status: {r.status_code}')
print(f'PUT response body: {r.text[:200]}')
