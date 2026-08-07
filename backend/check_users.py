import requests

for user in ['admin', 'dispatch', 'billing']:
    r = requests.post('http://localhost:8080/api/v1/login/access-token', 
        data={'username': user, 'password': 'password123'},
        headers={'Content-Type': 'application/x-www-form-urlencoded'})
    status = r.status_code
    print(f'{user}: {status}')
    if status == 200:
        token = r.json()['access_token']
        me = requests.get('http://localhost:8080/api/v1/users/me', headers={'Authorization': 'Bearer ' + token})
        role = me.json().get('role')
        print(f'  role: {role}')
    else:
        print(f'  error: {r.text[:100]}')
