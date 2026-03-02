'use client';

import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  LinearProgress,
  IconButton,
  Alert,
  Tabs,
  Tab,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  Checkbox,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Pagination,
} from '@mui/material';
import {
  Add as AddIcon,
  TrendingUp,
  TrendingDown,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle,
  Warning,
  AutoAwesome,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  BugReport as BugReportIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ChevronLeft,
  ChevronRight,
  Balance as BalanceIcon,
  Savings as SavingsIcon,
} from '@mui/icons-material';
import { transactionsAPI, bankAPI, invoicesAPI, budgetCategoriesAPI, savingsCategoriesAPI, Category, CategoryRule, ImportPreviewTransaction, InvoiceListItem, AccountType, AssociateSummary, BudgetCategory, SavingsCategory } from '@/lib/api';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { useAuthStore } from '@/store/authStore';
import { useCompanyStore } from '@/store/companyStore';
import { format } from 'date-fns';
import { formatCurrency, formatTransactionAmount, getCurrencySymbol } from '@/lib/currency';
import { HexColorPicker } from 'react-colorful';

interface Transaction {
  id: number;
  type: 'revenue' | 'expense';
  amount: number;
  description: string;
  transaction_date: string;
  category?: Category;
  category_id?: number;
  auto_imported?: boolean;
  account_type?: AccountType;
  savings_category_id?: number | null;
}

interface Stats {
  total_revenue: number;
  total_expenses: number;
  net_balance: number;
  transaction_count: number;
}

