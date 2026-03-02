from app.db.database import engine, SessionLocal, Base
from app.db.models import (
    Company, User, UserRole, Budget, Transaction, Employee, SalesGoal,
    Document, Category, CategoryRule, BankImport, UserCompany, UserCompanyRole
)
from datetime import datetime
import bcrypt

def create_tables():
    """Créer toutes les tables"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

def seed_data():
    """Ajouter des données de test"""
    db = SessionLocal()
    try:
        # Vérifier si des données existent déjà
        existing_company = db.query(Company).first()
        if existing_company:
            print("Database already seeded. Skipping...")
            return

        print("Seeding database with initial data...")

        # Créer une entreprise de démonstration
        demo_company = Company(
            name="Demo Company",
            slug="demo-company",
            created_at=datetime.utcnow()
        )
        db.add(demo_company)
        db.flush()

        # Créer un utilisateur admin
        admin_password = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt())
        admin_user = User(
            email="admin@demo.com",
            hashed_password=admin_password.decode('utf-8'),
            full_name="Admin Demo",
            role=UserRole.COMPANY_ADMIN,
            company_id=demo_company.id,
            current_company_id=demo_company.id,
            is_active=True
        )
        db.add(admin_user)
        db.flush()

        # Créer la liaison UserCompany pour l'admin
        admin_user_company = UserCompany(
            user_id=admin_user.id,
            company_id=demo_company.id,
            role=UserCompanyRole.OWNER,
            is_default=True
        )
        db.add(admin_user_company)

        # Créer un utilisateur employé
        employee_password = bcrypt.hashpw("employee123".encode('utf-8'), bcrypt.gensalt())
        employee_user = User(
            email="employee@demo.com",
            hashed_password=employee_password.decode('utf-8'),
            full_name="Employee Demo",
            role=UserRole.EMPLOYEE,
            company_id=demo_company.id,
            current_company_id=demo_company.id,
            is_active=True
        )
        db.add(employee_user)
        db.flush()

        # Créer la liaison UserCompany pour l'employé
        employee_user_company = UserCompany(
            user_id=employee_user.id,
            company_id=demo_company.id,
            role=UserCompanyRole.MEMBER,
            is_default=True
        )
        db.add(employee_user_company)

        db.commit()
        print("Database seeded successfully!")
        print("Demo credentials:")
        print("  Admin: admin@demo.com / admin123")
        print("  Employee: employee@demo.com / employee123")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

def ensure_demo_users():
    """S'assurer que les utilisateurs demo existent (même si la DB existe déjà)"""
    db = SessionLocal()
    try:
        # Trouver ou créer la demo company
        demo_company = db.query(Company).filter(Company.slug == "demo-company").first()
        if not demo_company:
            demo_company = Company(
                name="Demo Company",
                slug="demo-company",
                is_active=True,
                created_at=datetime.utcnow()
            )
            db.add(demo_company)
            db.flush()
            print("Created demo company")

        # Vérifier/créer admin
        admin_user = db.query(User).filter(User.email == "admin@demo.com").first()
        if not admin_user:
            admin_password = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt())
            admin_user = User(
                email="admin@demo.com",
                hashed_password=admin_password.decode('utf-8'),
                full_name="Admin Demo",
                role=UserRole.COMPANY_ADMIN,
                company_id=demo_company.id,
                current_company_id=demo_company.id,
                is_active=True
            )
            db.add(admin_user)
            db.flush()

            # UserCompany
            admin_uc = UserCompany(
                user_id=admin_user.id,
                company_id=demo_company.id,
                role=UserCompanyRole.OWNER,
                is_default=True
            )
            db.add(admin_uc)
            print("Created admin@demo.com user")
        else:
            # Mettre à jour is_active si nécessaire
            if not admin_user.is_active:
                admin_user.is_active = True
                print("Activated admin@demo.com user")

        # Vérifier/créer employee
        employee_user = db.query(User).filter(User.email == "employee@demo.com").first()
        if not employee_user:
            employee_password = bcrypt.hashpw("employee123".encode('utf-8'), bcrypt.gensalt())
            employee_user = User(
                email="employee@demo.com",
                hashed_password=employee_password.decode('utf-8'),
                full_name="Employee Demo",
                role=UserRole.EMPLOYEE,
                company_id=demo_company.id,
                current_company_id=demo_company.id,
                is_active=True
            )
            db.add(employee_user)
            db.flush()

            # UserCompany
            employee_uc = UserCompany(
                user_id=employee_user.id,
                company_id=demo_company.id,
                role=UserCompanyRole.MEMBER,
                is_default=True
            )
            db.add(employee_uc)
            print("Created employee@demo.com user")
        else:
            if not employee_user.is_active:
                employee_user.is_active = True
                print("Activated employee@demo.com user")

        db.commit()
        print("Demo users ready!")
        print("  Admin: admin@demo.com / admin123")
        print("  Employee: employee@demo.com / employee123")

    except Exception as e:
        print(f"Error ensuring demo users: {e}")
        db.rollback()
    finally:
        db.close()


def main():
    create_tables()
    seed_data()

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--ensure-demo":
        create_tables()
        ensure_demo_users()
    else:
        main()
