from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Enum, Date
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.db.database import Base

# Enums
class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    COMPANY_ADMIN = "company_admin"
    MANAGER = "manager"
    EMPLOYEE = "employee"

class TransactionType(str, enum.Enum):
    REVENUE = "revenue"
    EXPENSE = "expense"

class PeriodType(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"

class AccountType(str, enum.Enum):
    PERSONAL = "personal"
    BUSINESS = "business"


class BankAccountType(str, enum.Enum):
    """Type de compte pour les transactions (entreprise ou associé)"""
    COMPANY = "company"      # Compte Entreprise
    ASSOCIATE = "associate"  # Compte Associé (achats à rembourser)

class SubscriptionPlan(str, enum.Enum):
    FREE = "free"
    PERSONAL = "personal"
    BUSINESS = "business"

class BillingCycle(str, enum.Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"


class PaymentStatus(str, enum.Enum):
    """Statut d'une transaction de paiement Payzen"""
    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class PaymentType(str, enum.Enum):
    """Type de paiement"""
    SETUP_FEE = "setup_fee"      # Frais de mise en place (100 000 XPF)
    SUBSCRIPTION = "subscription"  # Abonnement mensuel/annuel
    COMBINED = "combined"         # Mise en place + premier abonnement


class SubscriptionStatus(str, enum.Enum):
    """Statut de l'abonnement d'une entreprise"""
    TRIAL = "trial"              # Période d'essai
    ACTIVE = "active"            # Abonnement actif
    GRACE_PERIOD = "grace_period"  # Paiement échoué, en période de grâce
    SUSPENDED = "suspended"       # Accès suspendu (période de grâce expirée)
    CANCELLED = "cancelled"       # Annulé par l'utilisateur
    EXPIRED = "expired"          # Expiré


# Models
class UserCompanyRole(str, enum.Enum):
    """Rôle de l'utilisateur au sein d'une entreprise"""
    OWNER = "owner"  # Créateur de l'entreprise
    ADMIN = "admin"  # Administrateur
    MANAGER = "manager"  # Manager
    MEMBER = "member"  # Membre standard


class UserCompany(Base):
    """Table de liaison User-Company pour multi-entreprises"""
    __tablename__ = "user_companies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    role = Column(Enum(UserCompanyRole, values_callable=lambda x: [e.value for e in x]), default=UserCompanyRole.MEMBER)
    is_default = Column(Boolean, default=False)  # Entreprise par défaut
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    user = relationship("User", back_populates="user_companies")
    company = relationship("Company", back_populates="user_companies")


class Company(Base):
    """Modèle Entreprise pour le multi-tenant"""
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)

    # Informations de contact
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)

    # Adresse
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True)

    # Informations légales
    vat_number = Column(String(50), nullable=True)  # Numéro de TVA
    registration_number = Column(String(100), nullable=True)  # SIRET/SIREN

    # Préférences
    currency = Column(String(10), default="EUR")  # Devise (EUR, USD, XPF, etc.)
    language = Column(String(10), default="fr")  # Langue (fr, en, etc.)

    # Logo de l'entreprise
    logo_url = Column(String(500), nullable=True)

    # Type de compte et abonnement
    account_type = Column(Enum(AccountType, values_callable=lambda x: [e.value for e in x]), default=AccountType.PERSONAL)
    subscription_plan = Column(Enum(SubscriptionPlan, values_callable=lambda x: [e.value for e in x]), default=SubscriptionPlan.PERSONAL)
    billing_cycle = Column(Enum(BillingCycle, values_callable=lambda x: [e.value for e in x]), default=BillingCycle.MONTHLY)
    subscription_start = Column(DateTime, nullable=True)
    subscription_end = Column(DateTime, nullable=True)

    # Statut de l'abonnement et paiement (Payzen)
    subscription_status = Column(
        Enum(SubscriptionStatus, values_callable=lambda x: [e.value for e in x]),
        default=SubscriptionStatus.TRIAL,
        nullable=False
    )
    setup_fee_paid = Column(Boolean, default=False)  # Frais de mise en place payés
    setup_fee_paid_at = Column(DateTime, nullable=True)
    last_payment_at = Column(DateTime, nullable=True)  # Dernier paiement réussi
    next_payment_at = Column(DateTime, nullable=True)  # Prochaine échéance
    grace_period_end = Column(DateTime, nullable=True)  # Fin de la période de grâce
    payzen_customer_id = Column(String(100), nullable=True)  # ID client Payzen

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    name_changed = Column(Boolean, default=False)  # True si le nom a déjà été modifié (une seule fois autorisé)

    # Relations
    users = relationship("User", back_populates="company", foreign_keys="User.company_id")
    user_companies = relationship("UserCompany", back_populates="company")
    budgets = relationship("Budget", back_populates="company")
    transactions = relationship("Transaction", back_populates="company")
    employees = relationship("Employee", back_populates="company")
    budget_categories = relationship("BudgetCategory", back_populates="company")


