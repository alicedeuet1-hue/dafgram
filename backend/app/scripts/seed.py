from app.db.database import engine, SessionLocal, Base
from app.db.models import (
    Company, User, UserRole, Budget, Transaction, Employee, SalesGoal,
    Document, Category, CategoryRule, BankImport, UserCompany, UserCompanyRole,
    AccountType, TransactionType, BudgetCategory, SavingsCategory,
)
from datetime import datetime, timezone
from sqlalchemy import inspect
import bcrypt

def create_tables():
    """Créer toutes les tables, reset si le schéma est incompatible"""
    print("Creating database tables...")

    # Vérifier si l'ancien schéma existe (migration depuis l'ancien code)
    inspector = inspect(engine)
    if inspector.has_table("users"):
        columns = [col['name'] for col in inspector.get_columns("users")]
        if "full_name" not in columns:
            print("Incompatible schema detected (old codebase), resetting database...")
            Base.metadata.drop_all(bind=engine)

    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

    # Ajouter les colonnes manquantes sur les tables existantes
    _add_missing_columns()


def _add_missing_columns():
    """Ajouter les colonnes manquantes aux tables existantes (create_all ne le fait pas)"""
    from sqlalchemy import text
    inspector = inspect(engine)

    # Vérifier invite_code sur companies
    if inspector.has_table("companies"):
        columns = [col['name'] for col in inspector.get_columns("companies")]
        if 'invite_code' not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE companies ADD COLUMN invite_code VARCHAR(20)"))
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_companies_invite_code ON companies (invite_code)"))
            print("Added invite_code column to companies")

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
            created_at=datetime.now(timezone.utc)
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
                created_at=datetime.now(timezone.utc)
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


def migrate_personal_accounts():
    """Migrer les comptes personnels existants vers le modèle 50/30/20"""
    db = SessionLocal()
    try:
        personal_companies = db.query(Company).filter(
            Company.account_type == AccountType.PERSONAL
        ).all()

        if not personal_companies:
            return

        for company in personal_companies:
            cid = company.id
            changed = False

            # 1. Vérifier/créer les catégories Quotidien et Plaisirs
            for cat_name, cat_color in [("Quotidien", "#3B82F6"), ("Plaisirs", "#8B5CF6")]:
                existing = db.query(Category).filter(
                    Category.company_id == cid,
                    Category.name == cat_name,
                    Category.type == TransactionType.EXPENSE,
                ).first()
                if not existing:
                    db.add(Category(
                        company_id=cid,
                        name=cat_name,
                        type=TransactionType.EXPENSE,
                        color=cat_color,
                    ))
                    changed = True

            if changed:
                db.flush()

            # 2. Vérifier/créer les BudgetCategories 50/30/20
            existing_budgets = db.query(BudgetCategory).filter(
                BudgetCategory.company_id == cid,
                BudgetCategory.period_month.is_(None),
            ).all()

            if not existing_budgets:
                # Aucun budget permanent → créer les 3
                for cat_name, pct in [("Quotidien", 50), ("Plaisirs", 30)]:
                    cat = db.query(Category).filter(
                        Category.company_id == cid,
                        Category.name == cat_name,
                        Category.type == TransactionType.EXPENSE,
                    ).first()
                    if cat:
                        db.add(BudgetCategory(
                            company_id=cid,
                            category_id=cat.id,
                            percentage=pct,
                            is_savings=False,
                            period_month=None,
                            period_year=None,
                        ))

                # Épargne 20%
                db.add(BudgetCategory(
                    company_id=cid,
                    category_id=None,
                    percentage=20,
                    is_savings=True,
                    period_month=None,
                    period_year=None,
                ))
                changed = True

            # 3. Vérifier/créer les catégories d'épargne
            existing_savings = db.query(SavingsCategory).filter(
                SavingsCategory.company_id == cid,
            ).count()

            if existing_savings == 0:
                for name, desc, color, pct in [
                    ("Fonds d'urgence", "Réserve pour les imprévus", "#EF4444", 40),
                    ("Vacances", "Budget voyages et vacances", "#3B82F6", 30),
                    ("Projets", "Projets personnels à financer", "#8B5CF6", 30),
                ]:
                    db.add(SavingsCategory(
                        company_id=cid,
                        name=name,
                        description=desc,
                        color=color,
                        percentage=pct,
                        is_default=True,
                    ))
                changed = True

            if changed:
                print(f"  Migrated personal account: {company.name} (id={cid})")

        db.commit()
        print("Personal accounts migration complete.")

    except Exception as e:
        print(f"Error migrating personal accounts: {e}")
        db.rollback()
    finally:
        db.close()


def main():
    create_tables()
    seed_data()
    migrate_personal_accounts()

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--ensure-demo":
        create_tables()
        ensure_demo_users()
    else:
        main()
