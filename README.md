# DafGram - Logiciel de Pilotage Financier

DafGram est une application SaaS complète de pilotage financier pour entreprises, développée avec FastAPI (Python) et Next.js (React/TypeScript).

## Fonctionnalités

### Module Budgets
- Création et gestion de budgets par catégorie
- Visualisation en **camembert** de la répartition des dépenses
- Suivi en temps réel des montants alloués, dépensés et restants
- Distribution automatique des budgets par pourcentage de revenus
- Barres de progression pour chaque budget

### Module Comptabilité
- Suivi des dépenses et revenus
- Statistiques financières (revenus totaux, dépenses, solde net)
- Association des transactions aux budgets
- Filtrage par date, type et catégorie

### Module Employés & Objectifs
- Gestion des employés
- Définition d'objectifs de vente (jour, semaine, mois, trimestre, année)
- **Barres de progression** pour suivre l'avancement des objectifs
- Visualisation des performances en temps réel

### Import automatique (PDF/CSV)
- Upload de documents PDF et CSV
- **OCR (Tesseract)** pour extraction de texte depuis PDFs
- Parsing intelligent pour détecter automatiquement les transactions
- Création automatique des transactions dans le système
- Support multi-formats (CSV, PDF, XLSX)

### Architecture Multi-tenant
- Isolation complète des données par entreprise
- Gestion des utilisateurs et rôles (Super Admin, Admin, Manager, Employé)
- Sécurité renforcée avec JWT

### Authentification
- JWT (JSON Web Tokens) pour l'authentification stateless
- Support OAuth2 (Google et Microsoft) - base implémentée
- Gestion des sessions et refresh tokens

## Stack Technique

### Backend
- **Framework**: FastAPI (Python 3.12)
- **Base de données**: PostgreSQL 16
- **ORM**: SQLAlchemy 2.0
- **Migrations**: Alembic
- **Authentification**: python-jose, passlib, OAuth2
- **Parsing documents**:
  - PyPDF2 & pdfplumber (extraction PDF)
  - Tesseract OCR (reconnaissance de texte)
  - pandas (traitement CSV/Excel)

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI Components**:
  - Material-UI (MUI)
  - Tailwind CSS
  - Recharts (graphiques et camemberts)
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Formulaires**: React Hook Form

### Infrastructure
- **Conteneurisation**: Docker & Docker Compose

## Installation et Démarrage

### Prérequis
- Docker et Docker Compose installés
- Git

### 1. Cloner le projet
```bash
cd dafgram
```

### 2. Configuration
Le fichier `.env` est déjà configuré avec les valeurs par défaut.

**Important** : Changez `JWT_SECRET` en production !

### 3. Lancer l'application
```bash
docker-compose up --build
```

La commande va :
1. Construire les images Docker (backend + frontend)
2. Démarrer PostgreSQL
3. Créer les tables de base de données
4. Initialiser les données de démonstration
5. Démarrer l'API backend sur http://localhost:8000
6. Démarrer le frontend sur http://localhost:3000

### 4. Accéder à l'application

- **Frontend**: http://localhost:3000
- **API Backend**: http://localhost:8000
- **Documentation API**: http://localhost:8000/docs

### 5. Comptes de démonstration

**Admin**:
- Email: `admin@demo.com`
- Mot de passe: `admin123`

**Employé**:
- Email: `employee@demo.com`
- Mot de passe: `employee123`

## Utilisation

### 1. Créer un Budget
1. Aller dans **Budgets** depuis le menu
2. Cliquer sur **"Nouveau Budget"**
3. Renseigner le nom, le montant alloué et choisir une couleur
4. Le budget apparaît dans le camembert et la liste

### 2. Ajouter des Transactions
1. Aller dans **Comptabilité**
2. Cliquer sur **"Nouvelle Transaction"**
3. Choisir le type (Revenu/Dépense), le montant et la description
4. Optionnellement associer à un budget
5. La transaction est enregistrée et les statistiques se mettent à jour

### 3. Gérer les Employés
1. Aller dans **Employés**
2. Créer un employé avec ses informations
3. Sélectionner l'employé et créer des objectifs de vente
4. Les barres de progression s'affichent automatiquement
5. Mettre à jour les montants actuels pour suivre la progression

### 4. Importer des Documents
1. Aller dans **Documents**
2. Cliquer sur **"Sélectionner un fichier"**
3. Choisir un PDF ou CSV contenant des transactions
4. Le système traite automatiquement le document avec OCR
5. Les transactions sont créées automatiquement

## API Endpoints Principaux

### Authentification
- `POST /api/auth/login/json` - Connexion
- `GET /api/auth/me` - Infos utilisateur connecté

### Budgets
- `GET /api/budgets` - Liste des budgets
- `GET /api/budgets/stats` - Stats pour camembert
- `POST /api/budgets` - Créer un budget

### Transactions
- `GET /api/transactions` - Liste des transactions
- `GET /api/transactions/stats` - Statistiques financières
- `POST /api/transactions` - Créer une transaction

### Employés
- `GET /api/employees` - Liste des employés
- `GET /api/employees/{id}/goals` - Objectifs d'un employé
- `POST /api/employees/{id}/goals` - Créer un objectif

### Documents
- `POST /api/documents/upload` - Upload et traitement automatique
- `GET /api/documents` - Liste des documents

Documentation complète: http://localhost:8000/docs

---

Développé avec ❤️ pour DafGram