class User(Base):
    """Modèle Utilisateur avec authentification"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Nullable pour OAuth
    full_name = Column(String(200))
    role = Column(Enum(UserRole, values_callable=lambda x: [e.value for e in x]), default=UserRole.EMPLOYEE)

    # OAuth
    google_id = Column(String(255), unique=True, nullable=True)
    microsoft_id = Column(String(255), unique=True, nullable=True)

    # Photo de profil
    avatar_url = Column(String(500), nullable=True)

    # Multi-tenant - Primary company (legacy, pour compatibilité)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Entreprise actuellement sélectionnée
    current_company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company", back_populates="users", foreign_keys=[company_id])
    current_company = relationship("Company", foreign_keys=[current_company_id])
    user_companies = relationship("UserCompany", back_populates="user")


class Budget(Base):
    """Modèle Budget - représente une catégorie budgétaire"""
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Montants
    allocated_amount = Column(Float, default=0.0)  # Montant alloué
    spent_amount = Column(Float, default=0.0)  # Montant dépensé
    percentage_allocation = Column(Float, default=0.0)  # % du revenu total

    # Périodicité
    period_type = Column(Enum(PeriodType, values_callable=lambda x: [e.value for e in x]), default=PeriodType.MONTHLY)
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)

    # Couleur pour la visualisation
    color = Column(String(7), default="#3B82F6")  # Format hex

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company", back_populates="budgets")
    transactions = relationship("Transaction", back_populates="budget")


class Transaction(Base):
    """Modèle Transaction - dépenses et revenus"""
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Type et montant
    type = Column(Enum(TransactionType, values_callable=lambda x: [e.value for e in x]), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(Text, nullable=True)

    # Budget associé (pour les dépenses)
    budget_id = Column(Integer, ForeignKey("budgets.id"), nullable=True)

    # Date et métadonnées
    transaction_date = Column(DateTime, default=datetime.utcnow)
    category = Column(String(100), nullable=True)  # Ancien champ texte (legacy)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # Nouvelle relation

    # Import automatique
    source_file = Column(String(500), nullable=True)  # Chemin du PDF/CSV source
    auto_imported = Column(Boolean, default=False)
    bank_import_id = Column(Integer, ForeignKey("bank_imports.id"), nullable=True)

    # Référence unique pour éviter les doublons (hash de date+montant+description)
    reference_hash = Column(String(64), nullable=True, index=True)

    # Type de compte (entreprise ou associé)
    account_type = Column(
        Enum(BankAccountType, values_callable=lambda x: [e.value for e in x]),
        default=BankAccountType.COMPANY,
        nullable=False,
        index=True
    )

    # Catégorie d'épargne (si la transaction est une épargne)
    savings_category_id = Column(Integer, ForeignKey("savings_categories.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company", back_populates="transactions")
    budget = relationship("Budget", back_populates="transactions")
    category_rel = relationship("Category")
    savings_category = relationship("SavingsCategory")


class Employee(Base):
    """Modèle Employé - pour le suivi des objectifs de vente"""
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Informations de base
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    position = Column(String(100), nullable=True)
    color = Column(String(7), default="#8B5CF6")  # Couleur pour graphiques

    # Lien avec utilisateur (optionnel)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    is_active = Column(Boolean, default=True)
    hired_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company", back_populates="employees")
    sales_goals = relationship("SalesGoal", back_populates="employee")


class SalesGoal(Base):
    """Modèle Objectif de Vente"""
    __tablename__ = "sales_goals"

    id = Column(Integer, primary_key=True, index=True)

    # Employé concerné
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)

    # Objectif
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0.0)

    # Période
    period_type = Column(Enum(PeriodType, values_callable=lambda x: [e.value for e in x]), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)

    # Métadonnées
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    employee = relationship("Employee", back_populates="sales_goals")


class TimeCategory(Base):
    """Modèle Catégorie de Temps - Travail, Formation, Repos, etc."""
    __tablename__ = "time_categories"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Hiérarchie (pour les sous-catégories)
    parent_id = Column(Integer, ForeignKey("time_categories.id"), nullable=True)

    # Informations
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), default="#8B5CF6")
    icon = Column(String(50), nullable=True)  # Nom de l'icône MUI

    # Budget temps - pourcentage du budget hebdomadaire global
    percentage = Column(Float, default=0)  # Ex: 25.0 = 25% du budget hebdomadaire
    # Ancien champ gardé pour compatibilité mais calculé automatiquement
    weekly_minutes_target = Column(Integer, default=0)

    # Ordre d'affichage
    position = Column(Integer, default=0)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company")
    parent = relationship("TimeCategory", remote_side=[id], backref="children")
    time_entries = relationship("TimeEntry", back_populates="category")


class TimeEntry(Base):
    """Modèle Entrée de Temps - pour le suivi du temps du patron"""
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Catégorie de temps (Travail, Formation, Repos, etc.)
    category_id = Column(Integer, ForeignKey("time_categories.id"), nullable=False)

    # Détails du temps
    date = Column(Date, nullable=False)
    duration_minutes = Column(Integer, nullable=False)  # Durée en minutes
    description = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company")
    category = relationship("TimeCategory", back_populates="time_entries")


class Document(Base):
    """Modèle Document - pour stocker les fichiers uploadés"""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Informations fichier
    filename = Column(String(500), nullable=False)
    filepath = Column(String(1000), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, csv, xlsx
    file_size = Column(Integer, nullable=False)  # en bytes

    # Traitement
    processed = Column(Boolean, default=False)
    processing_error = Column(Text, nullable=True)
    extracted_data = Column(Text, nullable=True)  # JSON des données extraites

    # Métadonnées
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Category(Base):
    """Modèle Catégorie - catégories de transactions avec sous-catégories"""
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    name = Column(String(100), nullable=False)
    type = Column(Enum(TransactionType, values_callable=lambda x: [e.value for e in x]), nullable=False)  # revenue ou expense
    color = Column(String(7), default="#6B7280")  # Couleur hex
    icon = Column(String(50), nullable=True)  # Nom de l'icône (optionnel)

    # Hiérarchie des catégories (sous-catégories)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    parent = relationship("Category", remote_side=[id], backref="subcategories")

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CategoryRule(Base):
    """Modèle Règle de catégorisation - pour l'attribution automatique"""
    __tablename__ = "category_rules"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Règle de correspondance
    pattern = Column(String(500), nullable=True)  # Texte à rechercher dans la description (optionnel si source_type défini)
    match_type = Column(String(20), default="contains")  # contains, starts_with, exact, regex
    source_type = Column(Enum(TransactionType, values_callable=lambda x: [e.value for e in x]), nullable=True)  # Filtrer par type de transaction source (revenue/expense)

    # Action
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    transaction_type = Column(Enum(TransactionType, values_callable=lambda x: [e.value for e in x]), nullable=True)  # Forcer le type si défini

    # Priorité (plus élevé = appliqué en premier)
    priority = Column(Integer, default=0)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    category = relationship("Category")


