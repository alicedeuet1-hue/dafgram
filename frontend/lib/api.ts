import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE || (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://api.dafgram.com'
    : 'http://localhost:8000'
);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token JWT et logger les requêtes
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Pour FormData, laisser axios définir le Content-Type avec le boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  // Debug: log outgoing request data
  if (config.data) {
    console.log('DEBUG API: Sending request to', config.url, 'with data:', config.data);
  }
  return config;
});

// Intercepteur pour gérer les erreurs et les avertissements d'abonnement
api.interceptors.response.use(
  (response) => {
    // Vérifier les avertissements d'abonnement dans les headers
    const subscriptionWarning = response.headers['x-subscription-warning'];
    const daysRemaining = response.headers['x-days-remaining'];

    if (subscriptionWarning) {
      // Dispatcher un événement pour afficher l'avertissement
      window.dispatchEvent(new CustomEvent('subscription-warning', {
        detail: {
          warning: subscriptionWarning,
          daysRemaining: daysRemaining ? parseInt(daysRemaining) : undefined
        }
      }));
    }

    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expiré ou invalide
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    } else if (error.response?.status === 402) {
      // Paiement requis - rediriger vers la page de paiement
      const detail = error.response.data?.detail;
      if (detail) {
        localStorage.setItem('subscription_error', JSON.stringify(detail));
      }
      window.location.href = '/payment';
    }
    return Promise.reject(error);
  }
);

// Types pour l'inscription
export interface CompanyData {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  vat_number?: string;
}

export interface RegisterData {
  company: CompanyData;
  email: string;
  password: string;
  full_name: string;
}

// Auth
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login/json', { email, password }),

  register: (data: any) =>
    api.post('/api/auth/register', data),

  // Inscription entreprise + admin
  registerCompany: (data: RegisterData) =>
    api.post('/api/auth/register/company', data),

  getMe: () =>
    api.get('/api/auth/me'),

  // Avatar utilisateur
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/auth/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteAvatar: () => api.delete('/api/auth/me/avatar'),
};

// Budgets
export const budgetsAPI = {
  getAll: () => api.get('/api/budgets'),
  getStats: () => api.get('/api/budgets/stats'),
  getOne: (id: number) => api.get(`/api/budgets/${id}`),
  create: (data: any) => api.post('/api/budgets', data),
  update: (id: number, data: any) => api.put(`/api/budgets/${id}`, data),
  delete: (id: number) => api.delete(`/api/budgets/${id}`),
};

// Transactions
export type AccountType = 'company' | 'associate';

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface Transaction {
  id: number;
  type: 'revenue' | 'expense';
  amount: number;
  description: string;
  transaction_date: string;
  category_id?: number;
  category?: Category;
  auto_imported?: boolean;
  account_type: AccountType;
  savings_category_id?: number;
}

export interface AssociateSummary {
  total_expenses: number;
  total_reimbursed: number;
  balance_to_reimburse: number;
  transaction_count: number;
}

export interface StatsComparison {
  current_month: {
    revenue: number;
    expenses: number;
    net_profit: number;
  };
  previous_month: {
    revenue: number;
    expenses: number;
    net_profit: number;
  };
  changes: {
    revenue: number;
    expenses: number;
    net_profit: number;
  };
  month: number;
  year: number;
}

export interface HistoryDataPoint {
  label: string;
  revenue: number;
  expenses: number;
  date?: string;
  month?: number;
  year?: number;
}

export interface StatsHistory {
  data: HistoryDataPoint[];
  period: 'day' | 'week' | 'month';
}

export const transactionsAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    type?: string;
    category_id?: number;
    savings_category_id?: number;
    start_date?: string;
    end_date?: string;
    account_type?: AccountType;
  }) =>
    api.get<PaginatedTransactions>('/api/transactions', { params }),
  getStats: (params?: { start_date?: string; end_date?: string; account_type?: AccountType }) =>
    api.get('/api/transactions/stats', { params }),
  getStatsComparison: (year?: number, month?: number) =>
    api.get<StatsComparison>('/api/transactions/stats/comparison', { params: { year, month } }),
  getStatsHistory: (period: 'day' | 'week' | 'month' = 'month', count: number = 6, offset: number = 0) =>
    api.get<StatsHistory>('/api/transactions/stats/history', { params: { period, count, offset } }),
  getAssociateSummary: (params?: { start_date?: string; end_date?: string }) =>
    api.get<AssociateSummary>('/api/transactions/stats/associate-summary', { params }),
  getOne: (id: number) => api.get(`/api/transactions/${id}`),
  create: (data: any) => api.post('/api/transactions', data),
  update: (id: number, data: any) => api.put(`/api/transactions/${id}`, data),
  delete: (id: number) => api.delete(`/api/transactions/${id}`),
};

