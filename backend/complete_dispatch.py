import requests, json

DISPATCH_ID = '6f77f909-4511-47a4-b790-51185b70ae7c'
ORDER_ID = '70d7269e-3932-4e8a-a562-3e15bfd8a31f'
CUSTOMER_ID = '4e0d882b-c3fa-45f3-b2cd-22fd957fb1f1'
PRODUCT_ID = 'e3adf705-3170-4546-9a0b-dfad9de9bb5c'

# GET current dispatch
r = requests.get(f'http://localhost:8080/api/v1/dispatches/{DISPATCH_ID}')
d = r.json()
print('Current status:', d['status'])

# PUT to mark as completed
payload = {
    'dispatch_no': d['dispatch_no'],
    'order_id': ORDER_ID,
    'customer_id': CUSTOMER_ID,
    'delivery_address': d['delivery_address'],
    'status': 'completed',
    'driver_name': d.get('driver_name'),
    'driver_mobile': d.get('driver_mobile'),
    'vehicle_number': d.get('vehicle_number'),
    'items': [{'product_id': PRODUCT_ID, 'product_name': 'TMT', 'quantity': 1.0, 'unit': 'nos', 'price': 200.0}],
    'weights': [{'actual_weight': 10.5, 'notes': 'Verified for TMT'}],
    'photos': []
}
r2 = requests.put(f'http://localhost:8080/api/v1/dispatches/{DISPATCH_ID}', json=payload)
print('PUT status:', r2.status_code)
if r2.status_code == 200:
    resp = r2.json()
    no = resp['dispatch_no']
    status = resp['status']
    driver = resp['driver_name']
    vehicle = resp['vehicle_number']
    completed = resp.get('completed_at')
    has_bill = resp.get('bill') is not None
    print()
    print('=== FULL FLOW COMPLETED SUCCESSFULLY ===')
    print(f'  Dispatch: {no}')
    print(f'  Status: {status}')
    print(f'  Driver: {driver} ({vehicle})')
    print(f'  Completed at: {completed}')
    print(f'  Bill attached: {has_bill}')
else:
    print('Error:', r2.text[:500])
