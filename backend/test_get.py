import requests

BASE = 'http://localhost:8080/api/v1'
r = requests.post(f'{BASE}/login/access-token',
    data={'username': 'admin', 'password': 'password123'},
    headers={'Content-Type': 'application/x-www-form-urlencoded'})
auth = {'Authorization': 'Bearer ' + r.json()['access_token']}

r = requests.get(f'{BASE}/dispatches', headers=auth)
dispatches = r.json()
if dispatches:
    print('Dispatch 0 order:', dispatches[0].get('order'))
    print('Dispatch 0 customer:', dispatches[0].get('customer'))