// Employees
export const employeesAPI = {
  getAll: () => api.get('/api/employees'),
  getOne: (id: number) => api.get(`/api/employees/${id}`),
  create: (data: any) => api.post('/api/employees', data),
  update: (id: number, data: any) => api.put(`/api/employees/${id}`, data),
  delete: (id: number) => api.delete(`/api/employees/${id}`),

  getGoals: (employeeId: number) => api.get(`/api/employees/${employeeId}/goals`),
  createGoal: (employeeId: number, data: any) => api.post(`/api/employees/${employeeId}/goals`, data),
  updateGoal: (employeeId: number, goalId: number, data: any) =>
    api.put(`/api/employees/${employeeId}/goals/${goalId}`, data),
  deleteGoal: (employeeId: number, goalId: number) =>
    api.delete(`/api/employees/${employeeId}/goals/${goalId}`),
};

// Documents
export const documentsAPI = {
  getAll: () => api.get('/api/documents'),
  getOne: (id: number) => api.get(`/api/documents/${id}`),
  upload: (file: File, autoProcess: boolean = true) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/api/documents/upload?auto_process=${autoProcess}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  process: (id: number) => api.post(`/api/documents/${id}/process`),
  delete: (id: number) => api.delete(`/api/documents/${id}`),
};

// Companies (multi-entreprises)
export interface CompanyInfo {
  id: number;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  vat_number?: string;
  currency?: string;
  language?: string;
  logo_url?: string;
  is_active: boolean;
  name_changed?: boolean;
}

export interface UserCompanyInfo {
  id: number;
  company: CompanyInfo;
  role: string;
  is_default: boolean;
}

export interface CompanyUpdateData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  currency?: string;
  language?: string;
}

export const companiesAPI = {
  getMyCompanies: () => api.get<UserCompanyInfo[]>('/api/companies/me/companies'),
  getCurrentCompany: () => api.get<CompanyInfo>('/api/companies/me/current-company'),
  switchCompany: (companyId: number) =>
    api.post('/api/companies/me/switch-company', { company_id: companyId }),
  updateCompany: (data: CompanyUpdateData) =>
    api.put<CompanyInfo>('/api/companies/me/company', data),
  setDefaultCompany: (companyId: number) =>
    api.post(`/api/companies/me/companies/${companyId}/set-default`),

  // Logo entreprise
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<CompanyInfo>('/api/companies/me/company/logo', formData);
  },
  deleteLogo: () => api.delete<CompanyInfo>('/api/companies/me/company/logo'),
};

// ============== Company Settings (Comptabilité) ==============

export interface BankAccount {
  id: number;
  company_settings_id: number;
  label?: string;
  bank_name?: string;
  account_holder?: string;
  iban?: string;
  bic?: string;
  is_default: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface BankAccountCreate {
  label?: string;
  bank_name?: string;
  account_holder?: string;
  iban?: string;
  bic?: string;
  is_default?: boolean;
}

export interface CompanySettings {
  id: number;
  company_id: number;

  // Personnalisation visuelle
  primary_color: string;
  secondary_color: string;
  text_color: string;
  logo_url?: string;

  // Textes par défaut
  default_quote_terms?: string;
  default_invoice_terms?: string;
  default_quote_notes?: string;
  default_invoice_notes?: string;
  default_payment_terms?: string;

  // Numérotation
  quote_prefix: string;
  invoice_prefix: string;
  quote_next_number: number;
  invoice_next_number: number;

  // Footer
  document_footer?: string;

  // Configuration SMTP
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string; // Masqué avec ******** si configuré
  smtp_from_email?: string;
  smtp_from_name?: string;
  smtp_configured?: boolean; // Indique si SMTP est configuré

  // Messages d'email par défaut
  default_invoice_email_message?: string;
  default_quote_email_message?: string;

  // Comptes bancaires
  bank_accounts: BankAccount[];