class BudgetCategory(Base):
    """Modèle Budget par Catégorie - pourcentages alloués par catégorie"""
    __tablename__ = "budget_categories"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Catégorie concernée (nullable pour les budgets d'épargne globaux)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    # Pourcentage du revenu total alloué à cette catégorie
    percentage = Column(Float, default=0.0)

    # Montant calculé (basé sur les revenus du mois)
    allocated_amount = Column(Float, default=0.0)

    # Montant dépensé ce mois
    spent_amount = Column(Float, default=0.0)

    # Période
    period_type = Column(Enum(PeriodType, values_callable=lambda x: [e.value for e in x]), default=PeriodType.MONTHLY)
    period_month = Column(Integer, nullable=True)  # 1-12 pour le mois
    period_year = Column(Integer, nullable=True)

    # Épargne - si True, ce budget est un budget d'épargne qui s'accumule
    is_savings = Column(Boolean, default=False)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company", back_populates="budget_categories")
    category = relationship("Category")


class BankImport(Base):
    """Modèle Import Bancaire - historique des imports"""
    __tablename__ = "bank_imports"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Fichier source
    filename = Column(String(500), nullable=False)
    file_type = Column(String(20), nullable=False)  # csv, pdf
    file_size = Column(Integer, nullable=False)

    # Résultat de l'import
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    transactions_imported = Column(Integer, default=0)
    transactions_skipped = Column(Integer, default=0)  # Doublons détectés
    error_message = Column(Text, nullable=True)

    # Métadonnées
    imported_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class ClientType(str, enum.Enum):
    """Type de client"""
    PERSONAL = "personal"
    PROFESSIONAL = "professional"


class Client(Base):
    """Modèle Client - CRM pour la comptabilité"""
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Type de client (particulier ou professionnel)
    client_type = Column(Enum(ClientType, values_callable=lambda x: [e.value for e in x]), default=ClientType.PERSONAL, nullable=False)

    # Informations de base (pour particuliers: nom/prénom, pour pro: nom du contact)
    name = Column(String(200), nullable=False)  # Nom de famille (perso) ou Nom du contact (pro)
    first_name = Column(String(200), nullable=True)  # Prénom (perso) ou Prénom du contact (pro)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)

    # Adresse
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), default="France")

    # Informations entreprise (pour clients professionnels uniquement)
    company_name = Column(String(200), nullable=True)
    vat_number = Column(String(50), nullable=True)
    siret = Column(String(20), nullable=True)

    # Contact (pour pro: fonction du contact)
    contact_position = Column(String(100), nullable=True)

    # Notes
    notes = Column(Text, nullable=True)

    # Métadonnées
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company")
    invoices = relationship("Invoice", back_populates="client")
    quotes = relationship("Quote", back_populates="client")
    attachments = relationship("ClientAttachment", back_populates="client", cascade="all, delete-orphan")


