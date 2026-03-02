"""
Script pour initialiser la base de données
"""
from app.db.database import engine, Base
from app.db.models import *

def init_db():
    """Créer toutes les tables"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_db()