  created_at: string;
  updated_at: string;
}

export interface CompanySettingsUpdate {
  primary_color?: string;
  secondary_color?: string;
  text_color?: string;
  default_quote_terms?: string;
  default_invoice_terms?: string;
  default_quote_notes?: string;
  default_invoice_notes?: string;
  default_payment_terms?: string;
  quote_prefix?: string;
  invoice_prefix?: string;
  quote_next_number?: number;
  invoice_next_number?: number;
  document_footer?: string;
  // SMTP
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_from_email?: string;
  smtp_from_name?: string;
  // Messages d'email par défaut
  default_invoice_email_message?: string;
  default_quote_email_message?: string;
}

export const companySettingsAPI = {
  get: () => api.get<CompanySettings>('/api/companies/me/company/settings'),
  update: (data: CompanySettingsUpdate) =>
    api.put<CompanySettings>('/api/companies/me/company/settings', data),

  // Logo pour les documents
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<CompanySettings>('/api/companies/me/company/settings/logo', formData);
  },
  deleteLogo: () => api.delete<CompanySettings>('/api/companies/me/company/settings/logo'),

  // Bank accounts
  getBankAccounts: () => api.get<BankAccount[]>('/api/companies/me/company/settings/bank-accounts/'),
  createBankAccount: (data: BankAccountCreate) =>
    api.post<BankAccount>('/api/companies/me/company/settings/bank-accounts/', data),
  updateBankAccount: (id: number, data: BankAccountCreate) =>
    api.put<BankAccount>(`/api/companies/me/company/settings/bank-accounts/${id}/`, data),
  deleteBankAccount: (id: number) =>
    api.delete(`/api/companies/me/company/settings/bank-accounts/${id}/`),
};

// ============== Import Bancaire ==============

export interface Category {
  id: number;
  name: string;
  type: 'revenue' | 'expense';
  color: string;
  icon?: string;
  is_active: boolean;
  parent_id?: number;
  subcategories?: Category[];
}

export interface CategoryRule {
  id: number;
  pattern?: string;
  match_type: string;
  source_type?: 'revenue' | 'expense';  // Filtre par type de transaction source
  category_id: number;
  transaction_type?: string;
  priority: number;
  is_active: boolean;
  category: Category;
}

export interface ImportPreviewTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'revenue' | 'expense';
  category_id?: number;
  category_name?: string;
  savings_category_id?: number;
  is_duplicate: boolean;
  reference_hash: string;
}

export interface ImportPreviewResponse {
  transactions: ImportPreviewTransaction[];
  total_count: number;
  duplicates_count: number;
  categorized_count: number;
  // Informations de debug
  total_lines?: number;
  skipped_lines?: number;
  skipped_reasons?: Record<string, number>;
  format_detected?: Record<string, any>;
  sample_skipped?: Array<Record<string, any>>;
}