class ClientAttachment(Base):
    """Pièces jointes pour les clients professionnels (KBIS, etc.)"""
    __tablename__ = "client_attachments"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)

    # Informations du fichier
    filename = Column(String(255), nullable=False)  # Nom original du fichier
    stored_filename = Column(String(255), nullable=False)  # Nom stocké (unique)
    file_path = Column(String(500), nullable=False)  # Chemin complet
    file_type = Column(String(100), nullable=True)  # Type MIME
    file_size = Column(Integer, nullable=True)  # Taille en bytes

    # Description optionnelle
    description = Column(String(500), nullable=True)  # Ex: "KBIS", "RIB", "Contrat"

    # Métadonnées
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    client = relationship("Client", back_populates="attachments")


# Enums pour les factures et devis
class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class QuoteStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"


class Invoice(Base):
    """Modèle Facture"""
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Client
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)

    # Numéro de facture (unique par entreprise)
    invoice_number = Column(String(50), nullable=False)

    # Dates
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)

    # Statut
    status = Column(Enum(InvoiceStatus, values_callable=lambda x: [e.value for e in x]), default=InvoiceStatus.DRAFT)

    # Montants
    subtotal = Column(Float, default=0.0)  # Total HT
    tax_rate = Column(Float, default=0.0)  # Taux de TVA en %
    tax_amount = Column(Float, default=0.0)  # Montant TVA
    total_amount = Column(Float, default=0.0)  # Total TTC
    paid_amount = Column(Float, default=0.0)  # Montant déjà payé

    # Informations
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    payment_terms = Column(String(500), nullable=True)

    # Créé à partir d'un devis?
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=True)

    # Métadonnées
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company")
    client = relationship("Client", back_populates="invoices")
    quote = relationship("Quote", back_populates="invoice")
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("InvoicePayment", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceLineItem(Base):
    """Modèle Ligne de facture"""
    __tablename__ = "invoice_line_items"

    id = Column(Integer, primary_key=True, index=True)

    # Facture parente
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)

    # Détails de la ligne
    description = Column(String(500), nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)  # quantity * unit_price

    # Ordre d'affichage
    position = Column(Integer, default=0)

    # Relations
    invoice = relationship("Invoice", back_populates="line_items")


class InvoicePayment(Base):
    """Modèle Paiement de facture - liaison entre facture et transaction"""
    __tablename__ = "invoice_payments"

    id = Column(Integer, primary_key=True, index=True)

    # Facture
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)

    # Transaction bancaire associée (optionnelle)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)

    # Montant du paiement (peut être partiel)
    amount = Column(Float, nullable=False)

    # Date du paiement
    payment_date = Column(Date, nullable=False)

    # Méthode de paiement
    payment_method = Column(String(50), nullable=True)  # virement, carte, chèque, espèces

    # Notes
    notes = Column(Text, nullable=True)

    # Métadonnées
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    invoice = relationship("Invoice", back_populates="payments")
    transaction = relationship("Transaction")


