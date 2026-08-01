from locust import HttpUser, task, between

class APIUser(HttpUser):
    wait_time = between(1, 5)
    
    @task(1)
    def health_check(self):
        self.client.get("/health")
        
    @task(2)
    def get_products(self):
        self.client.get("/api/v1/api/products")
        
    @task(2)
    def get_customers(self):
        self.client.get("/api/v1/api/customers")

# Run with: locust -f load_test.py --users 25 --spawn-rate 5 --host http://localhost:8000