export default function ComptabilitePage() {
  const { user } = useAuthStore();
  const { currentCompany, fetchCurrentCompany } = useCompanyStore();
  const currency = currentCompany?.currency || 'EUR';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Type de compte actif (entreprise ou associé)
  const [activeAccountType, setActiveAccountType] = useState<AccountType>('company');
  const [associateSummary, setAssociateSummary] = useState<AssociateSummary | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const transactionsPerPage = 20;

  // Filtres
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'revenue' | 'expense'>('all');
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);

  // Dialogs
  const [openTransactionDialog, setOpenTransactionDialog] = useState(false);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [openSettingsDialog, setOpenSettingsDialog] = useState(false);
  const [openCategoryDialog, setOpenCategoryDialog] = useState(false);
  const [openRuleDialog, setOpenRuleDialog] = useState(false);
  const [openInvoiceLinkDialog, setOpenInvoiceLinkDialog] = useState(false);

  // Invoice linking
  const [unpaidInvoices, setUnpaidInvoices] = useState<InvoiceListItem[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [linkingInvoice, setLinkingInvoice] = useState(false);

  // Settings tab
  const [settingsTab, setSettingsTab] = useState(0);

  // Form states
  const [newTransaction, setNewTransaction] = useState({
    type: 'expense' as 'revenue' | 'expense',
    amount: 0,
    description: '',
    category_id: 0,
    savings_category_id: null as number | null,
  });

  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'expense' as 'revenue' | 'expense',
    color: '#6B7280',
  });

  const [newRule, setNewRule] = useState({
    pattern: '',
    match_type: 'contains',
    source_type: '' as '' | 'revenue' | 'expense',  // Filtre par type de transaction
    category_id: 0,
    transaction_type: '' as '' | 'revenue' | 'expense',
    priority: 0,
  });

  const [editingRule, setEditingRule] = useState<CategoryRule | null>(null);

  // Édition de transaction (changement de catégorie)
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  // Édition directe de la catégorie d'épargne
  const [editingSavingsForTransactionId, setEditingSavingsForTransactionId] = useState<number | null>(null);

  // Quick category creation from import preview
  const [quickCategoryType, setQuickCategoryType] = useState<'revenue' | 'expense'>('expense');
  const [quickCategoryForIndex, setQuickCategoryForIndex] = useState<number | null>(null);

  // Savings categories state
  const [savingsCategories, setSavingsCategories] = useState<SavingsCategory[]>([]);
  const [savingsCategoryId, setSavingsCategoryId] = useState<number | null>(null);
  const [savingsBudgetCategory, setSavingsBudgetCategory] = useState<BudgetCategory | null>(null);
  const [openSavingsCategoryDialog, setOpenSavingsCategoryDialog] = useState(false);
  const [pendingSavingsSelection, setPendingSavingsSelection] = useState<{
    transactionIndex?: number;  // Pour l'import preview
    transactionId?: number;     // Pour les transactions existantes
    isNewTransaction?: boolean; // Pour la création de nouvelle transaction
    categoryId: number;
  } | null>(null);

  // Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewTransaction[] | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDebugInfo, setImportDebugInfo] = useState<{
    total_lines?: number;
    skipped_lines?: number;
    skipped_reasons?: Record<string, number>;
    format_detected?: Record<string, any>;
    sample_skipped?: Array<Record<string, any>>;
  } | null>(null);

  const fetchData = async (page: number = 1) => {
    try {
      // Construire les paramètres de filtre
      const params: {
        page: number;
        limit: number;
        type?: string;
        category_id?: number;
        start_date?: string;
        end_date?: string;
        account_type?: AccountType;
      } = { page, limit: transactionsPerPage, account_type: activeAccountType };

      if (filterType !== 'all') {
        params.type = filterType;
      }
      if (filterCategoryId) {
        params.category_id = filterCategoryId;
      }
      if (filterMonth !== null && filterYear !== null) {
        // Premier jour du mois
        const startDate = new Date(filterYear, filterMonth - 1, 1);
        // Dernier jour du mois
        const endDate = new Date(filterYear, filterMonth, 0, 23, 59, 59);
        params.start_date = startDate.toISOString();
        params.end_date = endDate.toISOString();
      }

      const statsParams = filterMonth !== null && filterYear !== null
        ? { start_date: params.start_date, end_date: params.end_date, account_type: activeAccountType }
        : { account_type: activeAccountType };

      const [transactionsRes, statsRes] = await Promise.all([
        transactionsAPI.getAll(params),
        transactionsAPI.getStats(statsParams),
      ]);
      setTransactions(transactionsRes.data.items);
      setTotalPages(transactionsRes.data.pages);
      setTotalTransactions(transactionsRes.data.total);
      setCurrentPage(transactionsRes.data.page);
      setStats(statsRes.data);

      // Pour le compte associé, récupérer le résumé des remboursements
      if (activeAccountType === 'associate') {
        const summaryParams = filterMonth !== null && filterYear !== null
          ? { start_date: params.start_date, end_date: params.end_date }
          : undefined;
        const summaryRes = await transactionsAPI.getAssociateSummary(summaryParams);
        setAssociateSummary(summaryRes.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
    fetchData(page);
  };

  const fetchCategories = async () => {
    try {
      const res = await bankAPI.getCategories();
      setCategories(res.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await bankAPI.getRules();
      setRules(res.data);
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  };

  const fetchUnpaidInvoices = async () => {
    try {
      const res = await invoicesAPI.getUnpaid();
      setUnpaidInvoices(res.data);
    } catch (error) {
      console.error('Error fetching unpaid invoices:', error);
    }
  };

  // Ouvrir le dialogue pour lier une transaction à une facture
  const handleOpenInvoiceLinkDialog = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    fetchUnpaidInvoices();
    setOpenInvoiceLinkDialog(true);
  };

  // Lier une transaction à une facture
  const handleLinkTransactionToInvoice = async (invoiceId: number) => {
    if (!selectedTransaction) return;

    setLinkingInvoice(true);
    try {
      await invoicesAPI.linkTransaction(invoiceId, selectedTransaction.id);
      setOpenInvoiceLinkDialog(false);
      setSelectedTransaction(null);
      fetchData(currentPage);
      alert('Transaction liée à la facture avec succès !');
    } catch (error: any) {
      console.error('Error linking transaction:', error);
      alert(error.response?.data?.detail || 'Erreur lors de la liaison');
    } finally {
      setLinkingInvoice(false);
    }
  };

  useEffect(() => {
    fetchCurrentCompany();
    fetchCategories();
    fetchRules();
    fetchSavingsData();
  }, []);

  // Charger les catégories d'épargne et identifier le budget d'épargne
  const fetchSavingsData = async () => {
    try {
      // Récupérer les catégories d'épargne
      const savingsCatsRes = await savingsCategoriesAPI.getAll();
      setSavingsCategories(savingsCatsRes.data);

      // Récupérer les budgets pour trouver celui marqué comme épargne
      const budgetsRes = await budgetCategoriesAPI.getAll();
      const savingsBudget = budgetsRes.data.find((b: BudgetCategory) => b.is_savings);
      setSavingsBudgetCategory(savingsBudget || null);
    } catch (error) {
      console.error('Error fetching savings data:', error);
    }
  };

  // Vérifier si une catégorie est la catégorie d'épargne
  const isSavingsCategory = (categoryId: number) => {
    return savingsBudgetCategory?.category_id === categoryId;
  };

  // Gérer la sélection d'une catégorie (avec vérification épargne)
  const handleCategorySelection = (categoryId: number, transactionIndex?: number, transactionId?: number) => {
    if (isSavingsCategory(categoryId) && savingsCategories.length > 0) {
      // C'est une catégorie d'épargne, ouvrir le dialog de sélection
      setPendingSavingsSelection({
        transactionIndex,
        transactionId,
        categoryId,
      });
      setOpenSavingsCategoryDialog(true);
    } else {
      // Pas d'épargne, appliquer directement
      if (transactionIndex !== undefined && importPreview) {
        // Import preview
        const updatedPreview = [...importPreview];
        updatedPreview[transactionIndex].category_id = categoryId;
        updatedPreview[transactionIndex].savings_category_id = undefined;
        setImportPreview(updatedPreview);
      } else if (transactionId !== undefined) {
        // Transaction existante
        handleUpdateTransactionCategory(transactionId, categoryId);
      }
    }
  };

  // Confirmer la sélection de catégorie d'épargne
  const handleConfirmSavingsCategory = () => {
    if (!pendingSavingsSelection || !savingsCategoryId) return;

    if (pendingSavingsSelection.transactionIndex !== undefined && importPreview) {
      // Import preview
      const updatedPreview = [...importPreview];
      updatedPreview[pendingSavingsSelection.transactionIndex].category_id = pendingSavingsSelection.categoryId;
      updatedPreview[pendingSavingsSelection.transactionIndex].savings_category_id = savingsCategoryId;
      setImportPreview(updatedPreview);
    } else if (pendingSavingsSelection.isNewTransaction) {
      // Nouvelle transaction - mettre à jour le formulaire
      setNewTransaction(prev => ({
        ...prev,
        category_id: pendingSavingsSelection.categoryId,
        savings_category_id: savingsCategoryId,
      }));
    } else if (pendingSavingsSelection.transactionId !== undefined) {
      // Transaction existante - mettre à jour avec la catégorie d'épargne
      handleCategoryChangeWithSavings(
        pendingSavingsSelection.transactionId,
        pendingSavingsSelection.categoryId,
        savingsCategoryId
      );
    }

    setOpenSavingsCategoryDialog(false);
    setSavingsCategoryId(null);
    setPendingSavingsSelection(null);
  };

  // Mettre à jour une transaction avec catégorie et sous-catégorie d'épargne
  const handleCategoryChangeWithSavings = async (transactionId: number, categoryId: number, savingsCatId: number) => {
    try {
      await transactionsAPI.update(transactionId, {
        category_id: categoryId,
        savings_category_id: savingsCatId,
      });
      setTransactions(prev =>
        prev.map(t =>
          t.id === transactionId ? { ...t, category_id: categoryId } : t
        )
      );
    } catch (error) {
      console.error('Error updating transaction category:', error);
    }
  };

  // Mettre à jour directement la catégorie d'épargne d'une transaction
  const handleDirectSavingsCategoryUpdate = async (transactionId: number, savingsCatId: number | null) => {
    try {
      await transactionsAPI.update(transactionId, {
        savings_category_id: savingsCatId || undefined,
      });
      setTransactions(prev =>
        prev.map(t =>
          t.id === transactionId ? { ...t, savings_category_id: savingsCatId } : t
        )
      );
      setEditingSavingsForTransactionId(null);
    } catch (error) {
      console.error('Error updating savings category:', error);
    }
  };

  // Refetch quand les filtres ou le type de compte changent
  useEffect(() => {
    setCurrentPage(1);
    fetchData(1);
  }, [filterMonth, filterYear, filterType, filterCategoryId, activeAccountType]);

  const handleCreateTransaction = async () => {
    if (!user || !newTransaction.category_id) return;

    try {
      await transactionsAPI.create({
        type: newTransaction.type,
        amount: newTransaction.amount,
        description: newTransaction.description,
        category_id: newTransaction.category_id,
        savings_category_id: newTransaction.savings_category_id || undefined,
        company_id: user.company_id,
        account_type: activeAccountType,
      });
      setOpenTransactionDialog(false);
      setNewTransaction({ type: 'expense', amount: 0, description: '', category_id: 0, savings_category_id: null });
      fetchData();
    } catch (error) {
      console.error('Error creating transaction:', error);
    }
  };

  const handleCreateCategory = async () => {
    try {
      const response = await bankAPI.createCategory(newCategory);
      setOpenCategoryDialog(false);

      // Si on créait depuis l'import, assigner automatiquement la nouvelle catégorie
      if (quickCategoryForIndex !== null && importPreview) {
        const newCat = response.data;
        handleUpdatePreviewCategory(quickCategoryForIndex, newCat.id);
        setQuickCategoryForIndex(null);
      }

      setNewCategory({ name: '', type: 'expense', color: '#6B7280' });
      fetchCategories();
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  // Ouvrir le dialog de création de catégorie depuis l'import
  const handleQuickCreateCategory = (transactionIndex: number, type: 'revenue' | 'expense') => {
    setQuickCategoryType(type);
    setQuickCategoryForIndex(transactionIndex);
    setNewCategory({ name: '', type, color: type === 'revenue' ? '#10B981' : '#EF4444' });
    setOpenCategoryDialog(true);
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await bankAPI.deleteCategory(id);
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const handleCreateRule = async () => {
    try {
      const ruleData = {
        pattern: newRule.pattern || undefined,
        match_type: newRule.match_type,
        source_type: newRule.source_type || undefined,
        category_id: newRule.category_id,
        transaction_type: newRule.transaction_type || undefined,
        priority: newRule.priority,
      };

      console.log('Creating rule with data:', ruleData);

      if (editingRule) {
        await bankAPI.updateRule(editingRule.id, ruleData);
      } else {
        await bankAPI.createRule(ruleData);
      }

      setOpenRuleDialog(false);
      setEditingRule(null);
      setNewRule({ pattern: '', match_type: 'contains', source_type: '', category_id: 0, transaction_type: '', priority: 0 });
      fetchRules();
    } catch (error: any) {
      console.error('Error creating/updating rule:', error);
      alert(error.response?.data?.detail || 'Erreur lors de la création de la règle');
    }
  };

  const handleEditRule = (rule: CategoryRule) => {
    setEditingRule(rule);
    setNewRule({
      pattern: rule.pattern || '',
      match_type: rule.match_type,
      source_type: (rule.source_type || '') as '' | 'revenue' | 'expense',
      category_id: rule.category_id,
      transaction_type: (rule.transaction_type || '') as '' | 'revenue' | 'expense',
      priority: rule.priority,
    });
    setOpenRuleDialog(true);
  };

  const handleDeleteRule = async (id: number) => {
    try {
      await bankAPI.deleteRule(id);
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const handleUpdateTransactionCategory = async (transactionId: number, categoryId: number) => {
    try {
      await transactionsAPI.update(transactionId, { category_id: categoryId });
      setEditingTransactionId(null);
      // Mettre à jour localement la transaction
      setTransactions(prev =>
        prev.map(t =>
          t.id === transactionId ? { ...t, category_id: categoryId } : t
        )
      );
    } catch (error) {
      console.error('Error updating transaction category:', error);
    }
  };

  const handleDeleteTransaction = async (transactionId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) return;

    try {
      await transactionsAPI.delete(transactionId);
      // Retirer la transaction localement
      setTransactions(prev => prev.filter(t => t.id !== transactionId));
      // Refetch pour mettre à jour les stats
      fetchData(currentPage);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Erreur lors de la suppression de la transaction');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportError(null);
      setImportPreview(null);
    }
  };

  const handlePreviewImport = async () => {
    if (!importFile) return;

    setImportLoading(true);
    setImportError(null);
    setImportDebugInfo(null);

    try {
      const res = await bankAPI.previewImport(importFile);
      setImportPreview(res.data.transactions);

      // Stocker les infos de debug
      if (res.data.total_lines !== undefined) {
        setImportDebugInfo({
          total_lines: res.data.total_lines,
          skipped_lines: res.data.skipped_lines,
          skipped_reasons: res.data.skipped_reasons,
          format_detected: res.data.format_detected,
          sample_skipped: res.data.sample_skipped,
        });
      }
    } catch (error: any) {
      setImportError(error.response?.data?.detail || 'Erreur lors de l\'analyse du fichier');
    } finally {
      setImportLoading(false);
    }
  };

  const handleUpdatePreviewCategory = (index: number, categoryId: number) => {
    if (!importPreview) return;

    console.log('Updating category:', { index, categoryId, currentTransaction: importPreview[index] });

    // Vérifier si c'est la catégorie d'épargne
    if (isSavingsCategory(categoryId) && savingsCategories.length > 0) {
      // Ouvrir le dialog pour sélectionner la sous-catégorie d'épargne
      setPendingSavingsSelection({
        transactionIndex: index,
        categoryId,
      });
      setOpenSavingsCategoryDialog(true);
      return;
    }

    const category = categories.find(c => c.id === categoryId);
    const updated = [...importPreview];
    updated[index] = {
      ...updated[index],
      category_id: categoryId > 0 ? categoryId : undefined,
      category_name: category?.name,
      savings_category_id: undefined, // Effacer si ce n'est pas de l'épargne
    };

    console.log('Updated transaction:', updated[index]);
    setImportPreview(updated);
  };

  const handleConfirmImport = async () => {
    if (!importPreview || !importFile) return;

    // Debug: afficher l'état complet des transactions avant validation
    console.log('=== IMPORT VALIDATION DEBUG ===');
    console.log('All transactions:', importPreview.map((t, i) => ({
      index: i,
      desc: t.description.substring(0, 30),
      category_id: t.category_id,
      is_duplicate: t.is_duplicate,
      is_duplicate_type: typeof t.is_duplicate
    })));

    // Vérifier que toutes les transactions non-doublons ont une catégorie
    const nonDuplicates = importPreview.filter(t => t.is_duplicate !== true);
    const uncategorized = nonDuplicates.filter(t => !t.category_id || t.category_id <= 0);

    console.log('Non-duplicates:', nonDuplicates.length);
    console.log('Uncategorized:', uncategorized.length);
    if (uncategorized.length > 0) {
      console.log('Uncategorized transactions:', uncategorized.map(t => ({
        desc: t.description.substring(0, 30),
        category_id: t.category_id,
        is_duplicate: t.is_duplicate
      })));
    }
    console.log('=== END DEBUG ===');

    if (uncategorized.length > 0) {
      const descriptions = uncategorized.slice(0, 3).map(t => `"${t.description.substring(0, 30)}..."`).join(', ');
      setImportError(`${uncategorized.length} transaction(s) sans catégorie sur ${nonDuplicates.length} à importer: ${descriptions}`);
      return;
    }

    setImportLoading(true);

    try {
      const fileType = importFile.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'csv';
      await bankAPI.confirmImport(importPreview, importFile.name, fileType, activeAccountType);

      setOpenImportDialog(false);
      setImportFile(null);
      setImportPreview(null);
      fetchData();
    } catch (error: any) {
      setImportError(error.response?.data?.detail || 'Erreur lors de l\'import');
    } finally {
      setImportLoading(false);
    }
  };

  const getCategoryById = (id?: number) => categories.find(c => c.id === id);

  if (loading) {
    return (
      <DashboardLayout>
        <LinearProgress />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
            Banque
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez vos comptes et transactions
          </Typography>
        </div>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setOpenSettingsDialog(true)}
          >
            Catégories & Règles
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => setOpenImportDialog(true)}
            sx={{
              borderColor: '#F5C518',
              color: '#F5C518',
              '&:hover': { borderColor: '#E0B000', bgcolor: '#FEF9E7' },
            }}
          >
            Importer
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenTransactionDialog(true)}
            sx={{
              bgcolor: '#F5C518',
              color: '#1A1A1A',
              '&:hover': { bgcolor: '#E0B000' },
            }}
          >
            Nouvelle Transaction
          </Button>
        </Box>
      </Box>

      {/* Onglets Compte Entreprise / Compte Associé */}
      <Tabs
        value={activeAccountType}
        onChange={(_, value) => setActiveAccountType(value)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          value="company"
          label="Compte Entreprise"
          sx={{
            '&.Mui-selected': { color: '#F5C518' },
          }}
        />
        <Tab
          value="associate"
          label="Compte Associé"
          sx={{
            '&.Mui-selected': { color: '#F5C518' },
          }}
        />
      </Tabs>

      {/* Section Compte Associé avec explication et balance */}
      {activeAccountType === 'associate' && (
        <Box sx={{ mb: 3 }}>
          {/* Bandeau d'explication */}
          <Paper
            sx={{
              p: 2,
              mb: 2,
              borderRadius: 3,
              bgcolor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <BalanceIcon sx={{ color: '#6366F1', fontSize: 32 }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1E293B' }}>
                Compte Courant d'Associé
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Suivez les investissements et avances des associés pour l'entreprise.
                Enregistrez les dépenses effectuées par les associés et les remboursements réalisés.
              </Typography>
            </Box>
          </Paper>

          {/* Carte avec balance visuelle */}
          {associateSummary && (() => {
            // Calculer l'angle de la balance (-15° à +15°)
            const total = associateSummary.total_expenses + associateSummary.total_reimbursed;
            const ratio = total > 0
              ? (associateSummary.total_expenses - associateSummary.total_reimbursed) / total
              : 0;
            const angle = ratio * 15; // -15° à +15°

            return (
              <Paper
                sx={{
                  p: 3,
                  borderRadius: 3,
                  bgcolor: '#FEF3C7',
                  border: '1px solid #F5C518',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {/* Balance visuelle */}
                  <Box sx={{ position: 'relative', width: 180, height: 120, flexShrink: 0 }}>
                    <svg viewBox="0 0 180 120" width="180" height="120">
                      {/* Socle */}
                      <path d="M80 115 L100 115 L90 95 Z" fill="#B8860B" />
                      <rect x="88" y="45" width="4" height="50" fill="#B8860B" />

                      {/* Cercle pivot */}
                      <circle cx="90" cy="45" r="6" fill="#F5C518" stroke="#B8860B" strokeWidth="2" />

                      {/* Barre horizontale (pivotante) */}
                      <g style={{
                        transform: `rotate(${angle}deg)`,
                        transformOrigin: '90px 45px',
                        transition: 'transform 0.5s ease-out'
                      }}>
                        <rect x="20" y="43" width="140" height="4" rx="2" fill="#B8860B" />

                        {/* Chaînes gauche (Avances) */}
                        <line x1="35" y1="47" x2="35" y2="65" stroke="#B8860B" strokeWidth="1.5" />
                        <line x1="25" y1="47" x2="25" y2="60" stroke="#B8860B" strokeWidth="1.5" />
                        <line x1="45" y1="47" x2="45" y2="60" stroke="#B8860B" strokeWidth="1.5" />

                        {/* Plateau gauche (Avances - rouge) */}
                        <ellipse cx="35" cy="70" rx="28" ry="8" fill="#EF4444" />
                        <text x="35" y="74" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">
                          Avances
                        </text>

                        {/* Chaînes droite (Remboursé) */}
                        <line x1="145" y1="47" x2="145" y2="65" stroke="#B8860B" strokeWidth="1.5" />
                        <line x1="135" y1="47" x2="135" y2="60" stroke="#B8860B" strokeWidth="1.5" />
                        <line x1="155" y1="47" x2="155" y2="60" stroke="#B8860B" strokeWidth="1.5" />

                        {/* Plateau droite (Remboursé - vert) */}
                        <ellipse cx="145" cy="70" rx="28" ry="8" fill="#10B981" />
                        <text x="145" y="74" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">
                          Remboursé
                        </text>
                      </g>
                    </svg>
                  </Box>

                  {/* Informations */}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Solde à rembourser aux associés
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#B8860B', mb: 2 }}>
                      {formatCurrency(associateSummary.balance_to_reimburse, currency)}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 3 }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#EF4444' }} />
                          <Typography variant="caption" color="text.secondary">Avances</Typography>
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#EF4444' }}>
                          {formatCurrency(associateSummary.total_expenses, currency)}
                        </Typography>
                      </Box>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#10B981' }} />
                          <Typography variant="caption" color="text.secondary">Remboursé</Typography>
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#10B981' }}>
                          {formatCurrency(associateSummary.total_reimbursed, currency)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            );
          })()}
        </Box>
      )}

      {/* Statistiques - différent selon le type de compte */}
      {activeAccountType === 'company' ? (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUp sx={{ color: 'success.main' }} />
                <Typography color="text.secondary" variant="subtitle2">
                  Revenus totaux
                </Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {formatCurrency(stats?.total_revenue || 0, currency)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingDown sx={{ color: 'error.main' }} />
                <Typography color="text.secondary" variant="subtitle2">
                  Dépenses totales
                </Typography>
              </Box>
              <Typography variant="h4" color="error.main">
                {formatCurrency(stats?.total_expenses || 0, currency)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Typography color="text.secondary" variant="subtitle2" sx={{ mb: 1 }}>
                Solde net
              </Typography>
              <Typography
                variant="h4"
                color={stats && stats.net_balance >= 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrency(stats?.net_balance || 0, currency)}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingDown sx={{ color: 'error.main' }} />
                <Typography color="text.secondary" variant="subtitle2">
                  Avances des associés
                </Typography>
              </Box>
              <Typography variant="h4" color="error.main">
                {formatCurrency(associateSummary?.total_expenses || 0, currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Montant avancé par les associés
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUp sx={{ color: 'success.main' }} />
                <Typography color="text.secondary" variant="subtitle2">
                  Remboursé
                </Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {formatCurrency(associateSummary?.total_reimbursed || 0, currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Montant remboursé aux associés
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Typography color="text.secondary" variant="subtitle2" sx={{ mb: 1 }}>
                Reste à rembourser
              </Typography>
              <Typography
                variant="h4"
                color={(associateSummary?.balance_to_reimburse || 0) > 0 ? 'error.main' : 'success.main'}
              >
                {(associateSummary?.balance_to_reimburse || 0) > 0 ? '-' : '+'}
                {formatCurrency(Math.abs(associateSummary?.balance_to_reimburse || 0), currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {(associateSummary?.balance_to_reimburse || 0) > 0
                  ? 'Négatif = dette envers les associés'
                  : (associateSummary?.balance_to_reimburse || 0) < 0
                    ? 'Positif = trop remboursé'
                    : 'Équilibré'
                }
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Barre de filtres */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterIcon sx={{ color: '#6B7280' }} />
            <Typography variant="subtitle2" sx={{ color: '#6B7280', fontWeight: 600 }}>
              Filtres
            </Typography>
          </Box>

          {/* Filtre par mois */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => {
                if (filterMonth !== null && filterYear !== null) {
                  const newMonth = filterMonth === 1 ? 12 : filterMonth - 1;
                  const newYear = filterMonth === 1 ? filterYear - 1 : filterYear;
                  setFilterMonth(newMonth);
                  setFilterYear(newYear);
                }
              }}
              disabled={filterMonth === null}
              sx={{ bgcolor: '#F3F4F6' }}
            >
              <ChevronLeft fontSize="small" />
            </IconButton>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Mois</InputLabel>
              <Select
                value={filterMonth || ''}
                label="Mois"
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setFilterMonth(null);
                    setFilterYear(null);
                  } else {
                    setFilterMonth(Number(value));
                    if (filterYear === null) {
                      setFilterYear(new Date().getFullYear());
                    }
                  }
                }}
              >
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value={1}>Janvier</MenuItem>
                <MenuItem value={2}>Février</MenuItem>
                <MenuItem value={3}>Mars</MenuItem>
                <MenuItem value={4}>Avril</MenuItem>
                <MenuItem value={5}>Mai</MenuItem>
                <MenuItem value={6}>Juin</MenuItem>
                <MenuItem value={7}>Juillet</MenuItem>
                <MenuItem value={8}>Août</MenuItem>
                <MenuItem value={9}>Septembre</MenuItem>
                <MenuItem value={10}>Octobre</MenuItem>
                <MenuItem value={11}>Novembre</MenuItem>
                <MenuItem value={12}>Décembre</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Année</InputLabel>
              <Select
                value={filterYear || ''}
                label="Année"
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setFilterYear(null);
                    setFilterMonth(null);
                  } else {
                    setFilterYear(Number(value));
                    if (filterMonth === null) {
                      setFilterMonth(new Date().getMonth() + 1);
                    }
                  }
                }}
              >
                <MenuItem value="">Toutes</MenuItem>
                {[...Array(5)].map((_, i) => {
                  const year = new Date().getFullYear() - i;
                  return (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>

            <IconButton
              size="small"
              onClick={() => {
                if (filterMonth !== null && filterYear !== null) {
                  const newMonth = filterMonth === 12 ? 1 : filterMonth + 1;
                  const newYear = filterMonth === 12 ? filterYear + 1 : filterYear;
                  setFilterMonth(newMonth);
                  setFilterYear(newYear);
                }
              }}
              disabled={filterMonth === null}
              sx={{ bgcolor: '#F3F4F6' }}
            >
              <ChevronRight fontSize="small" />
            </IconButton>
          </Box>

          {/* Filtre par type */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={filterType}
              label="Type"
              onChange={(e) => setFilterType(e.target.value as 'all' | 'revenue' | 'expense')}
            >
              <MenuItem value="all">Tous</MenuItem>
              {activeAccountType === 'company' && <MenuItem value="revenue">Revenus</MenuItem>}
              <MenuItem value="expense">Dépenses</MenuItem>
              {activeAccountType === 'associate' && <MenuItem value="revenue">Remboursements</MenuItem>}
            </Select>
          </FormControl>

          {/* Filtre par catégorie */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Catégorie</InputLabel>
            <Select
              value={filterCategoryId || ''}
              label="Catégorie"
              onChange={(e) => {
                const value = e.target.value;
                setFilterCategoryId(value === '' ? null : Number(value));
              }}
            >
              <MenuItem value="">Toutes</MenuItem>
              <Divider />
              <MenuItem disabled sx={{ color: 'success.main', fontWeight: 600, fontSize: '0.8rem' }}>
                Revenus
              </MenuItem>
              {categories.filter(c => c.type === 'revenue' && !c.parent_id).flatMap(cat => [
                <MenuItem key={cat.id} value={cat.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cat.color }} />
                    <strong>{cat.name}</strong>
                  </Box>
                </MenuItem>,
                ...(cat.subcategories?.map(sub => (
                  <MenuItem key={sub.id} value={sub.id} sx={{ pl: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: sub.color }} />
                      {sub.name}
                    </Box>
                  </MenuItem>
                )) || [])
              ])}
              <Divider />
              <MenuItem disabled sx={{ color: 'error.main', fontWeight: 600, fontSize: '0.8rem' }}>
                Dépenses
              </MenuItem>
              {categories.filter(c => c.type === 'expense' && !c.parent_id).flatMap(cat => [
                <MenuItem key={cat.id} value={cat.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cat.color }} />
                    <strong>{cat.name}</strong>
                  </Box>
                </MenuItem>,
                ...(cat.subcategories?.map(sub => (
                  <MenuItem key={sub.id} value={sub.id} sx={{ pl: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: sub.color }} />
                      {sub.name}
                    </Box>
                  </MenuItem>
                )) || [])
              ])}
            </Select>
          </FormControl>

          {/* Bouton reset filtres */}
          {(filterMonth !== null || filterType !== 'all' || filterCategoryId !== null) && (
            <Button
              size="small"
              startIcon={<ClearIcon />}
              onClick={() => {
                setFilterMonth(null);
                setFilterYear(null);
                setFilterType('all');
                setFilterCategoryId(null);
              }}
              sx={{ color: '#6B7280' }}
            >
              Réinitialiser
            </Button>
          )}

          {/* Affichage des filtres actifs */}
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {filterMonth !== null && filterYear !== null && (
              <Chip
                label={`${['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][filterMonth - 1]} ${filterYear}`}
                size="small"
                onDelete={() => {
                  setFilterMonth(null);
                  setFilterYear(null);
                }}
                sx={{ bgcolor: '#F5C51820', color: '#B8860B' }}
              />
            )}
            {filterType !== 'all' && (
              <Chip
                label={
                  filterType === 'revenue'
                    ? (activeAccountType === 'associate' ? 'Remboursements' : 'Revenus')
                    : 'Dépenses'
                }
                size="small"
                onDelete={() => setFilterType('all')}
                sx={{
                  bgcolor: filterType === 'revenue' ? '#10B98120' : '#EF444420',
                  color: filterType === 'revenue' ? '#10B981' : '#EF4444',
                }}
              />
            )}
            {filterCategoryId !== null && (
              <Chip
                label={categories.find(c => c.id === filterCategoryId)?.name || 'Catégorie'}
                size="small"
                onDelete={() => setFilterCategoryId(null)}
                sx={{
                  bgcolor: (categories.find(c => c.id === filterCategoryId)?.color || '#6B7280') + '20',
                  color: categories.find(c => c.id === filterCategoryId)?.color || '#6B7280',
                }}
              />
            )}
          </Box>
        </Box>
      </Paper>

      {/* Liste des transactions */}
      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Catégorie</TableCell>
              <TableCell align="right">Montant</TableCell>
              <TableCell align="center" sx={{ width: 80 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  {format(new Date(transaction.transaction_date), 'dd/MM/yyyy')}
                </TableCell>
                <TableCell>
                  <Chip
                    icon={transaction.type === 'revenue' ? <TrendingUp /> : <TrendingDown />}
                    label={
                      transaction.type === 'revenue'
                        ? (activeAccountType === 'associate' ? 'Remboursement' : 'Revenu')
                        : 'Dépense'
                    }
                    color={transaction.type === 'revenue' ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {transaction.description}
                    {transaction.auto_imported && (
                      <Tooltip title="Importé automatiquement">
                        <AutoAwesome sx={{ fontSize: 16, color: '#F5C518' }} />
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  {editingTransactionId === transaction.id ? (
                    <Select
                      size="small"
                      value={transaction.category_id || ''}
                      onChange={(e) => {
                        const categoryId = Number(e.target.value);
                        setEditingTransactionId(null);
                        handleCategorySelection(categoryId, undefined, transaction.id);
                      }}
                      onClose={() => setEditingTransactionId(null)}
                      autoFocus
                      open
                      sx={{ minWidth: 140 }}
                    >
                      {categories
                        .filter(c => c.type === transaction.type)
                        .map(cat => (
                          <MenuItem key={cat.id} value={cat.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cat.color }} />
                              {cat.name}
                            </Box>
                          </MenuItem>
                        ))}
                    </Select>
                  ) : (
                    <Tooltip title="Cliquer pour modifier">
                      <Chip
                        label={getCategoryById(transaction.category_id)?.name || transaction.category?.name || 'Non catégorisé'}
                        size="small"
                        onClick={() => setEditingTransactionId(transaction.id)}
                        sx={{
                          bgcolor: getCategoryById(transaction.category_id)?.color || '#E5E7EB',
                          color: '#fff',
                          cursor: 'pointer',
                          '&:hover': { opacity: 0.8 },
                        }}
                      />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    color={transaction.type === 'revenue' ? 'success.main' : 'error.main'}
                  >
                    {formatTransactionAmount(transaction.amount, transaction.type, currency)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                    {transaction.type === 'revenue' && activeAccountType === 'company' && (
                      <Tooltip title="Lier à une facture">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenInvoiceLinkDialog(transaction)}
                          sx={{ color: '#F5C518' }}
                        >
                          <ReceiptIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Modifier la catégorie">
                      <IconButton
                        size="small"
                        onClick={() => setEditingTransactionId(transaction.id)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {transaction.type === 'expense' && savingsCategories.length > 0 && (
                      editingSavingsForTransactionId === transaction.id ? (
                        <Select
                          size="small"
                          value={transaction.savings_category_id || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            handleDirectSavingsCategoryUpdate(
                              transaction.id,
                              value === '' ? null : Number(value)
                            );
                          }}
                          onClose={() => setEditingSavingsForTransactionId(null)}
                          autoFocus
                          open
                          sx={{ minWidth: 120 }}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Aucun budget</em>
                          </MenuItem>
                          {savingsCategories.map(cat => (
                            <MenuItem key={cat.id} value={cat.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cat.color }} />
                                {cat.name}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <Tooltip title={transaction.savings_category_id
                          ? `Budget: ${savingsCategories.find(c => c.id === transaction.savings_category_id)?.name || 'Épargne'}`
                          : "Assigner à un budget d'épargne"
                        }>
                          <IconButton
                            size="small"
                            onClick={() => setEditingSavingsForTransactionId(transaction.id)}
                            sx={{
                              color: transaction.savings_category_id
                                ? savingsCategories.find(c => c.id === transaction.savings_category_id)?.color || '#10B981'
                                : 'text.secondary',
                            }}
                          >
                            <SavingsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )
                    )}
                    {activeAccountType === 'associate' && (
                      <Tooltip title="Supprimer">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    Aucune transaction. Importez un relevé bancaire pour commencer.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderTop: '1px solid #E5E7EB' }}>
            <Typography variant="body2" color="text.secondary">
              {totalTransactions} transaction{totalTransactions > 1 ? 's' : ''} • Page {currentPage} sur {totalPages}
            </Typography>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              sx={{
                '& .MuiPaginationItem-root.Mui-selected': {
                  bgcolor: '#F5C518',
                  color: '#1A1A1A',
                  '&:hover': { bgcolor: '#E0B000' },
                },
              }}
            />
          </Box>
        )}
      </TableContainer>

      {/* Dialog création transaction */}
      <Dialog open={openTransactionDialog} onClose={() => {
        setOpenTransactionDialog(false);
        setNewTransaction({ type: 'expense', amount: 0, description: '', category_id: 0, savings_category_id: null });
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle transaction</DialogTitle>
        <DialogContent>
          <TextField
            select
            margin="dense"
            label="Type"
            fullWidth
            value={newTransaction.type}
            onChange={(e) => setNewTransaction({ ...newTransaction, type: e.target.value as 'revenue' | 'expense', category_id: 0, savings_category_id: null })}
            sx={{ mt: 2 }}
          >
            {activeAccountType === 'company' && <MenuItem value="revenue">Revenu</MenuItem>}
            <MenuItem value="expense">Dépense</MenuItem>
            {activeAccountType === 'associate' && <MenuItem value="revenue">Remboursement</MenuItem>}
          </TextField>

          <FormControl fullWidth margin="dense" required>
            <InputLabel>Catégorie *</InputLabel>
            <Select
              value={newTransaction.category_id || ''}
              label="Catégorie *"
              onChange={(e) => {
                const categoryId = Number(e.target.value);
                // Vérifier si c'est une catégorie d'épargne
                if (isSavingsCategory(categoryId) && savingsCategories.length > 0) {
                  setPendingSavingsSelection({
                    isNewTransaction: true,
                    categoryId,
                  });
                  setOpenSavingsCategoryDialog(true);
                } else {
                  setNewTransaction({ ...newTransaction, category_id: categoryId, savings_category_id: null });
                }
              }}
            >
              {categories
                .filter(c => {
                  // Pour le compte associé, toujours montrer les catégories de dépenses
                  // (les remboursements concernent des dépenses)
                  if (activeAccountType === 'associate') {
                    return c.type === 'expense';
                  }
                  return c.type === newTransaction.type;
                })
                .map(cat => (
                  <MenuItem key={cat.id} value={cat.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cat.color }} />
                      {cat.name}
                    </Box>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          {/* Afficher la catégorie d'épargne sélectionnée */}
          {newTransaction.savings_category_id && (
            <Box sx={{ mt: 1, p: 1.5, bgcolor: '#F0FDF4', borderRadius: 1, border: '1px solid #BBF7D0' }}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp sx={{ fontSize: 16, color: '#10B981' }} />
                Budget épargne: <strong>{savingsCategories.find(c => c.id === newTransaction.savings_category_id)?.name}</strong>
              </Typography>
            </Box>
          )}

          <TextField
            margin="dense"
            label={`Montant (${getCurrencySymbol(currency)}) *`}
            type="number"
            fullWidth
            value={newTransaction.amount}
            onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) })}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            value={newTransaction.description}
            onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenTransactionDialog(false);
            setNewTransaction({ type: 'expense', amount: 0, description: '', category_id: 0, savings_category_id: null });
          }}>Annuler</Button>
          <Button
            onClick={handleCreateTransaction}
            variant="contained"
            disabled={!newTransaction.category_id || newTransaction.amount <= 0}
            sx={{ bgcolor: '#F5C518', color: '#1A1A1A', '&:hover': { bgcolor: '#E0B000' } }}
          >
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog import */}
      <Dialog
        open={openImportDialog}
        onClose={() => {
          setOpenImportDialog(false);
          setImportFile(null);
          setImportPreview(null);
          setImportError(null);
          setImportDebugInfo(null);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Importer un relevé bancaire
          </Typography>
          <IconButton onClick={() => setOpenImportDialog(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {importError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {importError}
            </Alert>
          )}

          {!importPreview ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                size="large"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                sx={{ mb: 2 }}
              >
                Sélectionner un fichier (CSV ou PDF)
              </Button>

              {importFile && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Fichier sélectionné: <strong>{importFile.name}</strong>
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={handlePreviewImport}
                    disabled={importLoading}
                    sx={{ mt: 2, bgcolor: '#F5C518', color: '#1A1A1A', '&:hover': { bgcolor: '#E0B000' } }}
                  >
                    {importLoading ? 'Analyse en cours...' : 'Analyser le fichier'}
                  </Button>
                </Box>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
                Formats supportés: CSV (export bancaire standard), PDF (relevé de compte)
              </Typography>
            </Box>
          ) : (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                {importPreview.length} transaction(s) détectée(s).
                {importPreview.filter(t => t.is_duplicate === true).length > 0 && (
                  <> {importPreview.filter(t => t.is_duplicate === true).length} doublon(s) détecté(s) (seront ignorés).</>
                )}
                {importPreview.filter(t => t.is_duplicate !== true && (!t.category_id || t.category_id <= 0)).length > 0 && (
                  <Box sx={{ color: 'warning.main', mt: 1 }}>
                    <Warning sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                    {importPreview.filter(t => t.is_duplicate !== true && (!t.category_id || t.category_id <= 0)).length} transaction(s) sans catégorie. Assignez une catégorie à chacune.
                  </Box>
                )}
              </Alert>

              {/* Informations de debug sur le parsing */}
              {importDebugInfo && importDebugInfo.skipped_lines && importDebugInfo.skipped_lines > 0 && (
                <Accordion sx={{ mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BugReportIcon sx={{ color: 'warning.main' }} />
                      <Typography>
                        {importDebugInfo.skipped_lines} ligne(s) non interprétée(s) sur {importDebugInfo.total_lines}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Format détecté:</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                        <Chip size="small" label={`Délimiteur: "${importDebugInfo.format_detected?.delimiter || '?'}"`} />
                        <Chip size="small" label={`Colonne date: ${importDebugInfo.format_detected?.date_col ?? '?'}`} />
                        <Chip size="small" label={`Colonne description: ${importDebugInfo.format_detected?.desc_col ?? '?'}`} />
                        {importDebugInfo.format_detected?.debit_col !== undefined && importDebugInfo.format_detected?.debit_col !== null && (
                          <Chip size="small" label={`Colonne débit: ${importDebugInfo.format_detected.debit_col}`} />
                        )}
                        {importDebugInfo.format_detected?.credit_col !== undefined && importDebugInfo.format_detected?.credit_col !== null && (
                          <Chip size="small" label={`Colonne crédit: ${importDebugInfo.format_detected.credit_col}`} />
                        )}
                        {importDebugInfo.format_detected?.amount_col !== undefined && importDebugInfo.format_detected?.amount_col !== null && (
                          <Chip size="small" label={`Colonne montant: ${importDebugInfo.format_detected.amount_col}`} />
                        )}
                      </Box>

                      <Typography variant="subtitle2" gutterBottom>Raisons des lignes ignorées:</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                        {Object.entries(importDebugInfo.skipped_reasons || {}).map(([reason, count]) => (
                          <Chip
                            key={reason}
                            size="small"
                            color="warning"
                            label={`${reason.replace(/_/g, ' ')}: ${count}`}
                          />
                        ))}
                      </Box>

                      {importDebugInfo.sample_skipped && importDebugInfo.sample_skipped.length > 0 && (
                        <>
                          <Typography variant="subtitle2" gutterBottom>Exemples de lignes non parsées:</Typography>
                          <TableContainer sx={{ maxHeight: 200 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Ligne</TableCell>
                                  <TableCell>Raison</TableCell>
                                  <TableCell>Données</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {importDebugInfo.sample_skipped.map((sample, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>{sample.row}</TableCell>
                                    <TableCell>
                                      <Chip size="small" label={sample.reason?.replace(/_/g, ' ')} />
                                      {sample.date_value && (
                                        <Typography variant="caption" display="block">
                                          Date trouvée: "{sample.date_value}"
                                        </Typography>
                                      )}
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 400 }}>
                                      <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                        {JSON.stringify(sample.data, null, 0).slice(0, 200)}
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Montant</TableCell>
                      <TableCell>Catégorie</TableCell>
                      <TableCell>Statut</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importPreview.map((t, index) => (
                      <TableRow
                        key={index}
                        sx={{
                          opacity: t.is_duplicate === true ? 0.5 : 1,
                          bgcolor: t.is_duplicate !== true && (!t.category_id || t.category_id <= 0) ? '#FEF3C7' : 'inherit',
                        }}
                      >
                        <TableCell>{format(new Date(t.date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          <Typography variant="body2" noWrap title={t.description}>
                            {t.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              t.type === 'revenue'
                                ? (activeAccountType === 'associate' ? 'Remboursement' : 'Revenu')
                                : 'Dépense'
                            }
                            size="small"
                            color={t.type === 'revenue' ? 'success' : 'error'}
                          />
                        </TableCell>
                        <TableCell>
                          {formatCurrency(t.amount, currency)}
                        </TableCell>
                        <TableCell>
                          {t.is_duplicate === true ? (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Select
                                size="small"
                                value={t.category_id || ''}
                                onChange={(e) => handleUpdatePreviewCategory(index, Number(e.target.value))}
                                sx={{ minWidth: 130 }}
                                displayEmpty
                              >
                                <MenuItem value="" disabled>
                                  <em>Choisir...</em>
                                </MenuItem>
                                {categories
                                  .filter(c => c.type === t.type)
                                  .map(cat => (
                                    <MenuItem key={cat.id} value={cat.id}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cat.color }} />
                                        {cat.name}
                                      </Box>
                                    </MenuItem>
                                  ))}
                              </Select>
                              <Tooltip title="Créer une catégorie">
                                <IconButton
                                  size="small"
                                  onClick={() => handleQuickCreateCategory(index, t.type)}
                                  sx={{ color: '#F5C518' }}
                                >
                                  <AddIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {/* Indicateur de catégorie d'épargne */}
                              {t.savings_category_id && (
                                <Chip
                                  size="small"
                                  label={savingsCategories.find(c => c.id === t.savings_category_id)?.name || 'Épargne'}
                                  sx={{
                                    ml: 0.5,
                                    bgcolor: (savingsCategories.find(c => c.id === t.savings_category_id)?.color || '#10B981') + '20',
                                    color: savingsCategories.find(c => c.id === t.savings_category_id)?.color || '#10B981',
                                    fontWeight: 600,
                                    fontSize: '0.7rem',
                                  }}
                                />
                              )}
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          {t.is_duplicate === true ? (
                            <Chip label="Doublon" size="small" color="warning" />
                          ) : t.category_id && t.category_id > 0 ? (
                            <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                          ) : (
                            <Warning sx={{ color: 'warning.main', fontSize: 20 }} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        {importPreview && (
          <DialogActions>
            <Button onClick={() => { setImportPreview(null); setImportFile(null); }}>
              Annuler
            </Button>
            <Button
              onClick={handleConfirmImport}
              variant="contained"
              disabled={importLoading || importPreview.filter(t => t.is_duplicate !== true && (!t.category_id || t.category_id <= 0)).length > 0}
              sx={{ bgcolor: '#F5C518', color: '#1A1A1A', '&:hover': { bgcolor: '#E0B000' } }}
            >
              {importLoading ? 'Import en cours...' : `Importer ${importPreview.filter(t => t.is_duplicate !== true).length} transaction(s)`}
            </Button>
          </DialogActions>
        )}
      </Dialog>

      {/* Dialog paramètres (catégories & règles) */}
      <Dialog
        open={openSettingsDialog}
        onClose={() => setOpenSettingsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Catégories & Règles de catégorisation
          </Typography>
          <IconButton onClick={() => setOpenSettingsDialog(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Tabs value={settingsTab} onChange={(_, v) => setSettingsTab(v)} sx={{ mb: 3 }}>
            <Tab label="Catégories" />
            <Tab label="Règles automatiques" />
          </Tabs>

          {settingsTab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => setOpenCategoryDialog(true)}
                  sx={{ color: '#F5C518' }}
                >
                  Nouvelle catégorie
                </Button>
              </Box>

              <Typography variant="subtitle2" sx={{ mb: 1, color: 'success.main' }}>
                Revenus
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                {categories.filter(c => c.type === 'revenue').map(cat => (
                  <Chip
                    key={cat.id}
                    label={cat.name}
                    onDelete={() => handleDeleteCategory(cat.id)}
                    sx={{ bgcolor: cat.color, color: '#fff' }}
                  />
                ))}
                {categories.filter(c => c.type === 'revenue').length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Aucune catégorie de revenus
                  </Typography>
                )}
              </Box>

              <Typography variant="subtitle2" sx={{ mb: 1, color: 'error.main' }}>
                Dépenses
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {categories.filter(c => c.type === 'expense').map(cat => (
                  <Chip
                    key={cat.id}
                    label={cat.name}
                    onDelete={() => handleDeleteCategory(cat.id)}
                    sx={{ bgcolor: cat.color, color: '#fff' }}
                  />
                ))}
                {categories.filter(c => c.type === 'expense').length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Aucune catégorie de dépenses
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {settingsTab === 1 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Les règles permettent de catégoriser automatiquement les transactions lors de l'import.
                Les règles avec une priorité plus élevée sont appliquées en premier.
              </Alert>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingRule(null);
                    setNewRule({ pattern: '', match_type: 'contains', source_type: '', category_id: 0, transaction_type: '', priority: 0 });
                    setOpenRuleDialog(true);
                  }}
                  sx={{ color: '#F5C518' }}
                >
                  Nouvelle règle
                </Button>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Condition</TableCell>
                      <TableCell>Catégorie</TableCell>
                      <TableCell>Priorité</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rules.map(rule => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {rule.source_type && (
                              <Chip
                                label={rule.source_type === 'revenue' ? 'Revenus' : 'Dépenses'}
                                size="small"
                                sx={{
                                  bgcolor: rule.source_type === 'revenue' ? '#10B981' : '#EF4444',
                                  color: '#fff',
                                  fontSize: '0.7rem',
                                  height: 20,
                                }}
                              />
                            )}
                            {rule.pattern && (
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                {{
                                  contains: 'contient',
                                  starts_with: 'commence par',
                                  exact: '=',
                                  regex: 'regex',
                                }[rule.match_type] || rule.match_type} "{rule.pattern}"
                              </Typography>
                            )}
                            {!rule.source_type && !rule.pattern && (
                              <Typography variant="body2" color="text.secondary">
                                Aucune condition
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={rule.category.name}
                            size="small"
                            sx={{ bgcolor: rule.category.color, color: '#fff' }}
                          />
                        </TableCell>
                        <TableCell>{rule.priority}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleEditRule(rule)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteRule(rule.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {rules.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                            Aucune règle de catégorisation.
                            Créez des règles pour automatiser l'attribution des catégories.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog création catégorie */}
      <Dialog open={openCategoryDialog} onClose={() => setOpenCategoryDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nouvelle catégorie</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Nom"
            fullWidth
            value={newCategory.name}
            onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            select
            margin="dense"
            label="Type"
            fullWidth
            value={newCategory.type}
            onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value as 'revenue' | 'expense' })}
          >
            <MenuItem value="revenue">Revenu</MenuItem>
            <MenuItem value="expense">Dépense</MenuItem>
          </TextField>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Couleur
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <HexColorPicker
                color={newCategory.color}
                onChange={(color) => setNewCategory({ ...newCategory, color })}
                style={{ width: '100%', height: 150 }}
              />
              <Box
                sx={{
                  width: 50,
                  height: 50,
                  borderRadius: 2,
                  bgcolor: newCategory.color,
                  border: '2px solid',
                  borderColor: 'divider',
                  flexShrink: 0,
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {newCategory.color.toUpperCase()}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCategoryDialog(false)}>Annuler</Button>
          <Button
            onClick={handleCreateCategory}
            variant="contained"
            disabled={!newCategory.name}
            sx={{ bgcolor: '#F5C518', color: '#1A1A1A', '&:hover': { bgcolor: '#E0B000' } }}
          >
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog création/édition règle */}
      <Dialog open={openRuleDialog} onClose={() => { setOpenRuleDialog(false); setEditingRule(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRule ? 'Modifier la règle' : 'Nouvelle règle'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            Définissez les critères de correspondance. Au moins un critère (type ou motif) est requis.
          </Typography>

          {/* Filtre par type de transaction */}
          <TextField
            select
            margin="dense"
            label="Type de transaction"
            fullWidth
            value={newRule.source_type}
            onChange={(e) => {
              const value = e.target.value as '' | 'revenue' | 'expense';
              console.log('Source type selected:', value);
              setNewRule({ ...newRule, source_type: value });
            }}
            helperText="Appliquer la règle uniquement à ce type de transaction"
          >
            <MenuItem value="">Tous les types</MenuItem>
            <MenuItem value="revenue">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10B981' }} />
                Revenus uniquement
              </Box>
            </MenuItem>
            <MenuItem value="expense">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#EF4444' }} />
                Dépenses uniquement
              </Box>
            </MenuItem>
          </TextField>

          <TextField
            margin="dense"
            label="Motif à rechercher"
            fullWidth
            value={newRule.pattern}
            onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
            placeholder="ex: AMAZON, CARREFOUR, LOYER..."
            helperText={newRule.source_type ? "Optionnel si un type est sélectionné" : "Le texte sera recherché dans la description"}
            sx={{ mt: 2 }}
          />
          <TextField
            select
            margin="dense"
            label="Type de recherche"
            fullWidth
            value={newRule.match_type}
            onChange={(e) => setNewRule({ ...newRule, match_type: e.target.value })}
            disabled={!newRule.pattern}
          >
            <MenuItem value="contains">Contient</MenuItem>
            <MenuItem value="starts_with">Commence par</MenuItem>
            <MenuItem value="exact">Correspondance exacte</MenuItem>
            <MenuItem value="regex">Expression régulière</MenuItem>
          </TextField>

          <Divider sx={{ my: 2 }} />

          <FormControl fullWidth margin="dense">
            <InputLabel>Catégorie à attribuer</InputLabel>
            <Select
              value={newRule.category_id}
              label="Catégorie à attribuer"
              onChange={(e) => {
                const value = Number(e.target.value);
                console.log('Category selected:', value);
                setNewRule({ ...newRule, category_id: value });
              }}
            >
              <MenuItem value={0} disabled>Choisir une catégorie</MenuItem>
              <Divider />
              <MenuItem disabled sx={{ color: 'success.main', fontWeight: 600 }}>
                Revenus
              </MenuItem>
              {categories.filter(c => c.type === 'revenue').map(cat => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
              ))}
              <Divider />
              <MenuItem disabled sx={{ color: 'error.main', fontWeight: 600 }}>
                Dépenses
              </MenuItem>
              {categories.filter(c => c.type === 'expense').map(cat => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Priorité"
            type="number"
            fullWidth
            value={newRule.priority}
            onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 0 })}
            helperText="Les règles avec une priorité plus élevée sont appliquées en premier"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenRuleDialog(false); setEditingRule(null); }}>Annuler</Button>
          <Button
            onClick={handleCreateRule}
            variant="contained"
            disabled={(!newRule.pattern && !newRule.source_type) || !newRule.category_id}
            sx={{ bgcolor: '#F5C518', color: '#1A1A1A', '&:hover': { bgcolor: '#E0B000' } }}
          >
            {editingRule ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog lier transaction à facture */}
      <Dialog
        open={openInvoiceLinkDialog}
        onClose={() => {
          setOpenInvoiceLinkDialog(false);
          setSelectedTransaction(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon sx={{ color: '#F5C518' }} />
            Associer à une facture
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {/* Info transaction sélectionnée */}
          {selectedTransaction && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Transaction sélectionnée : <strong>{formatCurrency(selectedTransaction.amount, currency)}</strong>
              {selectedTransaction.description && ` - ${selectedTransaction.description.substring(0, 50)}...`}
            </Alert>
          )}

          {/* Liste des factures non payées */}
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#6B7280' }}>
            Factures en attente de paiement
          </Typography>

          {unpaidInvoices.length === 0 ? (
            <Alert severity="warning">
              Aucune facture en attente de paiement.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                    <TableCell>N° Facture</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Échéance</TableCell>
                    <TableCell align="right">Montant total</TableCell>
                    <TableCell align="right">Reste à payer</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unpaidInvoices.map((invoice) => {
                    const remaining = invoice.total_amount - (invoice.paid_amount || 0);
                    const isOverdue = new Date(invoice.due_date) < new Date();
                    return (
                      <TableRow key={invoice.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {invoice.invoice_number}
                          </Typography>
                        </TableCell>
                        <TableCell>{invoice.client_name || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            label={format(new Date(invoice.due_date), 'dd/MM/yyyy')}
                            size="small"
                            color={isOverdue ? 'error' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(invoice.total_amount, currency)}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            color={remaining > 0 ? 'error.main' : 'success.main'}
                          >
                            {formatCurrency(remaining, currency)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleLinkTransactionToInvoice(invoice.id)}
                            disabled={linkingInvoice}
                            sx={{
                              bgcolor: '#F5C518',
                              color: '#1A1A1A',
                              '&:hover': { bgcolor: '#E0B000' },
                            }}
                          >
                            Lier
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E5E7EB' }}>
          <Button
            onClick={() => {
              setOpenInvoiceLinkDialog(false);
              setSelectedTransaction(null);
            }}
          >
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog sélection catégorie d'épargne */}
      <Dialog
        open={openSavingsCategoryDialog}
        onClose={() => {
          setOpenSavingsCategoryDialog(false);
          setPendingSavingsSelection(null);
          setSavingsCategoryId(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp sx={{ color: 'white', fontSize: 20 }} />
            </Box>
            Sélectionner le budget d'épargne
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Cette transaction sera comptabilisée dans l'épargne. Choisissez dans quel budget d'épargne l'affecter.
          </Typography>

          {savingsCategories.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Aucune catégorie d'épargne configurée. Configurez vos budgets d'épargne dans le tableau de bord.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {savingsCategories.map((cat) => (
                <Box
                  key={cat.id}
                  onClick={() => setSavingsCategoryId(cat.id)}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: savingsCategoryId === cat.id ? `2px solid ${cat.color}` : '1px solid #E5E7EB',
                    bgcolor: savingsCategoryId === cat.id ? `${cat.color}10` : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: cat.color,
                      bgcolor: `${cat.color}08`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        bgcolor: cat.color,
                      }}
                    />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {cat.name}
                    </Typography>
                    <Chip
                      label={`${cat.percentage}%`}
                      size="small"
                      sx={{
                        bgcolor: `${cat.color}20`,
                        color: cat.color,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: 22,
                      }}
                    />
                  </Box>
                  {cat.description && (
                    <Typography variant="body2" sx={{ color: '#6B7280', ml: 3 }}>
                      {cat.description}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E5E7EB' }}>
          <Button
            onClick={() => {
              setOpenSavingsCategoryDialog(false);
              setPendingSavingsSelection(null);
              setSavingsCategoryId(null);
            }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            disabled={!savingsCategoryId}
            onClick={handleConfirmSavingsCategory}
            sx={{
              bgcolor: '#10B981',
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