class Quote(Base):
    """Modèle Devis"""
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Client
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)

    # Numéro de devis (unique par entreprise)
    quote_number = Column(String(50), nullable=False)

    # Dates
    issue_date = Column(Date, nullable=False)
    valid_until = Column(Date, nullable=False)

    # Statut
    status = Column(Enum(QuoteStatus, values_callable=lambda x: [e.value for e in x]), default=QuoteStatus.DRAFT)

    # Montants
    subtotal = Column(Float, default=0.0)  # Total HT
    tax_rate = Column(Float, default=0.0)  # Taux de TVA en %
    tax_amount = Column(Float, default=0.0)  # Montant TVA
    total_amount = Column(Float, default=0.0)  # Total TTC

    # Informations
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)

    # Métadonnées
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company")
    client = relationship("Client", back_populates="quotes")
    invoice = relationship("Invoice", back_populates="quote", uselist=False)
    line_items = relationship("QuoteLineItem", back_populates="quote", cascade="all, delete-orphan")


class QuoteLineItem(Base):
    """Modèle Ligne de devis"""
    __tablename__ = "quote_line_items"

    id = Column(Integer, primary_key=True, index=True)

    # Devis parent
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=False)

    # Détails de la ligne
    description = Column(String(500), nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)  # quantity * unit_price

    # TVA par ligne
    vat_rate = Column(Float, default=0.0)  # Taux de TVA en %
    vat_amount = Column(Float, default=0.0)  # Montant TVA calculé
    amount_with_vat = Column(Float, default=0.0)  # Montant TTC

    # Ordre d'affichage
    position = Column(Integer, default=0)

    # Relations
    quote = relationship("Quote", back_populates="line_items")


class VatRate(Base):
    """Taux de TVA configurables par entreprise"""
    __tablename__ = "vat_rates"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Informations du taux
    name = Column(String(100), nullable=False)  # Ex: "TVA normale", "TVA réduite"
    rate = Column(Float, nullable=False)  # Ex: 20.0, 5.5, 0
    description = Column(String(255), nullable=True)  # Ex: "Taux standard France"
    is_default = Column(Boolean, default=False)  # Taux par défaut pour les nouveaux devis
    is_active = Column(Boolean, default=True)

    # Ordre d'affichage
    position = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company")


class CompanySettings(Base):
    """Paramètres de comptabilité personnalisables par entreprise"""
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, unique=True)

    # Personnalisation visuelle des devis/factures
    primary_color = Column(String(7), default="#F5C518")  # Couleur principale (fond des en-têtes)
    secondary_color = Column(String(7), default="#1A1A1A")  # Couleur secondaire (titres)
    text_color = Column(String(7), default="#FFFFFF")  # Couleur du texte sur fond coloré
    logo_url = Column(String(500), nullable=True)  # Logo pour les documents

    # Textes par défaut
    default_quote_terms = Column(Text, nullable=True)  # CGV pour devis
    default_invoice_terms = Column(Text, nullable=True)  # CGV pour factures
    default_quote_notes = Column(Text, nullable=True)  # Notes par défaut devis
    default_invoice_notes = Column(Text, nullable=True)  # Notes par défaut factures
    default_payment_terms = Column(String(500), nullable=True)  # Conditions de paiement

    # Numérotation automatique
    quote_prefix = Column(String(20), default="DEV-")
    invoice_prefix = Column(String(20), default="FAC-")
    quote_next_number = Column(Integer, default=1)
    invoice_next_number = Column(Integer, default=1)

    # Footer personnalisé pour les documents
    document_footer = Column(Text, nullable=True)

    # Configuration SMTP pour l'envoi d'emails
    smtp_host = Column(String(255), nullable=True)  # Ex: smtp.gmail.com
    smtp_port = Column(Integer, default=587)  # Port SMTP (587 pour TLS, 465 pour SSL)
    smtp_user = Column(String(255), nullable=True)  # Nom d'utilisateur SMTP
    smtp_password = Column(String(255), nullable=True)  # Mot de passe SMTP (à chiffrer en prod)
    smtp_from_email = Column(String(255), nullable=True)  # Adresse d'expédition
    smtp_from_name = Column(String(255), nullable=True)  # Nom d'expédition

    # Messages d'email par défaut
    default_invoice_email_message = Column(Text, nullable=True)
    default_quote_email_message = Column(Text, nullable=True)

    # Budget temps hebdomadaire (en minutes) - défaut 40h = 2400 minutes
    time_weekly_budget_minutes = Column(Integer, default=2400)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company")
    bank_accounts = relationship("BankAccount", back_populates="company_settings", cascade="all, delete-orphan")


