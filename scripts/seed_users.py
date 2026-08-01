import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.all import User
from core.security import get_password_hash

engine = create_engine('postgresql://postgres:AnbuTraders%40143@db.icumcxpsprdlcpanqseb.supabase.co:5432/postgres')
Session = sessionmaker(bind=engine)
db = Session()

users_to_create = [
    {
        "username": "admin",
        "email": "admin@anbutraders.com",
        "password": "password123",
        "role": "admin",
        "secret_question": "What is your favorite color?",
        "secret_answer": "blue"
    },
    {
        "username": "billing",
        "email": "billing@anbutraders.com",
        "password": "password123",
        "role": "billing",
        "secret_question": "What is your favorite color?",
        "secret_answer": "blue"
    },
    {
        "username": "dispatch",
        "email": "dispatch@anbutraders.com",
        "password": "password123",
        "role": "dispatch",
        "secret_question": "What is your favorite color?",
        "secret_answer": "blue"
    }
]

for u in users_to_create:
    user = db.query(User).filter(User.username == u["username"]).first()
    if not user:
        new_user = User(
            username=u["username"],
            email=u["email"],
            role=u["role"],
            hashed_password=get_password_hash(u["password"]),
            secret_question=u["secret_question"],
            secret_answer_hash=get_password_hash(u["secret_answer"])
        )
        db.add(new_user)
        print(f"Created {u['username']}")
    else:
        # update existing
        user.hashed_password = get_password_hash(u["password"])
        user.role = u["role"]
        user.secret_question = u["secret_question"]
        user.secret_answer_hash = get_password_hash(u["secret_answer"])
        print(f"Updated {u['username']}")

db.commit()
db.close()
print("Seeding complete.")