export interface BankImport {
  id: number;
  filename: string;
  file_type: string;
  status: string;
  transactions_imported: number;
  transactions_skipped: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export const bankAPI = {
  // Catégories
  getCategories: (type?: string, includeSubcategories?: boolean) =>
    api.get<Category[]>('/api/bank/categories', { params: { type, include_subcategories: includeSubcategories } }),
  createCategory: (data: { name: string; type: string; color?: string; icon?: string; parent_id?: number }) =>
    api.post<Category>('/api/bank/categories', data),
  updateCategory: (id: number, data: { name?: string; color?: string; icon?: string; parent_id?: number | null }) =>
    api.put<Category>(`/api/bank/categories/${id}`, { ...data, parent_id: data.parent_id === null ? 0 : data.parent_id }),
  deleteCategory: (id: number) =>
    api.delete(`/api/bank/categories/${id}`),

  // Règles de catégorisation
  getRules: () =>
    api.get<CategoryRule[]>('/api/bank/rules'),
  createRule: (data: {
    pattern?: string;
    match_type?: string;
    source_type?: 'revenue' | 'expense';
    category_id: number;
    transaction_type?: string;
    priority?: number;
  }) => api.post<CategoryRule>('/api/bank/rules', data),
  updateRule: (id: number, data: {
    pattern?: string;
    match_type?: string;
    source_type?: 'revenue' | 'expense';
    category_id: number;
    transaction_type?: string;
    priority?: number;
  }) => api.put<CategoryRule>(`/api/bank/rules/${id}`, data),
  deleteRule: (id: number) =>
    api.delete(`/api/bank/rules/${id}`),

  // Import
  previewImport: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ImportPreviewResponse>('/api/bank/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  confirmImport: (
    transactions: ImportPreviewTransaction[],
    filename: string,
    fileType: string,
    accountType: AccountType = 'company'
  ) => api.post<BankImport>(
    `/api/bank/import/confirm?filename=${encodeURIComponent(filename)}&file_type=${fileType}&account_type=${accountType}`,
    { transactions }
  ),
  getImportHistory: (limit?: number) =>
    api.get<BankImport[]>('/api/bank/imports', { params: { limit } }),
};

// ============== Budget Categories (Pourcentages) ==============

export interface CategoryInfo {
  id: number;
  name: string;
  type: string;
  color: string;
  parent_id?: number;
}

export interface BudgetCategory {
  id: number;
  category_id: number | null;  // Null pour les budgets d'épargne globaux
  category: CategoryInfo | null;  // Null pour les budgets d'épargne globaux
  percentage: number;
  is_savings: boolean;     // True si c'est un budget d'épargne
  allocated_amount: number;  // Budget du mois (basé sur revenus)
  carried_over: number;      // Report des mois précédents
  total_available: number;   // allocated_amount + carried_over
  spent_amount: number;
  remaining_amount: number;  // total_available - spent_amount
  spent_percentage: number;
  period_month: number;
  period_year: number;
}

export interface SavingsSummary {
  percentage: number;          // Pourcentage alloué à l'épargne
  current_month_amount: number; // Montant épargne ce mois
  total_accumulated: number;   // Total cumulé depuis le début
  category_name: string;
  category_color: string;
}

export interface BudgetSummary {
  month: number;
  year: number;
  total_revenue: number;
  total_allocated: number;
  total_spent: number;
  total_remaining: number;
  categories: BudgetCategory[];
}

export const budgetCategoriesAPI = {
  // Récupérer les budgets par catégorie (calculs basés sur le mois demandé)
  getAll: (month?: number, year?: number) =>
    api.get<BudgetCategory[]>('/api/budget-categories', { params: { month, year } }),

  // Récupérer le résumé avec totaux
  getSummary: (month?: number, year?: number) =>
    api.get<BudgetSummary>('/api/budget-categories/summary', { params: { month, year } }),

  // Récupérer le résumé de l'épargne cumulée
  getSavingsSummary: () =>
    api.get<SavingsSummary>('/api/budget-categories/savings/summary'),

  // Créer un budget permanent pour une catégorie
  // category_id est optionnel pour les budgets d'épargne (is_savings=true)
  create: (data: { category_id?: number; percentage: number; is_savings?: boolean }) =>
    api.post<BudgetCategory>('/api/budget-categories', data),

  // Mettre à jour un budget existant
  update: (budgetId: number, data: { percentage?: number; is_savings?: boolean }) =>
    api.put<BudgetCategory>(`/api/budget-categories/${budgetId}`, data),

  // Supprimer un budget catégorie
  delete: (budgetId: number) =>
    api.delete(`/api/budget-categories/${budgetId}`),
};

// ============== Clients (CRM) ==============

export type ClientType = 'personal' | 'professional';

export interface ClientAttachment {
  id: number;
  filename: string;
  file_type?: string;
  file_size?: number;
  description?: string;
  uploaded_at: string;
}

export interface Client {
  id: number;
  client_type: ClientType;
  name: string;  // Nom (perso) ou Nom du contact (pro)
  first_name?: string;  // Prénom
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  // Champs professionnels
  company_name?: string;
  vat_number?: string;
  siret?: string;
  contact_position?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  attachments: ClientAttachment[];
}

export interface ClientCreate {
  client_type: ClientType;
  name: string;
  first_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  company_name?: string;
  vat_number?: string;
  siret?: string;
  contact_position?: string;
  notes?: string;
}

export interface ImportCSVResponse {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface DuplicateClientError {
  message: string;
  existing_client_id: number;
  existing_client_name: string;
}

export const clientsAPI = {
  getAll: (search?: string, clientType?: ClientType) =>
    api.get<Client[]>('/api/clients', { params: { search, client_type: clientType } }),
  getOne: (id: number) =>
    api.get<Client>(`/api/clients/${id}`),
  create: (data: ClientCreate, force: boolean = false) =>
    api.post<Client>('/api/clients', data, { params: { force } }),
  update: (id: number, data: Partial<ClientCreate>) =>
    api.put<Client>(`/api/clients/${id}`, data),
  delete: (id: number) =>
    api.delete(`/api/clients/${id}`),
  importCSV: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ImportCSVResponse>('/api/clients/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  // Pièces jointes
  getAttachments: (clientId: number) =>
    api.get<ClientAttachment[]>(`/api/clients/${clientId}/attachments`),
  uploadAttachment: (clientId: number, file: File, description?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }
    return api.post<ClientAttachment>(`/api/clients/${clientId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  downloadAttachment: (clientId: number, attachmentId: number) =>
    api.get(`/api/clients/${clientId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    }),
  deleteAttachment: (clientId: number, attachmentId: number) =>
    api.delete(`/api/clients/${clientId}/attachments/${attachmentId}`),
};

// ============== Factures (Invoices) ==============

export interface LineItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate?: number;  // Taux de TVA par ligne
  amount?: number;
  vat_amount?: number;  // Montant TVA calculé
  amount_with_vat?: number;  // Montant TTC
  position: number;
}

export interface InvoicePayment {
  id: number;
  invoice_id: number;
  transaction_id?: number;
  amount: number;
  payment_date: string;
  payment_method?: string;
  notes?: string;
  created_at: string;
}

export interface Invoice {
  id: number;
  company_id: number;
  invoice_number: string;
  client_id?: number;
  client_name?: string;
  client_email?: string;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
  description?: string;
  notes?: string;
  payment_terms?: string;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  quote_id?: number;
  created_at: string;
  updated_at: string;
  line_items: LineItem[];
  payments: InvoicePayment[];
}

export interface InvoiceListItem {
  id: number;
  company_id: number;
  invoice_number: string;
  client_id?: number;
  client_name?: string;
  issue_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  created_at: string;
}

export interface InvoiceCreate {
  client_id?: number;
  issue_date: string;
  due_date: string;
  description?: string;
  notes?: string;
  payment_terms?: string;
  tax_rate?: number;
  line_items: Omit<LineItem, 'id' | 'amount'>[];
}

export interface InvoiceUpdate {
  client_id?: number;
  issue_date?: string;
  due_date?: string;
  status?: string;
  description?: string;
  notes?: string;
  payment_terms?: string;
  tax_rate?: number;
}

export interface PaymentCreate {
  amount: number;
  payment_date: string;
  payment_method?: string;
  notes?: string;
  transaction_id?: number;
}

export const invoicesAPI = {
  getAll: (params?: { status?: string; client_id?: number; start_date?: string; end_date?: string }) =>
    api.get<InvoiceListItem[]>('/api/invoices', { params }),
  getOne: (id: number) =>
    api.get<Invoice>(`/api/invoices/${id}`),
  create: (data: InvoiceCreate) =>
    api.post<Invoice>('/api/invoices', data),
  update: (id: number, data: InvoiceUpdate) =>
    api.put<Invoice>(`/api/invoices/${id}`, data),
  delete: (id: number) =>
    api.delete(`/api/invoices/${id}`),

  // Line items
  addLineItem: (invoiceId: number, item: Omit<LineItem, 'id' | 'amount'>) =>
    api.post<LineItem>(`/api/invoices/${invoiceId}/items`, item),
  deleteLineItem: (invoiceId: number, itemId: number) =>
    api.delete(`/api/invoices/${invoiceId}/items/${itemId}`),

  // Payments
  addPayment: (invoiceId: number, data: PaymentCreate) =>
    api.post<InvoicePayment>(`/api/invoices/${invoiceId}/payments`, data),
  deletePayment: (invoiceId: number, paymentId: number) =>
    api.delete(`/api/invoices/${invoiceId}/payments/${paymentId}`),
  linkTransaction: (invoiceId: number, transactionId: number) =>
    api.post<InvoicePayment>(`/api/invoices/${invoiceId}/link-transaction/${transactionId}`),

  // Unpaid invoices
  getUnpaid: () =>
    api.get<InvoiceListItem[]>('/api/invoices/unpaid/list'),

  // PDF
  downloadPdf: (id: number) =>
    api.get(`/api/invoices/${id}/pdf`, { responseType: 'blob' }),

  // Email
  sendEmail: (id: number, data: { to_email: string; subject?: string; message?: string }) =>
    api.post(`/api/invoices/${id}/send-email`, data),
};

// ============== Devis (Quotes) ==============

export interface Quote {
  id: number;
  company_id: number;
  quote_number: string;
  client_id?: number;
  client_name?: string;
  issue_date: string;
  valid_until: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  description?: string;
  notes?: string;
  terms?: string;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
  line_items: LineItem[];
}

export interface QuoteListItem {
  id: number;
  company_id: number;
  quote_number: string;
  client_id?: number;
  client_name?: string;
  issue_date: string;
  valid_until: string;
  status: string;
  total_amount: number;
  created_at: string;
}

export interface QuoteCreate {
  client_id?: number;
  issue_date: string;
  valid_until: string;
  description?: string;
  notes?: string;
  terms?: string;
  tax_rate?: number;
  line_items: Omit<LineItem, 'id' | 'amount'>[];
}

export interface QuoteUpdate {
  client_id?: number;
  issue_date?: string;
  valid_until?: string;
  status?: string;
  description?: string;
  notes?: string;
  terms?: string;
  tax_rate?: number;
}

export interface SendQuoteEmailRequest {
  to_email: string;
  subject?: string;
  message?: string;
}

export const quotesAPI = {
  getAll: (params?: { status?: string; client_id?: number; start_date?: string; end_date?: string }) =>
    api.get<QuoteListItem[]>('/api/quotes', { params }),
  getOne: (id: number) =>
    api.get<Quote>(`/api/quotes/${id}`),
  create: (data: QuoteCreate) =>
    api.post<Quote>('/api/quotes', data),
  update: (id: number, data: QuoteUpdate) =>
    api.put<Quote>(`/api/quotes/${id}`, data),
  delete: (id: number) =>
    api.delete(`/api/quotes/${id}`),

  // Line items
  addLineItem: (quoteId: number, item: Omit<LineItem, 'id' | 'amount'>) =>
    api.post<LineItem>(`/api/quotes/${quoteId}/items`, item),
  deleteLineItem: (quoteId: number, itemId: number) =>
    api.delete(`/api/quotes/${quoteId}/items/${itemId}`),

  // Convert to invoice
  convertToInvoice: (quoteId: number, data: { due_date: string; payment_terms?: string }) =>
    api.post<Invoice>(`/api/quotes/${quoteId}/convert-to-invoice`, data),

  // PDF download
  downloadPdf: (quoteId: number) =>
    api.get(`/api/quotes/${quoteId}/pdf`, { responseType: 'blob' }),

  // Send by email
  sendEmail: (quoteId: number, data: SendQuoteEmailRequest) =>
    api.post(`/api/quotes/${quoteId}/send-email`, data),
};


// ============ VAT Rates ============

export interface VatRate {
  id: number;
  name: string;
  rate: number;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface VatRateCreate {
  name: string;
  rate: number;
  description?: string;
  is_default?: boolean;
  position?: number;
}

export interface VatRateUpdate {
  name?: string;
  rate?: number;
  description?: string;
  is_default?: boolean;
  is_active?: boolean;
  position?: number;
}

export const vatRatesAPI = {
  getAll: (includeInactive?: boolean) =>
    api.get<VatRate[]>('/api/vat-rates', { params: { include_inactive: includeInactive } }),
  create: (data: VatRateCreate) =>
    api.post<VatRate>('/api/vat-rates', data),
  update: (id: number, data: VatRateUpdate) =>
    api.put<VatRate>(`/api/vat-rates/${id}`, data),
  delete: (id: number) =>
    api.delete(`/api/vat-rates/${id}`),
  seedDefaults: (country: string) =>
    api.post<VatRate[]>('/api/vat-rates/seed-defaults', null, { params: { country } }),
};


// ============ Savings Categories (Catégories d'épargne) ============

export interface SavingsCategory {
  id: number;
  name: string;
  description?: string;
  color: string;
  percentage: number;
  is_default: boolean;
  // Montants théoriques (basés sur revenus × pourcentage)
  allocated_amount: number;
  current_month_allocated: number;
  // Montants réels (transactions assignées)
  spent_amount: number;
  current_month_spent: number;
  // Solde restant
  remaining_amount: number;
  // Anciens champs pour compatibilité
  accumulated_amount: number;
  current_month_amount: number;
}

export interface SavingsCategorySummary {
  total_savings_percentage: number;
  // Nouveaux champs
  total_allocated: number;
  total_spent: number;
  total_remaining: number;
  current_month_allocated: number;
  current_month_spent: number;
  // Anciens champs pour compatibilité
  total_accumulated: number;
  current_month_savings: number;
  categories: SavingsCategory[];
}

export interface SavingsCategoryCreate {
  name: string;
  description?: string;
  color?: string;
  percentage?: number;
}

export interface SavingsCategoryUpdate {
  name?: string;
  description?: string;
  color?: string;
  percentage?: number;
}

export const savingsCategoriesAPI = {
  // Récupérer toutes les catégories d'épargne (optionnellement pour un mois spécifique)
  getAll: (month?: number, year?: number) => {
    const params = new URLSearchParams();
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    const queryString = params.toString();
    return api.get<SavingsCategory[]>(`/api/savings-categories${queryString ? `?${queryString}` : ''}`);
  },

  // Récupérer le résumé avec totaux (optionnellement pour un mois spécifique)
  getSummary: (month?: number, year?: number) => {
    const params = new URLSearchParams();
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    const queryString = params.toString();
    return api.get<SavingsCategorySummary>(`/api/savings-categories/summary${queryString ? `?${queryString}` : ''}`);
  },

  // Créer les catégories par défaut
  seedDefaults: () =>
    api.post<SavingsCategory[]>('/api/savings-categories/seed-defaults'),

  // Créer une nouvelle catégorie
  create: (data: SavingsCategoryCreate) =>
    api.post<SavingsCategory>('/api/savings-categories', data),

  // Mettre à jour une catégorie
  update: (id: number, data: SavingsCategoryUpdate) =>
    api.put<SavingsCategory>(`/api/savings-categories/${id}`, data),

  // Supprimer une catégorie
  delete: (id: number) =>
    api.delete(`/api/savings-categories/${id}`),
};

// === TIME TRACKING (Suivi du temps par catégorie) ===

// Catégories de temps (Travail, Formation, Repos, etc.)
export interface TimeCategory {
  id: number;
  company_id: number;
  parent_id?: number | null;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  position: number;
  is_active: boolean;
  // Budget temps
  weekly_minutes_target: number;  // Objectif hebdomadaire en minutes
  total_minutes?: number;  // Minutes consommées
  target_minutes?: number;  // Objectif pour la période
  remaining_minutes?: number;  // Minutes restantes
  percentage?: number;
  children?: TimeCategory[];
}

export interface TimeCategoryCreate {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parent_id?: number | null;  // Pour créer une sous-catégorie
  percentage?: number;  // Pourcentage du budget hebdomadaire global
}

export interface TimeCategoryUpdate {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  position?: number;
  parent_id?: number | null;
  percentage?: number;  // Pourcentage du budget hebdomadaire global
}

// Paramètres du budget temps
export interface TimeBudgetSettings {
  weekly_budget_hours: number;
  weekly_budget_minutes: number;
}

export interface TimeBudgetSettingsUpdate {
  weekly_budget_hours?: number;
}

// Entrées de temps
export interface TimeEntry {
  id: number;
  company_id: number;
  category_id: number;
  category: {
    id: number;
    name: string;
    color: string;
    icon?: string;
  };
  date: string;
  duration_minutes: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface TimeEntryCreate {
  category_id: number;
  date: string;
  duration_minutes: number;
  description?: string;
}

export interface TimeEntryUpdate {
  category_id?: number;
  date?: string;
  duration_minutes?: number;
  description?: string;
}

export interface TimeSummaryByCategory {
  category_id: number;
  category_name: string;
  color: string;
  icon?: string;
  percentage: number;  // % du budget hebdomadaire global
  total_minutes: number;
  target_minutes: number;
  remaining_minutes: number;
}

export interface TimeSummary {
  total_minutes: number;
  total_hours: number;
  total_target_minutes: number;
  total_remaining_minutes: number;
  weekly_budget_minutes: number;  // Budget hebdomadaire global
  by_category: TimeSummaryByCategory[];
  period_month: number;
  period_year: number;
}

// Paramètres du budget temps
export const timeBudgetSettingsAPI = {
  // Récupérer les paramètres
  get: () => api.get<TimeBudgetSettings>('/api/time-entries/settings'),

  // Mettre à jour les paramètres
  update: (data: TimeBudgetSettingsUpdate) =>
    api.put<TimeBudgetSettings>('/api/time-entries/settings', data),
};

export const timeCategoriesAPI = {
  // Récupérer toutes les catégories (hiérarchiques par défaut, flat=true pour liste plate)
  getAll: (month?: number, year?: number, flat?: boolean) => {
    const params = new URLSearchParams();
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    if (flat) params.append('flat', 'true');
    const queryString = params.toString();
    return api.get<TimeCategory[]>(`/api/time-entries/categories${queryString ? `?${queryString}` : ''}`);
  },

  // Créer les catégories par défaut
  seedDefaults: () =>
    api.post<TimeCategory[]>('/api/time-entries/categories/seed-defaults'),

  // Créer une catégorie
  create: (data: TimeCategoryCreate) =>
    api.post<TimeCategory>('/api/time-entries/categories', data),

  // Mettre à jour une catégorie
  update: (id: number, data: TimeCategoryUpdate) =>
    api.put<TimeCategory>(`/api/time-entries/categories/${id}`, data),

  // Supprimer une catégorie
  delete: (id: number) =>
    api.delete(`/api/time-entries/categories/${id}`),
};

export const timeEntriesAPI = {
  // Récupérer toutes les entrées de temps
  getAll: (params?: {
    month?: number;
    year?: number;
    category_id?: number;
    start_date?: string;
    end_date?: string;
    skip?: number;
    limit?: number;
  }) => {
    const urlParams = new URLSearchParams();
    if (params?.month) urlParams.append('month', params.month.toString());
    if (params?.year) urlParams.append('year', params.year.toString());
    if (params?.category_id) urlParams.append('category_id', params.category_id.toString());
    if (params?.start_date) urlParams.append('start_date', params.start_date);
    if (params?.end_date) urlParams.append('end_date', params.end_date);
    if (params?.skip) urlParams.append('skip', params.skip.toString());
    if (params?.limit) urlParams.append('limit', params.limit.toString());
    const queryString = urlParams.toString();
    return api.get<TimeEntry[]>(`/api/time-entries${queryString ? `?${queryString}` : ''}`);
  },

  // Récupérer le résumé par catégorie pour un mois
  getSummary: (month: number, year: number) =>
    api.get<TimeSummary>(`/api/time-entries/summary?month=${month}&year=${year}`),

  // Récupérer une entrée par ID
  getOne: (id: number) =>
    api.get<TimeEntry>(`/api/time-entries/${id}`),

  // Créer une entrée de temps
  create: (data: TimeEntryCreate) =>
    api.post<TimeEntry>('/api/time-entries', data),

  // Mettre à jour une entrée
  update: (id: number, data: TimeEntryUpdate) =>
    api.put<TimeEntry>(`/api/time-entries/${id}`, data),

  // Supprimer une entrée
  delete: (id: number) =>
    api.delete(`/api/time-entries/${id}`),
};


// ============== PAIEMENT & ABONNEMENT (Payzen) ==============

export type PaymentType = 'setup_fee' | 'subscription' | 'combined';
export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'cancelled';
export type SubscriptionStatus = 'trial' | 'active' | 'grace_period' | 'suspended' | 'cancelled' | 'expired';
export type BillingCycle = 'monthly' | 'yearly';

export interface PricingInfo {
  setup_fee: number;
  monthly_subscription: number;
  yearly_subscription: number;
  yearly_savings: number;
  currency: string;
}

export interface CreatePaymentRequest {
  payment_type: PaymentType;
  billing_cycle?: BillingCycle;
}

export interface CreatePaymentResponse {
  payment_url: string;
  transaction_id: number;
  amount: number;
  order_id: string;
}

export interface SubscriptionStatusResponse {
  subscription_status: SubscriptionStatus;
  subscription_plan: string;
  billing_cycle?: BillingCycle;
  setup_fee_paid: boolean;
  subscription_start?: string;
  subscription_end?: string;
  next_payment_at?: string;
  grace_period_end?: string;
  is_in_grace_period: boolean;
  days_until_suspension?: number;
}

export interface PaymentHistoryItem {
  id: number;
  payment_type: PaymentType;
  amount: number;
  currency: string;
  status: PaymentStatus;
  billing_cycle?: BillingCycle;
  period_start?: string;
  period_end?: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export const paymentAPI = {
  // Obtenir la tarification
  getPricing: () =>
    api.get<PricingInfo>('/api/payment/pricing'),

  // Créer un paiement (obtenir formToken)
  createPayment: (data: CreatePaymentRequest) =>
    api.post<CreatePaymentResponse>('/api/payment/create-payment', data),

  // Confirmer le retour navigateur
  confirmSuccess: (krAnswer: string, krHash?: string) =>
    api.post('/api/payment/success', { kr_answer: krAnswer, kr_hash: krHash }),

  // Obtenir le statut de l'abonnement
  getStatus: () =>
    api.get<SubscriptionStatusResponse>('/api/payment/status'),

  // Obtenir l'historique des paiements
  getHistory: (limit?: number) =>
    api.get<PaymentHistoryItem[]>('/api/payment/history', { params: { limit } }),
};