class SavingsCategory(Base):
    """Modèle Catégorie d'épargne - objectifs d'épargne"""
    __tablename__ = "savings_categories"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), default="#F5C518")

    # Pourcentage de l'épargne totale alloué à cet objectif
    percentage = Column(Float, default=0.0)

    # Catégorie par défaut (créée automatiquement)
    is_default = Column(Boolean, default=False)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company")


class BankAccount(Base):
    """Comptes bancaires (RIB) de l'entreprise"""
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    company_settings_id = Column(Integer, ForeignKey("company_settings.id", ondelete="CASCADE"), nullable=False)

    # Informations du compte
    label = Column(String(100), nullable=True)  # Nom/label du compte (ex: "Compte principal", "Compte épargne")
    bank_name = Column(String(200), nullable=True)
    account_holder = Column(String(200), nullable=True)  # Titulaire du compte
    iban = Column(String(50), nullable=True)
    bic = Column(String(20), nullable=True)

    # Compte par défaut pour les documents
    is_default = Column(Boolean, default=False)

    # Ordre d'affichage
    position = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company_settings = relationship("CompanySettings", back_populates="bank_accounts")


# ==================== PAIEMENT PAYZEN ====================

class PaymentTransaction(Base):
    """Transaction de paiement via Payzen by OSB"""
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Identifiants Payzen
    payzen_transaction_id = Column(String(100), unique=True, nullable=True, index=True)
    payzen_order_id = Column(String(100), nullable=True, index=True)
    form_token = Column(Text, nullable=True)  # Payzen tokens can be very long

    # Détails du paiement
    payment_type = Column(
        Enum(PaymentType, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    amount = Column(Integer, nullable=False)  # Montant en XPF (entier)
    currency = Column(String(10), default="XPF")
    status = Column(
        Enum(PaymentStatus, values_callable=lambda x: [e.value for e in x]),
        default=PaymentStatus.PENDING
    )

    # Période de facturation (pour abonnements)
    billing_cycle = Column(
        Enum(BillingCycle, values_callable=lambda x: [e.value for e in x]),
        nullable=True
    )
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)

    # Erreurs
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)

    # Données IPN
    ipn_received = Column(Boolean, default=False)
    ipn_data = Column(Text, nullable=True)  # JSON complet de l'IPN
    ipn_signature_valid = Column(Boolean, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relations
    company = relationship("Company")


class SubscriptionHistory(Base):
    """Historique des changements de statut d'abonnement"""
    __tablename__ = "subscription_history"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Changement de statut
    previous_status = Column(
        Enum(SubscriptionStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=True
    )
    new_status = Column(
        Enum(SubscriptionStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )

    # Raison du changement
    reason = Column(String(200), nullable=True)
    payment_transaction_id = Column(Integer, ForeignKey("payment_transactions.id"), nullable=True)

    # Qui a effectué le changement
    changed_at = Column(DateTime, default=datetime.utcnow)
    changed_by = Column(String(100), nullable=True)  # "system", "admin", email utilisateur

    # Relations
    company = relationship("Company")
    payment_transaction = relationship("PaymentTransaction")


class PaymentRetry(Base):
    """Suivi des échecs de paiement et tentatives de renouvellement"""
    __tablename__ = "payment_retries"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Transaction originale échouée
    original_transaction_id = Column(Integer, ForeignKey("payment_transactions.id"), nullable=False)

    # Compteur de tentatives
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    next_retry_at = Column(DateTime, nullable=True)

    # Période de grâce (2 jours par défaut)
    grace_period_start = Column(DateTime, nullable=True)
    grace_period_end = Column(DateTime, nullable=True)

    # Notifications
    email_notification_sent = Column(Boolean, default=False)
    sms_notification_sent = Column(Boolean, default=False)
    final_warning_sent = Column(Boolean, default=False)

    # Résolution
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    resolution_type = Column(String(50), nullable=True)  # "payment_success", "manual", "cancelled"

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    company = relationship("Company")
    original_transaction = relationship("PaymentTransaction")
