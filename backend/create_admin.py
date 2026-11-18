
import getpass

from sqlalchemy import select

from database import SessionLocal
from models.user import User
from core.security import hash_password


def create_admin():
    db = SessionLocal()

    try:
        print("\n=== MealMate Admin Setup ===")

        full_name = input("Admin Full Name: ").strip()
        email = input("Admin Email: ").strip().lower()
        password = getpass.getpass("Admin Password: ")
        confirm_password = getpass.getpass("Confirm Password: "
) 

        if not full_name or not email:
            print("Name and email are required.")
            return

        if len(password) < 12:
            print("Password must have at least 12 characters.")
            return

        if password != confirm_password:
            print("Passwords do not match.")
            return

        existing_user = db.scalar(
            select(User).where(User.email == email)
        )

        if existing_user:
            print("This email is already registered.")
            print("Existing user roles will not be changed.")
            return

        admin = User(
            full_name=full_name,
            email=email,
            hashed_password=hash_password(password),
            role="admin",
            is_active=True,
            approval_status=None,
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print("\nAdmin account created successfully!")
        print(f"Admin ID: {admin.id}")
        print(f"Admin Email: {admin.email}")

    except Exception as error:
        db.rollback()
        print(f"Admin creation failed: {error}")

    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
