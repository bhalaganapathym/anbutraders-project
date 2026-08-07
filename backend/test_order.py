import requests

res = requests.get("http://localhost:8080/api/v1/customers")
if not res.ok:
    print("Failed to get customers:", res.text)
    exit(1)
customers = res.json()
if not customers:
    print("No customers found")
    exit(1)
customer_id = customers[0]['id']

res = requests.get("http://localhost:8080/api/v1/products")
products = res.json()
if not products:
    print("No products")
    exit(1)
product_id = products[0]['id']

payload = {
    "customer_id": customer_id,
    "delivery_address": "Test address",
    "notes": "Test notes",
    "status": "pending",
    "items": [
        {"product_id": product_id, "quantity": 1, "unit": "kg"}
    ]
}

print("Sending payload...")
res = requests.post("http://localhost:8080/api/v1/orders", json=payload)
print(res.status_code)
print(res.text)
