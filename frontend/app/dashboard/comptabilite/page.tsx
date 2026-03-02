'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  Tabs,
  Tab,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  CircularProgress,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Description as InvoiceIcon,
  Receipt as QuoteIcon,
  MoreVert as MoreVertIcon,
  Download as DownloadIcon,
  Send as SendIcon,
  Visibility as ViewIcon,
  People as PeopleIcon,
  Upload as UploadIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Payment as PaymentIcon,
  Link as LinkIcon,
  Check as CheckIcon,
  AttachMoney as AttachMoneyIcon,
  Person as PersonIcon,
  AttachFile as AttachFileIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  PersonAdd as PersonAddIcon,
  Email as EmailIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CreditCard as CreditCardIcon,
  LocalAtm as LocalAtmIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Sort as SortIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { useCompanyStore } from '@/store/companyStore';
import {
  clientsAPI, Client, ClientCreate, ClientType, ClientAttachment,
  invoicesAPI, Invoice, InvoiceListItem, InvoiceCreate, PaymentCreate,
  quotesAPI, Quote, QuoteListItem, QuoteCreate, LineItem,
  transactionsAPI, Transaction,
  vatRatesAPI, VatRate, VatRateCreate,
  companySettingsAPI, CompanySettings, CompanySettingsUpdate, BankAccount, BankAccountCreate,
} from '@/lib/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}


export default function ComptabilitePage() {
  const { currentCompany, fetchCurrentCompany } = useCompanyStore();
  const currency = currentCompany?.currency || 'EUR';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tabValue, setTabValue] = useState(0);
  const [settingsTabValue, setSettingsTabValue] = useState(0); // Sub-tabs pour Paramètres (0: Mail, 1: Personnalisation)
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);

  // Tri pour devis et factures
  const [quotesSortBy, setQuotesSortBy] = useState<'date' | 'amount' | 'validity'>('date');
  const [quotesSortOrder, setQuotesSortOrder] = useState<'asc' | 'desc'>('desc');
  const [invoicesSortBy, setInvoicesSortBy] = useState<'date' | 'amount' | 'due_date'>('date');
  const [invoicesSortOrder, setInvoicesSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filtres pour devis
  const [quotesFilterDate, setQuotesFilterDate] = useState<string>('');
  const [quotesFilterStatus, setQuotesFilterStatus] = useState<string>('');
  const [quotesFilterClient, setQuotesFilterClient] = useState<string>('');

  // Filtres pour factures
  const [invoicesFilterDate, setInvoicesFilterDate] = useState<string>('');
  const [invoicesFilterStatus, setInvoicesFilterStatus] = useState<string>('');
  const [invoicesFilterClient, setInvoicesFilterClient] = useState<string>('');

  // État pour la liaison de paiements
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceListItem | null>(null);
  const [availableTransactions, setAvailableTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Clients
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [openClientDialog, setOpenClientDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState<ClientCreate>({
    client_type: 'personal',
    name: '',
    first_name: '',
    email: '',
    phone: '',
    company_name: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'France',
    vat_number: '',
    siret: '',
    contact_position: '',
    notes: '',
  });
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  // Gestion des doublons clients
  const [duplicateClientDialog, setDuplicateClientDialog] = useState(false);
  const [duplicateClientInfo, setDuplicateClientInfo] = useState<{ id: number; name: string } | null>(null);
  const [pendingClientData, setPendingClientData] = useState<ClientCreate | null>(null);

  // Pièces jointes pour les clients professionnels
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Menu contextuel
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // Création de devis
  const [openQuoteDialog, setOpenQuoteDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [quoteForm, setQuoteForm] = useState({
    issue_date: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 jours
    description: '',
    notes: '',
    terms: 'Conditions de paiement : 30 jours',
    tax_rate: 20,
  });
  const [quoteLineItems, setQuoteLineItems] = useState<(Omit<LineItem, 'id' | 'amount' | 'vat_amount' | 'amount_with_vat'> & { unit_price_ttc?: number })[]>([
    { description: '', quantity: 1, unit_price: 0, unit_price_ttc: 0, vat_rate: 0, position: 0 }
  ]);
  const [savingQuote, setSavingQuote] = useState(false);
  const [clientNameInput, setClientNameInput] = useState(''); // Pour la saisie libre du nom du client

  // TVA rates depuis l'API
  const [vatRates, setVatRates] = useState<VatRate[]>([]);
  const [openVatDialog, setOpenVatDialog] = useState(false);
  const [newVatRate, setNewVatRate] = useState<VatRateCreate>({ name: '', rate: 0, description: '' });
  const [editingVatRate, setEditingVatRate] = useState<VatRate | null>(null);
  const [savingVatRate, setSavingVatRate] = useState(false);

  // Visualisation/modification de devis
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null);
  const [openViewQuoteDialog, setOpenViewQuoteDialog] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);

  // Visualisation de facture
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [openViewInvoiceDialog, setOpenViewInvoiceDialog] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Envoi d'email (devis)
  const [openEmailDialog, setOpenEmailDialog] = useState(false);
  const [emailForm, setEmailForm] = useState({ quoteId: 0, to_email: '', subject: '', message: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Envoi d'email (facture)
  const [openInvoiceEmailDialog, setOpenInvoiceEmailDialog] = useState(false);
  const [invoiceEmailForm, setInvoiceEmailForm] = useState({ invoiceId: 0, to_email: '', subject: '', message: '' });
  const [sendingInvoiceEmail, setSendingInvoiceEmail] = useState(false);
  const [invoiceEmailSent, setInvoiceEmailSent] = useState(false);

  // Téléchargement PDF
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Paiement sur place (CB/Espèces)
  const [openOnsitePaymentDialog, setOpenOnsitePaymentDialog] = useState(false);
  const [onsitePayment, setOnsitePayment] = useState({
    invoiceId: 0,
    amount: 0,
    payment_method: 'carte' as 'carte' | 'especes',
  });
  const [savingOnsitePayment, setSavingOnsitePayment] = useState(false);

  // Paramètres entreprise (Comptabilité)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<CompanySettingsUpdate>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingSettingsLogo, setUploadingSettingsLogo] = useState(false);
  const settingsLogoInputRef = useRef<HTMLInputElement>(null);

  // Comptes bancaires (RIB)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [openBankAccountDialog, setOpenBankAccountDialog] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [bankAccountForm, setBankAccountForm] = useState<BankAccountCreate>({
    label: '',
    bank_name: '',
    account_holder: '',
    iban: '',
    bic: '',
    is_default: false,
  });
  const [savingBankAccount, setSavingBankAccount] = useState(false);

  // SMTP
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);

  // Changement de statut de devis avec dialogues
  const [statusChangeQuote, setStatusChangeQuote] = useState<QuoteListItem | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [openExpiredWarningDialog, setOpenExpiredWarningDialog] = useState(false);
  const [openCreateInvoiceDialog, setOpenCreateInvoiceDialog] = useState(false);
  const [invoiceDueDate, setInvoiceDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const fetchCompanySettings = async () => {
    try {
      const res = await companySettingsAPI.get();
      setCompanySettings(res.data);
      setSettingsForm({
        primary_color: res.data.primary_color,
        secondary_color: res.data.secondary_color,
        text_color: res.data.text_color,
        default_quote_terms: res.data.default_quote_terms || '',
        default_invoice_terms: res.data.default_invoice_terms || '',
        default_quote_notes: res.data.default_quote_notes || '',
        default_invoice_notes: res.data.default_invoice_notes || '',
        default_payment_terms: res.data.default_payment_terms || '',
        quote_prefix: res.data.quote_prefix,
        invoice_prefix: res.data.invoice_prefix,
        quote_next_number: res.data.quote_next_number,
        invoice_next_number: res.data.invoice_next_number,
        document_footer: res.data.document_footer || '',
        // SMTP - ne pas inclure le mot de passe masqué
        smtp_host: res.data.smtp_host || '',
        smtp_port: res.data.smtp_port || 587,
        smtp_user: res.data.smtp_user || '',
        smtp_from_email: res.data.smtp_from_email || '',
        smtp_from_name: res.data.smtp_from_name || '',
        // Messages d'email par défaut
        default_invoice_email_message: res.data.default_invoice_email_message || '',
        default_quote_email_message: res.data.default_quote_email_message || '',
      });
      // Charger les comptes bancaires
      setBankAccounts(res.data.bank_accounts || []);
    } catch (error) {
      console.error('Error fetching company settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await companySettingsAPI.update(settingsForm);
      setCompanySettings(res.data);
      alert('Paramètres enregistrés avec succès !');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Erreur lors de la sauvegarde des paramètres');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUploadSettingsLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingSettingsLogo(true);
    try {
      const res = await companySettingsAPI.uploadLogo(file);
      setCompanySettings(res.data);
      alert('Logo téléchargé avec succès !');
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Erreur lors du téléchargement du logo');
    } finally {
      setUploadingSettingsLogo(false);
    }
  };

  const handleDeleteSettingsLogo = async () => {
    if (!confirm('Supprimer le logo ?')) return;

    try {
      const res = await companySettingsAPI.deleteLogo();
      setCompanySettings(res.data);
    } catch (error) {
      console.error('Error deleting logo:', error);
      alert('Erreur lors de la suppression du logo');
    }
  };

  // Gestion des comptes bancaires (RIB)
  const resetBankAccountForm = () => {
    setBankAccountForm({
      label: '',
      bank_name: '',
      account_holder: '',
      iban: '',
      bic: '',
      is_default: false,
    });
    setEditingBankAccount(null);
  };

  const handleOpenBankAccountDialog = (account?: BankAccount) => {
    if (account) {
      setEditingBankAccount(account);
      setBankAccountForm({
        label: account.label || '',
        bank_name: account.bank_name || '',
        account_holder: account.account_holder || '',
        iban: account.iban || '',
        bic: account.bic || '',
        is_default: account.is_default,
      });
    } else {
      resetBankAccountForm();
    }
    setOpenBankAccountDialog(true);
  };

  const handleSaveBankAccount = async () => {
    // Validation des champs obligatoires
    if (!bankAccountForm.label?.trim()) {
      alert('Le nom du compte est obligatoire');
      return;
    }
    if (!bankAccountForm.bank_name?.trim()) {
      alert('Le nom de la banque est obligatoire');
      return;
    }
    if (!bankAccountForm.iban?.trim()) {
      alert('L\'IBAN est obligatoire');
      return;
    }

    setSavingBankAccount(true);
    try {
      if (editingBankAccount) {
        // Modification
        const res = await companySettingsAPI.updateBankAccount(editingBankAccount.id, bankAccountForm);
        setBankAccounts(prev => prev.map(a => a.id === editingBankAccount.id ? res.data : a));
      } else {
        // Création
        const res = await companySettingsAPI.createBankAccount(bankAccountForm);
        setBankAccounts(prev => [...prev, res.data]);
      }
      setOpenBankAccountDialog(false);
      resetBankAccountForm();
    } catch (error: any) {
      console.error('Error saving bank account:', error);
      const errorMsg = error.response?.data?.detail || 'Erreur lors de la sauvegarde du compte bancaire';
      alert(errorMsg);
    } finally {
      setSavingBankAccount(false);
    }
  };

  const handleDeleteBankAccount = async (accountId: number) => {
    if (!confirm('Supprimer ce compte bancaire ?')) return;

    try {
      await companySettingsAPI.deleteBankAccount(accountId);
      setBankAccounts(prev => prev.filter(a => a.id !== accountId));
    } catch (error) {
      console.error('Error deleting bank account:', error);
      alert('Erreur lors de la suppression du compte bancaire');
    }
  };

  const fetchVatRates = async () => {
    try {
      const res = await vatRatesAPI.getAll();
      setVatRates(res.data);
      // Définir le taux par défaut si aucun n'est sélectionné
      const defaultRate = res.data.find(r => r.is_default);
      if (defaultRate && quoteForm.tax_rate === 20) {
        setQuoteForm(prev => ({ ...prev, tax_rate: defaultRate.rate }));
      }
    } catch (error) {
      console.error('Error fetching VAT rates:', error);
      // Si pas de taux configurés, on garde les valeurs par défaut
    }
  };

  const fetchClients = async () => {
    try {
      const res = await clientsAPI.getAll(clientSearch || undefined);
      setClients(res.data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await invoicesAPI.getAll();
      setInvoices(res.data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const fetchQuotes = async () => {
    try {
      const res = await quotesAPI.getAll();
      setQuotes(res.data);
    } catch (error) {
      console.error('Error fetching quotes:', error);
    }
  };

  const fetchAvailableTransactions = async () => {
    setLoadingTransactions(true);
    try {
      // Récupérer les revenus récents (transactions non encore liées)
      const res = await transactionsAPI.getAll({ type: 'revenue', limit: 50 });
      setAvailableTransactions(res.data.items || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleLinkPayment = async (transactionId: number) => {
    if (!selectedInvoice) return;
    try {
      await invoicesAPI.linkTransaction(selectedInvoice.id, transactionId);
      setOpenPaymentDialog(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (error: any) {
      console.error('Error linking payment:', error);
      alert(error.response?.data?.detail || 'Erreur lors de la liaison du paiement');
    }
  };

  const handleOpenPaymentDialog = (invoice: InvoiceListItem) => {
    setSelectedInvoice(invoice);
    setOpenPaymentDialog(true);
    fetchAvailableTransactions();
  };

  useEffect(() => {
    fetchCurrentCompany();
    fetchClients();
    fetchInvoices();
    fetchQuotes();
    fetchVatRates();
    fetchCompanySettings();
    setTimeout(() => setLoading(false), 500);
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchClients();
    }, 300);
    return () => clearTimeout(debounce);
  }, [clientSearch]);

  // Filtrage et tri des devis
  const sortedQuotes = useMemo(() => {
    let filtered = [...quotes];

    // Appliquer les filtres
    if (quotesFilterDate) {
      filtered = filtered.filter(q => q.issue_date === quotesFilterDate);
    }
    if (quotesFilterStatus) {
      filtered = filtered.filter(q => q.status === quotesFilterStatus);
    }
    if (quotesFilterClient) {
      filtered = filtered.filter(q =>
        q.client_name?.toLowerCase().includes(quotesFilterClient.toLowerCase())
      );
    }

    // Appliquer le tri
    filtered.sort((a, b) => {
      let comparison = 0;
      if (quotesSortBy === 'date') {
        comparison = new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime();
      } else if (quotesSortBy === 'amount') {
        comparison = a.total_amount - b.total_amount;
      } else if (quotesSortBy === 'validity') {
        comparison = new Date(a.valid_until).getTime() - new Date(b.valid_until).getTime();
      }
      return quotesSortOrder === 'asc' ? comparison : -comparison;
    });
    return filtered;
  }, [quotes, quotesSortBy, quotesSortOrder, quotesFilterDate, quotesFilterStatus, quotesFilterClient]);

  // Filtrage et tri des factures
  const sortedInvoices = useMemo(() => {
    let filtered = [...invoices];

    // Appliquer les filtres
    if (invoicesFilterDate) {
      filtered = filtered.filter(i => i.issue_date === invoicesFilterDate);
    }
    if (invoicesFilterStatus) {
      filtered = filtered.filter(i => i.status === invoicesFilterStatus);
    }
    if (invoicesFilterClient) {
      filtered = filtered.filter(i =>
        i.client_name?.toLowerCase().includes(invoicesFilterClient.toLowerCase())
      );
    }

    // Appliquer le tri
    filtered.sort((a, b) => {
      let comparison = 0;
      if (invoicesSortBy === 'date') {
        comparison = new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime();
      } else if (invoicesSortBy === 'amount') {
        comparison = a.total_amount - b.total_amount;
      } else if (invoicesSortBy === 'due_date') {
        comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return invoicesSortOrder === 'asc' ? comparison : -comparison;
    });
    return filtered;
  }, [invoices, invoicesSortBy, invoicesSortOrder, invoicesFilterDate, invoicesFilterStatus, invoicesFilterClient]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: number) => {
    setMenuAnchor(event.currentTarget);
    setSelectedItemId(id);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedItemId(null);
  };

  // ============ Actions sur les devis ============

  const handleViewQuote = async () => {
    if (!selectedItemId) return;
    handleMenuClose();
    setLoadingQuote(true);
    try {
      const res = await quotesAPI.getOne(selectedItemId);
      setViewingQuote(res.data);
      setOpenViewQuoteDialog(true);
    } catch (error) {
      console.error('Error loading quote:', error);
      alert('Erreur lors du chargement du devis');
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedItemId) return;
    handleMenuClose();
    setDownloadingPdf(true);
    try {
      const response = await quotesAPI.downloadPdf(selectedItemId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const quote = quotes.find(q => q.id === selectedItemId);
      link.setAttribute('download', `Devis_${quote?.quote_number || selectedItemId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Erreur lors du téléchargement du PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleOpenEmailDialog = () => {
    if (!selectedItemId) return;
    const quote = quotes.find(q => q.id === selectedItemId);
    // Pré-remplir l'email du client si disponible
    const client = clients.find(c => c.id === quote?.client_id);
    setEmailForm({
      quoteId: selectedItemId,
      to_email: client?.email || '',
      subject: `Devis ${quote?.quote_number} - ${currentCompany?.name || ''}`,
      message: '',
    });
    setEmailSent(false);
    handleMenuClose();
    setOpenEmailDialog(true);
  };

  const handleSendEmail = async () => {
    if (!emailForm.quoteId || !emailForm.to_email) {
      console.log('Early return - missing data', { quoteId: emailForm.quoteId, to_email: emailForm.to_email });
      return;
    }
    setSendingEmail(true);
    try {
      await quotesAPI.sendEmail(emailForm.quoteId, emailForm);
      setEmailSent(true);
      fetchQuotes(); // Rafraîchir pour voir le statut mis à jour
    } catch (error: any) {
      console.error('Error sending email:', error);
      alert(error.response?.data?.detail || 'Erreur lors de l\'envoi de l\'email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleUpdateQuoteStatus = async (status: string) => {
    if (!viewingQuote) return;
    try {
      await quotesAPI.update(viewingQuote.id, { status });
      setViewingQuote({ ...viewingQuote, status: status as any });
      fetchQuotes();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // ============ Actions sur les factures ============

  const handleViewInvoice = async () => {
    if (!selectedItemId) return;
    handleMenuClose();
    setLoadingInvoice(true);
    try {
      const res = await invoicesAPI.getOne(selectedItemId);
      setViewingInvoice(res.data);
      setOpenViewInvoiceDialog(true);
    } catch (error) {
      console.error('Error loading invoice:', error);
      alert('Erreur lors du chargement de la facture');
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleDownloadInvoicePdf = async (invoiceIdParam?: number) => {
    const invoiceId = invoiceIdParam || selectedItemId;
    if (!invoiceId) return;
    handleMenuClose();
    setDownloadingPdf(true);
    try {
      const response = await invoicesAPI.downloadPdf(invoiceId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const invoice = invoices.find(i => i.id === invoiceId) || viewingInvoice;
      link.setAttribute('download', `Facture_${invoice?.invoice_number || invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Erreur lors du téléchargement du PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleOpenInvoiceEmailDialog = async (invoiceIdParam?: number) => {
    // Si invoiceIdParam n'est pas un nombre (ex: événement de clic), utiliser selectedItemId
    const invoiceId = (typeof invoiceIdParam === 'number' ? invoiceIdParam : null) || selectedItemId;
    if (!invoiceId) return;
    handleMenuClose();

    // Charger les détails complets de la facture pour avoir l'email du client
    try {
      const res = await invoicesAPI.getOne(invoiceId);
      const invoice = res.data;
      setInvoiceEmailForm({
        invoiceId: invoiceId,
        to_email: invoice.client_email || '',
        subject: `Facture ${invoice.invoice_number} - ${currentCompany?.name || ''}`,
        message: '',
      });
      setInvoiceEmailSent(false);
      setOpenInvoiceEmailDialog(true);
    } catch (error) {
      console.error('Error loading invoice:', error);
      alert('Erreur lors du chargement de la facture');
    }
  };

  const handleSendInvoiceEmail = async () => {
    if (!invoiceEmailForm.invoiceId || !invoiceEmailForm.to_email) {
      return;
    }
    setSendingInvoiceEmail(true);
    try {
      await invoicesAPI.sendEmail(invoiceEmailForm.invoiceId, invoiceEmailForm);
      setInvoiceEmailSent(true);
      fetchInvoices();
    } catch (error: any) {
      console.error('Error sending email:', error);
      alert(error.response?.data?.detail || 'Erreur lors de l\'envoi de l\'email');
    } finally {
      setSendingInvoiceEmail(false);
    }
  };

  const handleUpdateInvoiceStatus = async (status: string) => {
    if (!viewingInvoice) return;
    try {
      await invoicesAPI.update(viewingInvoice.id, { status });
      setViewingInvoice({ ...viewingInvoice, status: status as any });
      fetchInvoices();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Ouvrir le dialogue de paiement sur place
  const handleOpenOnsitePaymentDialog = (invoice?: Invoice) => {
    const inv = invoice || viewingInvoice;
    if (!inv) return;
    const remaining = Math.round((inv.total_amount - (inv.paid_amount || 0)) * 100) / 100;
    setOnsitePayment({
      invoiceId: inv.id,
      amount: remaining,
      payment_method: 'carte',
    });
    setOpenOnsitePaymentDialog(true);
  };

  // Enregistrer un paiement sur place (CB ou espèces)
  const handleSaveOnsitePayment = async () => {
    if (!onsitePayment.invoiceId || !onsitePayment.amount) return;

    setSavingOnsitePayment(true);
    try {
      const paymentData: PaymentCreate = {
        amount: onsitePayment.amount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: onsitePayment.payment_method === 'carte' ? 'carte bancaire' : 'espèces',
        notes: `Paiement sur place (${onsitePayment.payment_method === 'carte' ? 'carte bancaire' : 'espèces'})`,
      };
      await invoicesAPI.addPayment(onsitePayment.invoiceId, paymentData);
      setOpenOnsitePaymentDialog(false);
      setOnsitePayment({ invoiceId: 0, amount: 0, payment_method: 'carte' });
      fetchInvoices();
      // Rafraîchir la facture en cours de visualisation si nécessaire
      if (viewingInvoice && viewingInvoice.id === onsitePayment.invoiceId) {
        const res = await invoicesAPI.getOne(viewingInvoice.id);
        setViewingInvoice(res.data);
      }
      alert('Paiement enregistré avec succès !');
    } catch (error: any) {
      console.error('Error adding payment:', error);
      alert(error.response?.data?.detail || 'Erreur lors de l\'enregistrement du paiement');
    } finally {
      setSavingOnsitePayment(false);
    }
  };

  // Changement de statut depuis la liste des devis
  const handleQuoteStatusChangeFromList = (quote: QuoteListItem, newStatus: string) => {
    // Si on passe à "accepted", vérifier la date de validité
    if (newStatus === 'accepted') {
      const validUntil = new Date(quote.valid_until);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setStatusChangeQuote(quote);
      setPendingStatus(newStatus);

      if (validUntil < today) {
        // La date de validité est dépassée - afficher l'avertissement
        setOpenExpiredWarningDialog(true);
      } else {
        // Date valide - proposer directement de créer la facture
        setOpenCreateInvoiceDialog(true);
      }
    } else {
      // Pour les autres statuts, mettre à jour directement
      updateQuoteStatusDirectly(quote.id, newStatus);
    }
  };

  const updateQuoteStatusDirectly = async (quoteId: number, status: string) => {
    try {
      await quotesAPI.update(quoteId, { status });
      fetchQuotes();
    } catch (error) {
      console.error('Error updating quote status:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const handleConfirmExpiredQuote = () => {
    // L'utilisateur confirme vouloir accepter malgré la date dépassée
    setOpenExpiredWarningDialog(false);
    setOpenCreateInvoiceDialog(true);
  };

  const handleCancelExpiredQuote = () => {
    setOpenExpiredWarningDialog(false);
    setStatusChangeQuote(null);
    setPendingStatus(null);
  };

  const handleCreateInvoiceFromQuote = async () => {
    if (!statusChangeQuote) return;

    setCreatingInvoice(true);
    try {
      // D'abord mettre à jour le statut du devis
      await quotesAPI.update(statusChangeQuote.id, { status: 'accepted' });

      // Ensuite créer la facture
      await quotesAPI.convertToInvoice(statusChangeQuote.id, {
        due_date: invoiceDueDate,
      });

      fetchQuotes();
      fetchInvoices();
      setOpenCreateInvoiceDialog(false);
      setStatusChangeQuote(null);
      setPendingStatus(null);
      setTabValue(1); // Aller sur l'onglet factures
      alert('Devis accepté et facture créée avec succès !');
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      alert(error.response?.data?.detail || 'Erreur lors de la création de la facture');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleSkipInvoiceCreation = async () => {
    if (!statusChangeQuote) return;

    try {
      await quotesAPI.update(statusChangeQuote.id, { status: 'accepted' });
      fetchQuotes();
      setOpenCreateInvoiceDialog(false);
      setStatusChangeQuote(null);
      setPendingStatus(null);
    } catch (error) {
      console.error('Error updating quote status:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  // ============ Gestion des devis ============

  const getDefaultVatRate = () => vatRates.find(r => r.is_default)?.rate || 0;

  const resetQuoteForm = () => {
    setSelectedClient(null);
    setClientNameInput('');
    const defaultRate = getDefaultVatRate();
    setQuoteForm({
      issue_date: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: '',
      notes: '',
      terms: 'Conditions de paiement : 30 jours',
      tax_rate: defaultRate,
    });
    setQuoteLineItems([{ description: '', quantity: 1, unit_price: 0, unit_price_ttc: 0, vat_rate: defaultRate, position: 0 }]);
  };

  const addQuoteLineItem = () => {
    const defaultRate = getDefaultVatRate();
    setQuoteLineItems([
      ...quoteLineItems,
      { description: '', quantity: 1, unit_price: 0, unit_price_ttc: 0, vat_rate: defaultRate, position: quoteLineItems.length }
    ]);
  };

  const updateQuoteLineItem = (index: number, field: string, value: string | number) => {
    const updated = [...quoteLineItems];
    const item = { ...updated[index] };
    const vatRate = item.vat_rate ?? 0;

    if (field === 'unit_price') {
      // Si on modifie le prix HT, calculer le TTC
      const ht = Number(value);
      item.unit_price = ht;
      item.unit_price_ttc = ht * (1 + vatRate / 100);
    } else if (field === 'unit_price_ttc') {
      // Si on modifie le prix TTC, calculer le HT
      const ttc = Number(value);
      item.unit_price_ttc = ttc;
      item.unit_price = ttc / (1 + vatRate / 100);
    } else if (field === 'vat_rate') {
      // Si on change le taux de TVA, recalculer le TTC à partir du HT
      const newVatRate = Number(value);
      item.vat_rate = newVatRate;
      item.unit_price_ttc = item.unit_price * (1 + newVatRate / 100);
    } else {
      (item as any)[field] = value;
    }

    updated[index] = item;
    setQuoteLineItems(updated);
  };

  const removeQuoteLineItem = (index: number) => {
    if (quoteLineItems.length <= 1) return;
    setQuoteLineItems(quoteLineItems.filter((_, i) => i !== index));
  };

  // Calcul des totaux du devis avec TVA par ligne
  const calculateQuoteTotals = () => {
    let subtotal = 0;
    let totalVat = 0;

    quoteLineItems.forEach(item => {
      const lineAmount = item.quantity * item.unit_price;
      subtotal += lineAmount;
      const lineVatRate = item.vat_rate ?? 0;
      totalVat += lineAmount * (lineVatRate / 100);
    });

    const total = subtotal + totalVat;
    return { subtotal, taxAmount: totalVat, total };
  };

  // ============ Gestion des taux de TVA ============

  const handleSaveVatRate = async () => {
    setSavingVatRate(true);
    try {
      if (editingVatRate) {
        await vatRatesAPI.update(editingVatRate.id, newVatRate);
      } else {
        await vatRatesAPI.create(newVatRate);
      }
      fetchVatRates();
      setNewVatRate({ name: '', rate: 0, description: '' });
      setEditingVatRate(null);
    } catch (error) {
      console.error('Error saving VAT rate:', error);
    } finally {
      setSavingVatRate(false);
    }
  };

  const handleDeleteVatRate = async (id: number) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce taux de TVA ?')) {
      try {
        await vatRatesAPI.delete(id);
        fetchVatRates();
      } catch (error) {
        console.error('Error deleting VAT rate:', error);
      }
    }
  };

  const handleSeedDefaultVatRates = async (country: string) => {
    try {
      await vatRatesAPI.seedDefaults(country);
      fetchVatRates();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Erreur lors de la création des taux par défaut');
    }
  };

  const handleCreateQuote = async () => {
    // Validation
    if (quoteLineItems.every(item => !item.description || item.unit_price <= 0)) {
      alert('Veuillez ajouter au moins un produit/service avec une description et un prix');
      return;
    }

    setSavingQuote(true);
    try {
      const quoteData: QuoteCreate = {
        client_id: selectedClient?.id,
        issue_date: quoteForm.issue_date,
        valid_until: quoteForm.valid_until,
        description: quoteForm.description,
        notes: quoteForm.notes,
        terms: quoteForm.terms,
        tax_rate: quoteForm.tax_rate,
        line_items: quoteLineItems.filter(item => item.description && item.unit_price > 0),
      };

      await quotesAPI.create(quoteData);
      setOpenQuoteDialog(false);
      resetQuoteForm();
      fetchQuotes();
    } catch (error: any) {
      console.error('Error creating quote:', error);
      alert(error.response?.data?.detail || 'Erreur lors de la création du devis');
    } finally {
      setSavingQuote(false);
    }
  };

  const resetClientForm = () => {
    setNewClient({
      client_type: 'personal',
      name: '',
      first_name: '',
      email: '',
      phone: '',
      company_name: '',
      address: '',
      city: '',
      postal_code: '',
      country: 'France',
      vat_number: '',
      siret: '',
      contact_position: '',
      notes: '',
    });
    setPendingAttachments([]);
  };

  const handleCreateClient = async (forceCreate: boolean = false) => {
    try {
      let clientId: number;

      if (editingClient) {
        await clientsAPI.update(editingClient.id, newClient);
        clientId = editingClient.id;
      } else {
        const res = await clientsAPI.create(newClient, forceCreate);
        clientId = res.data.id;
      }

      // Upload des pièces jointes pour les clients professionnels
      if (newClient.client_type === 'professional' && pendingAttachments.length > 0) {
        setUploadingAttachment(true);
        for (const file of pendingAttachments) {
          try {
            await clientsAPI.uploadAttachment(clientId, file);
          } catch (error) {
            console.error('Error uploading attachment:', error);
          }
        }
        setUploadingAttachment(false);
      }

      setOpenClientDialog(false);
      setEditingClient(null);
      resetClientForm();
      setDuplicateClientDialog(false);
      setDuplicateClientInfo(null);
      setPendingClientData(null);
      fetchClients();
    } catch (error: any) {
      // Vérifier si c'est une erreur de doublon (409 Conflict)
      if (error.response?.status === 409 && error.response?.data?.detail) {
        const detail = error.response.data.detail;
        setDuplicateClientInfo({
          id: detail.existing_client_id,
          name: detail.existing_client_name,
        });
        setPendingClientData(newClient);
        setDuplicateClientDialog(true);
      } else {
        console.error('Error creating/updating client:', error);
        alert(error.response?.data?.detail || 'Erreur lors de la création du client');
      }
    }
  };

  const handleUpdateExistingClient = async () => {
    if (!duplicateClientInfo || !pendingClientData) return;

    try {
      await clientsAPI.update(duplicateClientInfo.id, pendingClientData);

      // Upload des pièces jointes si nécessaire
      if (pendingClientData.client_type === 'professional' && pendingAttachments.length > 0) {
        setUploadingAttachment(true);
        for (const file of pendingAttachments) {
          try {
            await clientsAPI.uploadAttachment(duplicateClientInfo.id, file);
          } catch (error) {
            console.error('Error uploading attachment:', error);
          }
        }
        setUploadingAttachment(false);
      }

      setOpenClientDialog(false);
      setEditingClient(null);
      resetClientForm();
      setDuplicateClientDialog(false);
      setDuplicateClientInfo(null);
      setPendingClientData(null);
      fetchClients();
    } catch (error) {
      console.error('Error updating client:', error);
    }
  };

  const handleForceCreateClient = async () => {
    if (!pendingClientData) return;
    setNewClient(pendingClientData);
    setDuplicateClientDialog(false);
    await handleCreateClient(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setNewClient({
      client_type: client.client_type || 'personal',
      name: client.name,
      first_name: client.first_name || '',
      email: client.email || '',
      phone: client.phone || '',
      company_name: client.company_name || '',
      address: client.address || '',
      city: client.city || '',
      postal_code: client.postal_code || '',
      country: client.country || 'France',
      vat_number: client.vat_number || '',
      siret: client.siret || '',
      contact_position: client.contact_position || '',
      notes: client.notes || '',
    });
    setPendingAttachments([]);
    setOpenClientDialog(true);
  };

  const handleAddAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setPendingAttachments([...pendingAttachments, ...Array.from(files)]);
    }
    // Reset input
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  };

  const handleRemovePendingAttachment = (index: number) => {
    setPendingAttachments(pendingAttachments.filter((_, i) => i !== index));
  };

  const handleDeleteExistingAttachment = async (attachmentId: number) => {
    if (!editingClient) return;
    if (confirm('Êtes-vous sûr de vouloir supprimer cette pièce jointe ?')) {
      try {
        await clientsAPI.deleteAttachment(editingClient.id, attachmentId);
        // Rafraîchir le client
        const res = await clientsAPI.getOne(editingClient.id);
        setEditingClient(res.data);
      } catch (error) {
        console.error('Error deleting attachment:', error);
      }
    }
  };

  const handleDownloadAttachment = async (attachmentId: number, filename: string) => {
    if (!editingClient) return;
    try {
      const response = await clientsAPI.downloadAttachment(editingClient.id, attachmentId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading attachment:', error);
    }
  };

  const handleDeleteClient = async (id: number) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      try {
        await clientsAPI.delete(id);
        fetchClients();
      } catch (error) {
        console.error('Error deleting client:', error);
      }
    }
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportResult(null);

    try {
      const res = await clientsAPI.importCSV(file);
      setImportResult(res.data);
      fetchClients();
    } catch (error: any) {
      setImportResult({
        imported: 0,
        skipped: 0,
        errors: [error.response?.data?.detail || 'Erreur lors de l\'import'],
      });
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getQuoteStatusChip = (status: string) => {
    const configs: Record<string, { label: string; color: string; bgcolor: string }> = {
      draft: { label: 'Brouillon', color: '#9CA3AF', bgcolor: '#F3F4F6' },
      sent: { label: 'Envoyé', color: '#3B82F6', bgcolor: '#EFF6FF' },
      accepted: { label: 'Accepté', color: '#10B981', bgcolor: '#ECFDF5' },
      rejected: { label: 'Refusé', color: '#EF4444', bgcolor: '#FEF2F2' },
      expired: { label: 'Expiré', color: '#F59E0B', bgcolor: '#FFFBEB' },
    };
    const config = configs[status] || configs.draft;
    return (
      <Chip
        label={config.label}
        size="small"
        sx={{ bgcolor: config.bgcolor, color: config.color, fontWeight: 500 }}
      />
    );
  };

  const getInvoiceStatusChip = (status: string) => {
    const configs: Record<string, { label: string; color: string; bgcolor: string }> = {
      draft: { label: 'Brouillon', color: '#9CA3AF', bgcolor: '#F3F4F6' },
      sent: { label: 'Envoyée', color: '#3B82F6', bgcolor: '#EFF6FF' },
      paid: { label: 'Payée', color: '#10B981', bgcolor: '#ECFDF5' },
      partially_paid: { label: 'Partiel', color: '#F59E0B', bgcolor: '#FFFBEB' },
      overdue: { label: 'En retard', color: '#EF4444', bgcolor: '#FEF2F2' },
      cancelled: { label: 'Annulée', color: '#9CA3AF', bgcolor: '#F3F4F6' },
    };
    const config = configs[status] || configs.draft;
    return (
      <Chip
        label={config.label}
        size="small"
        sx={{ bgcolor: config.bgcolor, color: config.color, fontWeight: 500 }}
      />
    );
  };

  // Calculs des statistiques
  const quotesStats = {
    total: quotes.reduce((sum, q) => sum + q.total_amount, 0),
    accepted: quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + q.total_amount, 0),
    pending: quotes.filter(q => q.status === 'sent').reduce((sum, q) => sum + q.total_amount, 0),
  };

  const invoicesStats = {
    total: invoices.reduce((sum, i) => sum + i.total_amount, 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total_amount, 0),
    pending: invoices.filter(i => ['sent', 'partially_paid'].includes(i.status)).reduce((sum, i) => sum + (i.total_amount - i.paid_amount), 0),
    overdue: invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.total_amount, 0),
  };

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
            Comptabilité
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez vos devis, factures et clients
          </Typography>
        </div>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {tabValue === 2 && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={importLoading}
                sx={{
                  borderColor: '#F5C518',
                  color: '#F5C518',
                  '&:hover': { borderColor: '#E0B000', bgcolor: '#FEF9E7' },
                }}
              >
                {importLoading ? 'Import...' : 'Importer CRM (CSV)'}
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingClient(null);
                  resetClientForm();
                  setOpenClientDialog(true);
                }}
                sx={{
                  bgcolor: '#F5C518',
                  color: '#1A1A1A',
                  '&:hover': { bgcolor: '#E0B000' },
                }}
              >
                Nouveau Client
              </Button>
            </>
          )}
          {tabValue === 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                resetQuoteForm();
                setOpenQuoteDialog(true);
              }}
              sx={{
                bgcolor: '#F5C518',
                color: '#1A1A1A',
                '&:hover': { bgcolor: '#E0B000' },
              }}
            >
              Nouveau Devis
            </Button>
          )}
          {tabValue === 1 && (
            <Button
              variant="contained"
              startIcon={<InvoiceIcon />}
              sx={{
                bgcolor: '#F5C518',
                color: '#1A1A1A',
                '&:hover': { bgcolor: '#E0B000' },
              }}
            >
              Nouvelle Facture
            </Button>
          )}
        </Box>
      </Box>

      {/* Statistiques */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography color="text.secondary" variant="subtitle2" sx={{ mb: 1 }}>
              Devis en attente
            </Typography>
            <Typography variant="h4" sx={{ color: '#3B82F6' }}>
              {formatCurrency(quotesStats.pending, currency)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography color="text.secondary" variant="subtitle2" sx={{ mb: 1 }}>
              Devis acceptés
            </Typography>
            <Typography variant="h4" sx={{ color: '#10B981' }}>
              {formatCurrency(quotesStats.accepted, currency)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography color="text.secondary" variant="subtitle2" sx={{ mb: 1 }}>
              Factures en attente
            </Typography>
            <Typography variant="h4" sx={{ color: '#F59E0B' }}>
              {formatCurrency(invoicesStats.pending, currency)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography color="text.secondary" variant="subtitle2" sx={{ mb: 1 }}>
              Clients actifs
            </Typography>
            <Typography variant="h4" sx={{ color: '#8B5CF6' }}>
              {clients.length}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onChange={(_, v) => setTabValue(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label={`Devis (${quotes.length})`} icon={<QuoteIcon />} iconPosition="start" />
        <Tab label={`Factures (${invoices.length})`} icon={<InvoiceIcon />} iconPosition="start" />
        <Tab label={`Clients (${clients.length})`} icon={<PeopleIcon />} iconPosition="start" />
        <Tab label="Paramètres" icon={<SettingsIcon />} iconPosition="start" />
      </Tabs>

      {/* Tab Devis */}
      <TabPanel value={tabValue} index={0}>
        {/* Contrôles de tri et filtre */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <SortIcon sx={{ color: '#6B7280', fontSize: 18 }} />
          <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '0.8rem' }}>Tri :</Typography>
          <Chip
            label="Date"
            size="small"
            onClick={() => {
              if (quotesSortBy === 'date') {
                setQuotesSortOrder(quotesSortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setQuotesSortBy('date');
                setQuotesSortOrder('desc');
              }
            }}
            icon={quotesSortBy === 'date' ? (quotesSortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />) : undefined}
            sx={{
              cursor: 'pointer',
              bgcolor: quotesSortBy === 'date' ? '#F5C518' : '#F3F4F6',
              color: quotesSortBy === 'date' ? '#1A1A1A' : '#6B7280',
              '&:hover': { bgcolor: quotesSortBy === 'date' ? '#E0B000' : '#E5E7EB' },
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
          <Chip
            label="Montant"
            size="small"
            onClick={() => {
              if (quotesSortBy === 'amount') {
                setQuotesSortOrder(quotesSortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setQuotesSortBy('amount');
                setQuotesSortOrder('desc');
              }
            }}
            icon={quotesSortBy === 'amount' ? (quotesSortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />) : undefined}
            sx={{
              cursor: 'pointer',
              bgcolor: quotesSortBy === 'amount' ? '#F5C518' : '#F3F4F6',
              color: quotesSortBy === 'amount' ? '#1A1A1A' : '#6B7280',
              '&:hover': { bgcolor: quotesSortBy === 'amount' ? '#E0B000' : '#E5E7EB' },
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
          <Chip
            label="Validité"
            size="small"
            onClick={() => {
              if (quotesSortBy === 'validity') {
                setQuotesSortOrder(quotesSortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setQuotesSortBy('validity');
                setQuotesSortOrder('desc');
              }
            }}
            icon={quotesSortBy === 'validity' ? (quotesSortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />) : undefined}
            sx={{
              cursor: 'pointer',
              bgcolor: quotesSortBy === 'validity' ? '#F5C518' : '#F3F4F6',
              color: quotesSortBy === 'validity' ? '#1A1A1A' : '#6B7280',
              '&:hover': { bgcolor: quotesSortBy === 'validity' ? '#E0B000' : '#E5E7EB' },
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <FilterListIcon sx={{ color: '#6B7280', fontSize: 18 }} />
          <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '0.8rem' }}>Filtre :</Typography>
          <TextField
            type="date"
            size="small"
            value={quotesFilterDate}
            onChange={(e) => setQuotesFilterDate(e.target.value)}
            sx={{ width: 140, '& .MuiInputBase-input': { py: 0.5, fontSize: '0.875rem' } }}
          />
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <Select
              value={quotesFilterStatus}
              displayEmpty
              onChange={(e) => setQuotesFilterStatus(e.target.value)}
              sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: '0.875rem' } }}
            >
              <MenuItem value="">Statut</MenuItem>
              <MenuItem value="draft">Brouillon</MenuItem>
              <MenuItem value="sent">Envoyé</MenuItem>
              <MenuItem value="accepted">Accepté</MenuItem>
              <MenuItem value="rejected">Refusé</MenuItem>
              <MenuItem value="expired">Expiré</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="Client..."
            value={quotesFilterClient}
            onChange={(e) => setQuotesFilterClient(e.target.value)}
            sx={{ width: 120, '& .MuiInputBase-input': { py: 0.5, fontSize: '0.875rem' } }}
          />
          {(quotesFilterDate || quotesFilterStatus || quotesFilterClient) && (
            <Chip
              label="Effacer"
              size="small"
              icon={<ClearIcon />}
              onClick={() => {
                setQuotesFilterDate('');
                setQuotesFilterStatus('');
                setQuotesFilterClient('');
              }}
              sx={{ bgcolor: '#FEE2E2', color: '#DC2626', '&:hover': { bgcolor: '#FECACA' }, '& .MuiChip-icon': { color: '#DC2626' } }}
            />
          )}
          {(quotesFilterDate || quotesFilterStatus || quotesFilterClient) && (
            <Typography variant="body2" sx={{ color: '#6B7280', ml: 'auto' }}>
              {sortedQuotes.length} résultat{sortedQuotes.length > 1 ? 's' : ''}
            </Typography>
          )}
        </Box>

        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Numéro</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Validité</TableCell>
                <TableCell align="right">Montant</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedQuotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      Aucun devis. Créez votre premier devis.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : sortedQuotes.map((quote) => (
                <TableRow key={quote.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {quote.quote_number}
                    </Typography>
                  </TableCell>
                  <TableCell>{quote.client_name || '-'}</TableCell>
                  <TableCell>{new Date(quote.issue_date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>{new Date(quote.valid_until).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCurrency(quote.total_amount, currency)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={quote.status}
                        onChange={(e) => handleQuoteStatusChangeFromList(quote, e.target.value)}
                        sx={{
                          fontSize: '0.85rem',
                          '& .MuiSelect-select': { py: 0.5 },
                          bgcolor: quote.status === 'accepted' ? '#ECFDF5' :
                                   quote.status === 'sent' ? '#EFF6FF' :
                                   quote.status === 'rejected' ? '#FEF2F2' :
                                   quote.status === 'expired' ? '#FEF3C7' : '#F3F4F6',
                        }}
                      >
                        <MenuItem value="draft">Brouillon</MenuItem>
                        <MenuItem value="sent">Envoyé</MenuItem>
                        <MenuItem value="accepted">Accepté</MenuItem>
                        <MenuItem value="rejected">Refusé</MenuItem>
                        <MenuItem value="expired">Expiré</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={(e) => handleMenuOpen(e, quote.id)}>
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Dialog avertissement date dépassée */}
      <Dialog open={openExpiredWarningDialog} onClose={handleCancelExpiredQuote} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#FEF3C7', color: '#92400E' }}>
          Attention : Date de validité dépassée
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            La date de validité de ce devis est dépassée ({statusChangeQuote && new Date(statusChangeQuote.valid_until).toLocaleDateString('fr-FR')}).
          </Alert>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Voulez-vous tout de même accepter ce devis ?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Les prix indiqués dans le devis seront conservés. Si vous souhaitez modifier les prix, annulez et éditez le devis avant de l'accepter.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCancelExpiredQuote} color="inherit">
            Annuler
          </Button>
          <Button
            onClick={handleConfirmExpiredQuote}
            variant="contained"
            sx={{ bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' } }}
          >
            Accepter malgré tout
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog création de facture */}
      <Dialog open={openCreateInvoiceDialog} onClose={() => setOpenCreateInvoiceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Créer une facture ?
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Le devis <strong>{statusChangeQuote?.quote_number}</strong> va être marqué comme accepté.
            Souhaitez-vous créer automatiquement la facture correspondante ?
          </Typography>
          <TextField
            fullWidth
            type="date"
            label="Date d'échéance de la facture"
            value={invoiceDueDate}
            onChange={(e) => setInvoiceDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={handleSkipInvoiceCreation}
            color="inherit"
            disabled={creatingInvoice}
          >
            Non, juste accepter le devis
          </Button>
          <Button
            onClick={handleCreateInvoiceFromQuote}
            variant="contained"
            disabled={creatingInvoice}
            sx={{ bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' } }}
          >
            {creatingInvoice ? <CircularProgress size={20} /> : 'Oui, créer la facture'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tab Factures */}
      <TabPanel value={tabValue} index={1}>
        {/* Contrôles de tri et filtre */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <SortIcon sx={{ color: '#6B7280', fontSize: 18 }} />
          <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '0.8rem' }}>Tri :</Typography>
          <Chip
            label="Date"
            size="small"
            onClick={() => {
              if (invoicesSortBy === 'date') {
                setInvoicesSortOrder(invoicesSortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setInvoicesSortBy('date');
                setInvoicesSortOrder('desc');
              }
            }}
            icon={invoicesSortBy === 'date' ? (invoicesSortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />) : undefined}
            sx={{
              cursor: 'pointer',
              bgcolor: invoicesSortBy === 'date' ? '#F5C518' : '#F3F4F6',
              color: invoicesSortBy === 'date' ? '#1A1A1A' : '#6B7280',
              '&:hover': { bgcolor: invoicesSortBy === 'date' ? '#E0B000' : '#E5E7EB' },
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
          <Chip
            label="Montant"
            size="small"
            onClick={() => {
              if (invoicesSortBy === 'amount') {
                setInvoicesSortOrder(invoicesSortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setInvoicesSortBy('amount');
                setInvoicesSortOrder('desc');
              }
            }}
            icon={invoicesSortBy === 'amount' ? (invoicesSortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />) : undefined}
            sx={{
              cursor: 'pointer',
              bgcolor: invoicesSortBy === 'amount' ? '#F5C518' : '#F3F4F6',
              color: invoicesSortBy === 'amount' ? '#1A1A1A' : '#6B7280',
              '&:hover': { bgcolor: invoicesSortBy === 'amount' ? '#E0B000' : '#E5E7EB' },
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
          <Chip
            label="Échéance"
            size="small"
            onClick={() => {
              if (invoicesSortBy === 'due_date') {
                setInvoicesSortOrder(invoicesSortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setInvoicesSortBy('due_date');
                setInvoicesSortOrder('desc');
              }
            }}
            icon={invoicesSortBy === 'due_date' ? (invoicesSortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />) : undefined}
            sx={{
              cursor: 'pointer',
              bgcolor: invoicesSortBy === 'due_date' ? '#F5C518' : '#F3F4F6',
              color: invoicesSortBy === 'due_date' ? '#1A1A1A' : '#6B7280',
              '&:hover': { bgcolor: invoicesSortBy === 'due_date' ? '#E0B000' : '#E5E7EB' },
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <FilterListIcon sx={{ color: '#6B7280', fontSize: 18 }} />
          <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '0.8rem' }}>Filtre :</Typography>
          <TextField
            type="date"
            size="small"
            value={invoicesFilterDate}
            onChange={(e) => setInvoicesFilterDate(e.target.value)}
            sx={{ width: 140, '& .MuiInputBase-input': { py: 0.5, fontSize: '0.875rem' } }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={invoicesFilterStatus}
              displayEmpty
              onChange={(e) => setInvoicesFilterStatus(e.target.value)}
              sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: '0.875rem' } }}
            >
              <MenuItem value="">Statut</MenuItem>
              <MenuItem value="draft">Brouillon</MenuItem>
              <MenuItem value="sent">Envoyée</MenuItem>
              <MenuItem value="partially_paid">Partiel</MenuItem>
              <MenuItem value="paid">Payée</MenuItem>
              <MenuItem value="overdue">En retard</MenuItem>
              <MenuItem value="cancelled">Annulée</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="Client..."
            value={invoicesFilterClient}
            onChange={(e) => setInvoicesFilterClient(e.target.value)}
            sx={{ width: 120, '& .MuiInputBase-input': { py: 0.5, fontSize: '0.875rem' } }}
          />
          {(invoicesFilterDate || invoicesFilterStatus || invoicesFilterClient) && (
            <Chip
              label="Effacer"
              size="small"
              icon={<ClearIcon />}
              onClick={() => {
                setInvoicesFilterDate('');
                setInvoicesFilterStatus('');
                setInvoicesFilterClient('');
              }}
              sx={{ bgcolor: '#FEE2E2', color: '#DC2626', '&:hover': { bgcolor: '#FECACA' }, '& .MuiChip-icon': { color: '#DC2626' } }}
            />
          )}
          {(invoicesFilterDate || invoicesFilterStatus || invoicesFilterClient) && (
            <Typography variant="body2" sx={{ color: '#6B7280', ml: 'auto' }}>
              {sortedInvoices.length} résultat{sortedInvoices.length > 1 ? 's' : ''}
            </Typography>
          )}
        </Box>

        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Numéro</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Échéance</TableCell>
                <TableCell align="right">Montant</TableCell>
                <TableCell align="right">Payé</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      Aucune facture. Créez votre première facture.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : sortedInvoices.map((invoice) => (
                <TableRow key={invoice.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {invoice.invoice_number}
                    </Typography>
                  </TableCell>
                  <TableCell>{invoice.client_name || '-'}</TableCell>
                  <TableCell>{new Date(invoice.issue_date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>{new Date(invoice.due_date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCurrency(invoice.total_amount, currency)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: invoice.paid_amount >= invoice.total_amount ? '#10B981' :
                               invoice.paid_amount > 0 ? '#F59E0B' : '#9CA3AF'
                      }}
                    >
                      {formatCurrency(invoice.paid_amount, currency)}
                    </Typography>
                  </TableCell>
                  <TableCell>{getInvoiceStatusChip(invoice.status)}</TableCell>
                  <TableCell align="right">
                    {['sent', 'partially_paid', 'overdue'].includes(invoice.status) && (
                      <>
                        <Tooltip title="Paiement carte bancaire">
                          <IconButton
                            size="small"
                            onClick={() => {
                              const remaining = Math.round((invoice.total_amount - (invoice.paid_amount || 0)) * 100) / 100;
                              setOnsitePayment({
                                invoiceId: invoice.id,
                                amount: remaining,
                                payment_method: 'carte',
                              });
                              setOpenOnsitePaymentDialog(true);
                            }}
                            sx={{ color: '#3B82F6' }}
                          >
                            <CreditCardIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Paiement espèces">
                          <IconButton
                            size="small"
                            onClick={() => {
                              const remaining = Math.round((invoice.total_amount - (invoice.paid_amount || 0)) * 100) / 100;
                              setOnsitePayment({
                                invoiceId: invoice.id,
                                amount: remaining,
                                payment_method: 'especes',
                              });
                              setOpenOnsitePaymentDialog(true);
                            }}
                            sx={{ color: '#10B981' }}
                          >
                            <LocalAtmIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Associer à une transaction bancaire">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenPaymentDialog(invoice)}
                            sx={{ color: '#F59E0B' }}
                          >
                            <LinkIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    <IconButton size="small" onClick={(e) => handleMenuOpen(e, invoice.id)}>
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab Clients */}
      <TabPanel value={tabValue} index={2}>
        {importResult && (
          <Alert
            severity={importResult.errors.length > 0 && importResult.imported === 0 ? 'error' : 'success'}
            sx={{ mb: 2 }}
            onClose={() => setImportResult(null)}
          >
            {importResult.imported} client(s) importé(s), {importResult.skipped} ignoré(s)
            {importResult.errors.length > 0 && (
              <Box sx={{ mt: 1 }}>
                {importResult.errors.map((err, i) => (
                  <Typography key={i} variant="caption" display="block">{err}</Typography>
                ))}
              </Box>
            )}
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <TextField
            placeholder="Rechercher un client..."
            size="small"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#9CA3AF' }} />
                </InputAdornment>
              ),
            }}
            sx={{ width: 300 }}
          />
        </Box>

        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Entreprise</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Téléphone</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id} hover>
                  <TableCell>
                    <Chip
                      icon={client.client_type === 'professional' ? <BusinessIcon /> : <PersonIcon />}
                      label={client.client_type === 'professional' ? 'Pro' : 'Perso'}
                      size="small"
                      sx={{
                        bgcolor: client.client_type === 'professional' ? '#DBEAFE' : '#F3E8FF',
                        color: client.client_type === 'professional' ? '#1D4ED8' : '#7C3AED',
                        '& .MuiChip-icon': {
                          color: 'inherit',
                        },
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {client.first_name ? `${client.first_name} ${client.name}` : client.name}
                    </Typography>
                    {client.client_type === 'professional' && client.contact_position && (
                      <Typography variant="caption" color="text.secondary">
                        {client.contact_position}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.company_name ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <BusinessIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />
                        {client.company_name}
                      </Box>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{client.email || '-'}</TableCell>
                  <TableCell>{client.phone || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleEditClient(client)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDeleteClient(client.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      Aucun client. Importez votre CRM ou créez votre premier client.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab Paramètres */}
      <TabPanel value={tabValue} index={3}>
        {/* Sub-tabs pour Paramètres */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={settingsTabValue}
            onChange={(_, newValue) => setSettingsTabValue(newValue)}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.95rem',
              },
              '& .Mui-selected': {
                color: '#F5C518',
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#F5C518',
              },
            }}
          >
            <Tab label="Mail" icon={<EmailIcon />} iconPosition="start" />
            <Tab label="Personnalisation" icon={<SettingsIcon />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* Sub-tab Mail */}
        {settingsTabValue === 0 && (
          <Grid container spacing={3}>
            {/* Configuration SMTP pour envoi d'emails */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <EmailIcon sx={{ color: '#F5C518' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Configuration Email (SMTP)
                  </Typography>
                  {companySettings?.smtp_configured && (
                    <Chip
                      label="Configuré"
                      size="small"
                      sx={{ bgcolor: '#22C55E', color: 'white', fontWeight: 500 }}
                    />
                  )}
                </Box>
                <Typography variant="body2" sx={{ color: '#6B7280', mb: 3 }}>
                  Configurez votre serveur SMTP pour envoyer les devis et factures par email directement depuis l&apos;application.
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Serveur SMTP"
                      placeholder="smtp.gmail.com, smtp.office365.com..."
                      value={settingsForm.smtp_host || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, smtp_host: e.target.value })}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon sx={{ color: '#9CA3AF', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Port SMTP"
                      type="number"
                      placeholder="587"
                      value={settingsForm.smtp_port || 587}
                      onChange={(e) => setSettingsForm({ ...settingsForm, smtp_port: parseInt(e.target.value) || 587 })}
                      helperText="587 (TLS) ou 465 (SSL)"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Nom d'utilisateur SMTP"
                      placeholder="votre.email@gmail.com"
                      value={settingsForm.smtp_user || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, smtp_user: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Mot de passe SMTP"
                      type={showSmtpPassword ? 'text' : 'password'}
                      placeholder={companySettings?.smtp_configured ? '••••••••' : 'Mot de passe ou App password'}
                      value={settingsForm.smtp_password || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, smtp_password: e.target.value })}
                      helperText="Pour Gmail, utilisez un mot de passe d'application"
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                            >
                              {showSmtpPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Email d'expédition"
                      placeholder="contact@votreentreprise.com"
                      value={settingsForm.smtp_from_email || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, smtp_from_email: e.target.value })}
                      helperText="Adresse qui apparaîtra comme expéditeur"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Nom d'expédition"
                      placeholder="Mon Entreprise"
                      value={settingsForm.smtp_from_name || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, smtp_from_name: e.target.value })}
                      helperText="Nom qui apparaîtra comme expéditeur"
                    />
                  </Grid>
                </Grid>

                <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                  <Typography variant="body2">
                    <strong>Gmail :</strong> Activez l&apos;authentification à 2 facteurs puis créez un &quot;Mot de passe d&apos;application&quot; dans les paramètres de sécurité Google.
                    <br />
                    <strong>Office 365 :</strong> Utilisez smtp.office365.com avec le port 587.
                  </Typography>
                </Alert>
              </Paper>
            </Grid>

            {/* Message d'email par défaut pour les factures */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Message d&apos;email par défaut pour les factures
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  label="Message par défaut"
                  placeholder={`Bonjour,

Veuillez trouver ci-joint la facture {numero_facture} d'un montant de {montant} {devise}.

Cette facture est à régler avant le {date_echeance}.

N'hésitez pas à nous contacter pour toute question.

Cordialement,
{nom_entreprise}`}
                  value={settingsForm.default_invoice_email_message || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, default_invoice_email_message: e.target.value })}
                />
              </Paper>
            </Grid>

            {/* Message d'email par défaut pour les devis */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Message d&apos;email par défaut pour les devis
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  label="Message par défaut"
                  placeholder={`Bonjour,

Veuillez trouver ci-joint le devis {numero_devis} d'un montant de {montant} {devise}.

Ce devis est valable jusqu'au {date_validite}.

N'hésitez pas à nous contacter pour toute question.

Cordialement,
{nom_entreprise}`}
                  value={settingsForm.default_quote_email_message || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, default_quote_email_message: e.target.value })}
                />
              </Paper>
            </Grid>

            {/* Variables disponibles */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: '#374151' }}>
                  Variables disponibles pour les emails
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#6B7280', mb: 1, display: 'block' }}>
                      Factures
                    </Typography>
                    <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, border: 'none' } }}>
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontFamily: 'monospace', color: '#F5C518', fontWeight: 600, width: '45%' }}>
                            {'{numero_facture}'}
                          </TableCell>
                          <TableCell sx={{ color: '#6B7280', fontSize: '0.8rem' }}>
                            Numéro de la facture
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontFamily: 'monospace', color: '#F5C518', fontWeight: 600 }}>
                            {'{date_echeance}'}
                          </TableCell>
                          <TableCell sx={{ color: '#6B7280', fontSize: '0.8rem' }}>
                            Date limite de paiement
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#6B7280', mb: 1, display: 'block' }}>
                      Devis
                    </Typography>
                    <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, border: 'none' } }}>
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontFamily: 'monospace', color: '#F5C518', fontWeight: 600, width: '45%' }}>
                            {'{numero_devis}'}
                          </TableCell>
                          <TableCell sx={{ color: '#6B7280', fontSize: '0.8rem' }}>
                            Numéro du devis
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontFamily: 'monospace', color: '#F5C518', fontWeight: 600 }}>
                            {'{date_validite}'}
                          </TableCell>
                          <TableCell sx={{ color: '#6B7280', fontSize: '0.8rem' }}>
                            Date de validité du devis
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#6B7280', mb: 1, display: 'block' }}>
                      Variables communes
                    </Typography>
                    <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, border: 'none' } }}>
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontFamily: 'monospace', color: '#F5C518', fontWeight: 600, width: '22%' }}>
                            {'{montant}'}
                          </TableCell>
                          <TableCell sx={{ color: '#6B7280', fontSize: '0.8rem', width: '28%' }}>
                            Montant total TTC
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', color: '#F5C518', fontWeight: 600, width: '22%' }}>
                            {'{devise}'}
                          </TableCell>
                          <TableCell sx={{ color: '#6B7280', fontSize: '0.8rem' }}>
                            Devise (XPF, EUR...)
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontFamily: 'monospace', color: '#F5C518', fontWeight: 600 }}>
                            {'{nom_entreprise}'}
                          </TableCell>
                          <TableCell sx={{ color: '#6B7280', fontSize: '0.8rem' }}>
                            Nom de votre entreprise
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', color: '#F5C518', fontWeight: 600 }}>
                            {'{nom_client}'}
                          </TableCell>
                          <TableCell sx={{ color: '#6B7280', fontSize: '0.8rem' }}>
                            Nom du client
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* Bouton de sauvegarde pour Mail */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  startIcon={savingSettings ? <CircularProgress size={20} /> : <CheckIcon />}
                  sx={{
                    bgcolor: '#F5C518',
                    color: '#1A1A1A',
                    '&:hover': { bgcolor: '#E0B000' },
                    px: 4,
                  }}
                >
                  {savingSettings ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        )}

        {/* Sub-tab Personnalisation */}
        {settingsTabValue === 1 && (
          <Grid container spacing={3}>
            {/* Personnalisation visuelle */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Personnalisation des documents
                </Typography>

              {/* Logo */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#6B7280' }}>
                  Logo pour devis/factures
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {companySettings?.logo_url ? (
                    <Box
                      component="img"
                      src={`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}${companySettings.logo_url}`}
                      sx={{
                        width: 100,
                        height: 100,
                        objectFit: 'contain',
                        border: '1px solid #E5E7EB',
                        borderRadius: 2,
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 100,
                        height: 100,
                        border: '2px dashed #E5E7EB',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9CA3AF',
                      }}
                    >
                      <FileIcon sx={{ fontSize: 32 }} />
                    </Box>
                  )}
                  <Box>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      ref={settingsLogoInputRef}
                      onChange={handleUploadSettingsLogo}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => settingsLogoInputRef.current?.click()}
                      disabled={uploadingSettingsLogo}
                      sx={{ mr: 1 }}
                    >
                      {uploadingSettingsLogo ? 'Envoi...' : 'Changer'}
                    </Button>
                    {companySettings?.logo_url && (
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={handleDeleteSettingsLogo}
                      >
                        Supprimer
                      </Button>
                    )}
                  </Box>
                </Box>
              </Box>

              {/* Couleurs */}
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: '#6B7280' }}>
                    Couleur principale
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input
                      type="color"
                      value={settingsForm.primary_color || '#F5C518'}
                      onChange={(e) => setSettingsForm({ ...settingsForm, primary_color: e.target.value })}
                      style={{ width: 40, height: 40, border: 'none', cursor: 'pointer' }}
                    />
                    <TextField
                      size="small"
                      value={settingsForm.primary_color || '#F5C518'}
                      onChange={(e) => setSettingsForm({ ...settingsForm, primary_color: e.target.value })}
                      sx={{ width: 100 }}
                    />
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: '#6B7280' }}>
                    Couleur secondaire
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input
                      type="color"
                      value={settingsForm.secondary_color || '#1A1A1A'}
                      onChange={(e) => setSettingsForm({ ...settingsForm, secondary_color: e.target.value })}
                      style={{ width: 40, height: 40, border: 'none', cursor: 'pointer' }}
                    />
                    <TextField
                      size="small"
                      value={settingsForm.secondary_color || '#1A1A1A'}
                      onChange={(e) => setSettingsForm({ ...settingsForm, secondary_color: e.target.value })}
                      sx={{ width: 100 }}
                    />
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: '#6B7280' }}>
                    Texte sur fond coloré
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input
                      type="color"
                      value={settingsForm.text_color || '#FFFFFF'}
                      onChange={(e) => setSettingsForm({ ...settingsForm, text_color: e.target.value })}
                      style={{ width: 40, height: 40, border: 'none', cursor: 'pointer' }}
                    />
                    <TextField
                      size="small"
                      value={settingsForm.text_color || '#FFFFFF'}
                      onChange={(e) => setSettingsForm({ ...settingsForm, text_color: e.target.value })}
                      sx={{ width: 100 }}
                    />
                  </Box>
                </Grid>
              </Grid>

              {/* Numérotation */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, color: '#6B7280' }}>
                  Numérotation automatique
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Préfixe devis"
                      value={settingsForm.quote_prefix || 'DEV-'}
                      onChange={(e) => setSettingsForm({ ...settingsForm, quote_prefix: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Prochain n° devis"
                      type="number"
                      value={settingsForm.quote_next_number || 1}
                      onChange={(e) => setSettingsForm({ ...settingsForm, quote_next_number: parseInt(e.target.value) })}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Préfixe facture"
                      value={settingsForm.invoice_prefix || 'FAC-'}
                      onChange={(e) => setSettingsForm({ ...settingsForm, invoice_prefix: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Prochain n° facture"
                      type="number"
                      value={settingsForm.invoice_next_number || 1}
                      onChange={(e) => setSettingsForm({ ...settingsForm, invoice_next_number: parseInt(e.target.value) })}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          </Grid>

          {/* Coordonnées bancaires (RIB multiples) */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Coordonnées bancaires (RIB)
                </Typography>
                <IconButton
                  onClick={() => handleOpenBankAccountDialog()}
                  sx={{
                    bgcolor: '#F5C518',
                    color: '#1A1A1A',
                    '&:hover': { bgcolor: '#E0B000' },
                  }}
                  size="small"
                >
                  <AddIcon />
                </IconButton>
              </Box>

              {bankAccounts.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, color: '#6B7280' }}>
                  <PaymentIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                  <Typography variant="body2">
                    Aucun compte bancaire configuré
                  </Typography>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenBankAccountDialog()}
                    sx={{ mt: 2, color: '#F5C518' }}
                  >
                    Ajouter un RIB
                  </Button>
                </Box>
              ) : (
                <List sx={{ p: 0 }}>
                  {bankAccounts.map((account, index) => (
                    <Box key={account.id}>
                      {index > 0 && <Divider />}
                      <ListItem
                        sx={{ px: 0 }}
                        secondaryAction={
                          <Box>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenBankAccountDialog(account)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteBankAccount(account.id)}
                              sx={{ color: '#EF4444' }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        }
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <PaymentIcon sx={{ color: account.is_default ? '#F5C518' : '#6B7280' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2">
                                {account.label || account.bank_name || 'Compte bancaire'}
                              </Typography>
                              {account.is_default && (
                                <Chip label="Par défaut" size="small" sx={{ bgcolor: '#F5C518', color: '#1A1A1A', height: 20, fontSize: '0.7rem' }} />
                              )}
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" sx={{ color: '#6B7280' }}>
                              {account.iban ? `IBAN: ${account.iban.slice(0, 8)}...` : 'IBAN non renseigné'}
                              {account.bank_name && ` • ${account.bank_name}`}
                            </Typography>
                          }
                        />
                      </ListItem>
                    </Box>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>

          {/* Textes par défaut */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Textes par défaut
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Conditions générales pour les devis (CGV)"
                    value={settingsForm.default_quote_terms || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, default_quote_terms: e.target.value })}
                    placeholder="Ex: Ce devis est valable 30 jours. Acompte de 30% à la commande..."
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Conditions générales pour les factures"
                    value={settingsForm.default_invoice_terms || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, default_invoice_terms: e.target.value })}
                    placeholder="Ex: Paiement à 30 jours. Pénalités de retard : 3 fois le taux d'intérêt légal..."
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Notes par défaut pour les devis"
                    value={settingsForm.default_quote_notes || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, default_quote_notes: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Notes par défaut pour les factures"
                    value={settingsForm.default_invoice_notes || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, default_invoice_notes: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Conditions de paiement par défaut"
                    value={settingsForm.default_payment_terms || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, default_payment_terms: e.target.value })}
                    placeholder="Ex: Paiement à réception de facture par virement bancaire"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Pied de page des documents"
                    value={settingsForm.document_footer || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, document_footer: e.target.value })}
                    placeholder="Ex: SAS au capital de 10 000€ - RCS Paris XXX XXX XXX - APE XXXX"
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Bouton de sauvegarde */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                startIcon={savingSettings ? <CircularProgress size={20} /> : <CheckIcon />}
                sx={{
                  bgcolor: '#F5C518',
                  color: '#1A1A1A',
                  '&:hover': { bgcolor: '#E0B000' },
                  px: 4,
                }}
              >
                {savingSettings ? 'Enregistrement...' : 'Enregistrer les paramètres'}
              </Button>
            </Box>
          </Grid>
        </Grid>
        )}
      </TabPanel>

      {/* Menu contextuel */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { borderRadius: 2, minWidth: 180 },
        }}
      >
        {tabValue === 0 ? (
          // Menu pour les devis
          <>
            <MenuItem onClick={handleViewQuote} disabled={loadingQuote}>
              <ViewIcon sx={{ mr: 1, fontSize: 18 }} /> {loadingQuote ? 'Chargement...' : 'Voir'}
            </MenuItem>
            <MenuItem onClick={handleOpenEmailDialog}>
              <SendIcon sx={{ mr: 1, fontSize: 18 }} /> Envoyer par email
            </MenuItem>
            <MenuItem onClick={handleDownloadPdf} disabled={downloadingPdf}>
              <DownloadIcon sx={{ mr: 1, fontSize: 18 }} /> {downloadingPdf ? 'Téléchargement...' : 'Télécharger PDF'}
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleMenuClose} sx={{ color: '#EF4444' }}>
              <DeleteIcon sx={{ mr: 1, fontSize: 18 }} /> Supprimer
            </MenuItem>
          </>
        ) : tabValue === 1 ? (
          // Menu pour les factures
          <>
            <MenuItem onClick={handleViewInvoice} disabled={loadingInvoice}>
              <ViewIcon sx={{ mr: 1, fontSize: 18 }} /> {loadingInvoice ? 'Chargement...' : 'Voir'}
            </MenuItem>
            <MenuItem onClick={() => handleOpenInvoiceEmailDialog()}>
              <SendIcon sx={{ mr: 1, fontSize: 18 }} /> Envoyer par email
            </MenuItem>
            <MenuItem onClick={() => handleDownloadInvoicePdf()} disabled={downloadingPdf}>
              <DownloadIcon sx={{ mr: 1, fontSize: 18 }} /> {downloadingPdf ? 'Téléchargement...' : 'Télécharger PDF'}
            </MenuItem>
            <MenuItem onClick={() => {
              const invoice = invoices.find(i => i.id === selectedItemId);
              if (invoice && invoice.status !== 'paid' && invoice.status !== 'cancelled') {
                setOnsitePayment({
                  invoiceId: invoice.id,
                  amount: Math.round((invoice.total_amount - (invoice.paid_amount || 0)) * 100) / 100,
                  payment_method: 'carte',
                });
                setOpenOnsitePaymentDialog(true);
              }
              handleMenuClose();
            }}>
              <PaymentIcon sx={{ mr: 1, fontSize: 18, color: '#10B981' }} /> Paiement reçu
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleMenuClose} sx={{ color: '#EF4444' }}>
              <DeleteIcon sx={{ mr: 1, fontSize: 18 }} /> Supprimer
            </MenuItem>
          </>
        ) : null}
      </Menu>

      {/* Dialog création/édition client */}
      <Dialog
        open={openClientDialog}
        onClose={() => {
          setOpenClientDialog(false);
          setEditingClient(null);
          resetClientForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingClient ? 'Modifier le client' : 'Nouveau client'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Choix du type de client */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#6B7280' }}>
                Type de client *
              </Typography>
              <ToggleButtonGroup
                value={newClient.client_type}
                exclusive
                onChange={(_, value) => value && setNewClient({ ...newClient, client_type: value })}
                fullWidth
                sx={{
                  '& .MuiToggleButton-root': {
                    py: 1.5,
                    '&.Mui-selected': {
                      bgcolor: '#F5C518',
                      color: '#1A1A1A',
                      '&:hover': { bgcolor: '#E0B000' },
                    },
                  },
                }}
              >
                <ToggleButton value="personal">
                  <PersonIcon sx={{ mr: 1 }} />
                  Particulier
                </ToggleButton>
                <ToggleButton value="professional">
                  <BusinessIcon sx={{ mr: 1 }} />
                  Professionnel
                </ToggleButton>
              </ToggleButtonGroup>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            {/* Champs pour PARTICULIER */}
            {newClient.client_type === 'personal' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nom *"
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Prénom"
                    value={newClient.first_name}
                    onChange={(e) => setNewClient({ ...newClient, first_name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Téléphone"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="email"
                    label="Email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Notes"
                    value={newClient.notes}
                    onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                  />
                </Grid>
              </>
            )}

            {/* Champs pour PROFESSIONNEL */}
            {newClient.client_type === 'professional' && (
              <>
                {/* Informations entreprise */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ color: '#6B7280', mb: -1 }}>
                    Informations entreprise
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nom de l'entreprise *"
                    value={newClient.company_name}
                    onChange={(e) => setNewClient({ ...newClient, company_name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="N° TVA"
                    value={newClient.vat_number}
                    onChange={(e) => setNewClient({ ...newClient, vat_number: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="SIRET"
                    value={newClient.siret}
                    onChange={(e) => setNewClient({ ...newClient, siret: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Adresse"
                    value={newClient.address}
                    onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Code postal"
                    value={newClient.postal_code}
                    onChange={(e) => setNewClient({ ...newClient, postal_code: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Ville"
                    value={newClient.city}
                    onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Pays"
                    value={newClient.country}
                    onChange={(e) => setNewClient({ ...newClient, country: e.target.value })}
                  />
                </Grid>

                {/* Contact */}
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" sx={{ color: '#6B7280', mt: 1 }}>
                    Contact principal
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nom du contact *"
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Prénom du contact"
                    value={newClient.first_name}
                    onChange={(e) => setNewClient({ ...newClient, first_name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    type="email"
                    label="Email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Téléphone"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Fonction"
                    value={newClient.contact_position}
                    onChange={(e) => setNewClient({ ...newClient, contact_position: e.target.value })}
                  />
                </Grid>

                {/* Notes */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Notes"
                    value={newClient.notes}
                    onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                  />
                </Grid>

                {/* Pièces jointes */}
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: '#6B7280' }}>
                      Pièces jointes (KBIS, RIB, contrats...)
                    </Typography>
                    <input
                      type="file"
                      ref={attachmentInputRef}
                      onChange={handleAddAttachment}
                      style={{ display: 'none' }}
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                      multiple
                    />
                    <Button
                      size="small"
                      startIcon={<AttachFileIcon />}
                      onClick={() => attachmentInputRef.current?.click()}
                      sx={{ color: '#F5C518' }}
                    >
                      Ajouter
                    </Button>
                  </Box>

                  {/* Pièces jointes existantes (en édition) */}
                  {editingClient && editingClient.attachments && editingClient.attachments.length > 0 && (
                    <List dense sx={{ bgcolor: '#F9FAFB', borderRadius: 2, mt: 1 }}>
                      {editingClient.attachments.map((attachment) => (
                        <ListItem key={attachment.id}>
                          <ListItemIcon>
                            <FileIcon sx={{ color: '#6B7280' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={attachment.filename}
                            secondary={attachment.file_size ? `${(attachment.file_size / 1024).toFixed(1)} Ko` : ''}
                          />
                          <ListItemSecondaryAction>
                            <IconButton
                              size="small"
                              onClick={() => handleDownloadAttachment(attachment.id, attachment.filename)}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteExistingAttachment(attachment.id)}
                              sx={{ color: '#EF4444' }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  )}

                  {/* Nouvelles pièces jointes (en attente d'upload) */}
                  {pendingAttachments.length > 0 && (
                    <List dense sx={{ bgcolor: '#FEF3C7', borderRadius: 2, mt: 1 }}>
                      <ListItem>
                        <ListItemText
                          primary={<Typography variant="caption" sx={{ fontWeight: 600 }}>Nouveaux fichiers à ajouter</Typography>}
                        />
                      </ListItem>
                      {pendingAttachments.map((file, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <FileIcon sx={{ color: '#F59E0B' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={file.name}
                            secondary={`${(file.size / 1024).toFixed(1)} Ko`}
                          />
                          <ListItemSecondaryAction>
                            <IconButton
                              size="small"
                              onClick={() => handleRemovePendingAttachment(index)}
                              sx={{ color: '#EF4444' }}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenClientDialog(false);
            setEditingClient(null);
            resetClientForm();
          }}>
            Annuler
          </Button>
          <Button
            onClick={() => handleCreateClient()}
            variant="contained"
            disabled={
              !newClient.name ||
              (newClient.client_type === 'professional' && !newClient.company_name) ||
              uploadingAttachment
            }
            sx={{
              bgcolor: '#F5C518',
              color: '#1A1A1A',
              '&:hover': { bgcolor: '#E0B000' },
            }}
          >
            {uploadingAttachment ? (
              <CircularProgress size={20} sx={{ color: '#1A1A1A' }} />
            ) : (
              editingClient ? 'Modifier' : 'Créer'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog liaison paiement */}
      <Dialog
        open={openPaymentDialog}
        onClose={() => {
          setOpenPaymentDialog(false);
          setSelectedInvoice(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaymentIcon sx={{ color: '#10B981' }} />
            Associer un paiement
          </Box>
          {selectedInvoice && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Facture {selectedInvoice.invoice_number} - Reste à payer: {formatCurrency(selectedInvoice.total_amount - selectedInvoice.paid_amount, currency)}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {loadingTransactions ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <LinearProgress />
              <Typography sx={{ mt: 2 }} color="text.secondary">
                Chargement des transactions...
              </Typography>
            </Box>
          ) : availableTransactions.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              Aucune transaction de revenu disponible. Importez d'abord vos relevés bancaires.
            </Alert>
          ) : (
            <TableContainer sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Montant</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {availableTransactions.map((tx) => (
                    <TableRow key={tx.id} hover>
                      <TableCell>
                        {new Date(tx.transaction_date).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                          {tx.description}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#10B981' }}>
                          {formatCurrency(tx.amount, currency)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<LinkIcon />}
                          onClick={() => handleLinkPayment(tx.id)}
                          sx={{
                            borderColor: '#10B981',
                            color: '#10B981',
                            '&:hover': { borderColor: '#059669', bgcolor: '#ECFDF5' },
                          }}
                        >
                          Lier
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenPaymentDialog(false);
            setSelectedInvoice(null);
          }}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog création de devis */}
      <Dialog
        open={openQuoteDialog}
        onClose={() => {
          setOpenQuoteDialog(false);
          resetQuoteForm();
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <QuoteIcon sx={{ color: '#F5C518' }} />
            Nouveau Devis
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Le numéro de devis sera généré automatiquement
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={3}>
            {/* Informations générales */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ color: '#6B7280', mb: 2, fontWeight: 600 }}>
                Informations générales
              </Typography>
            </Grid>

            {/* Client */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Autocomplete
                  sx={{ flex: 1 }}
                  freeSolo
                  options={clients}
                  value={selectedClient}
                  inputValue={clientNameInput}
                  onInputChange={(_, newInputValue) => setClientNameInput(newInputValue)}
                  onChange={(_, newValue) => {
                    if (typeof newValue === 'string') {
                      // L'utilisateur a tapé un nom libre
                      setSelectedClient(null);
                      setClientNameInput(newValue);
                    } else {
                      setSelectedClient(newValue);
                      if (newValue) {
                        const label = newValue.client_type === 'professional' && newValue.company_name
                          ? `${newValue.company_name} (${newValue.first_name ? newValue.first_name + ' ' : ''}${newValue.name})`
                          : newValue.first_name ? `${newValue.first_name} ${newValue.name}` : newValue.name;
                        setClientNameInput(label);
                      }
                    }
                  }}
                  getOptionLabel={(option) => {
                    if (typeof option === 'string') return option;
                    if (option.client_type === 'professional' && option.company_name) {
                      return `${option.company_name} (${option.first_name ? option.first_name + ' ' : ''}${option.name})`;
                    }
                    return option.first_name ? `${option.first_name} ${option.name}` : option.name;
                  }}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {option.client_type === 'professional' && option.company_name
                            ? option.company_name
                            : `${option.first_name ? option.first_name + ' ' : ''}${option.name}`}
                        </Typography>
                        {option.client_type === 'professional' && option.company_name && (
                          <Typography variant="caption" color="text.secondary">
                            Contact: {option.first_name ? option.first_name + ' ' : ''}{option.name}
                          </Typography>
                        )}
                        {option.email && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {option.email}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Client"
                      placeholder="Tapez un nom ou sélectionnez"
                      helperText={selectedClient ? 'Client existant sélectionné' : clientNameInput ? 'Nouveau nom de client' : 'Optionnel'}
                    />
                  )}
                  isOptionEqualToValue={(option, value) => {
                    if (typeof option === 'string' || typeof value === 'string') return false;
                    return option.id === value.id;
                  }}
                />
                <IconButton
                  onClick={() => {
                    setEditingClient(null);
                    resetClientForm();
                    setOpenClientDialog(true);
                  }}
                  title="Créer un nouveau client"
                  sx={{
                    bgcolor: '#F5C518',
                    color: '#1A1A1A',
                    '&:hover': { bgcolor: '#E0B000' },
                    alignSelf: 'flex-start',
                    mt: 1,
                  }}
                >
                  <PersonAddIcon />
                </IconButton>
              </Box>
            </Grid>

            {/* Dates */}
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Date d'émission"
                value={quoteForm.issue_date}
                onChange={(e) => setQuoteForm({ ...quoteForm, issue_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Valide jusqu'au"
                value={quoteForm.valid_until}
                onChange={(e) => setQuoteForm({ ...quoteForm, valid_until: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12} md={10}>
              <TextField
                fullWidth
                label="Description / Objet du devis"
                value={quoteForm.description}
                onChange={(e) => setQuoteForm({ ...quoteForm, description: e.target.value })}
                placeholder="Ex: Prestation de conseil en marketing digital"
              />
            </Grid>

            {/* Lignes du devis */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#6B7280', fontWeight: 600 }}>
                  Produits / Services
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<SettingsIcon />}
                    onClick={() => setOpenVatDialog(true)}
                    sx={{ color: '#6B7280' }}
                  >
                    Taux TVA
                  </Button>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addQuoteLineItem}
                    sx={{ color: '#F5C518' }}
                  >
                    Ajouter une ligne
                  </Button>
                </Box>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }} align="center">Qté</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 120 }} align="right">Prix unit. HT</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 90 }} align="center">TVA</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 120 }} align="right">Prix unit. TTC</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 100 }} align="right">Total TTC</TableCell>
                      <TableCell sx={{ width: 40 }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {quoteLineItems.map((item, index) => {
                      const lineHT = item.quantity * item.unit_price;
                      const lineVat = lineHT * ((item.vat_rate || 0) / 100);
                      const lineTTC = lineHT + lineVat;
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) => updateQuoteLineItem(index, 'description', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              inputProps={{ min: 1, step: 1 }}
                              value={item.quantity}
                              onChange={(e) => updateQuoteLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              sx={{ '& input': { textAlign: 'center' }, width: 60 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              inputProps={{ min: 0, step: 0.01 }}
                              value={item.unit_price || ''}
                              onChange={(e) => updateQuoteLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              placeholder="HT"
                              sx={{ '& input': { textAlign: 'right' }, width: 100 }}
                            />
                          </TableCell>
                          <TableCell>
                            <FormControl size="small">
                              <Select
                                value={item.vat_rate ?? 0}
                                onChange={(e) => updateQuoteLineItem(index, 'vat_rate', Number(e.target.value))}
                                sx={{ minWidth: 80 }}
                              >
                                {vatRates.length > 0 ? (
                                  vatRates.map((rate) => (
                                    <MenuItem key={rate.id} value={rate.rate}>
                                      {rate.rate}%
                                    </MenuItem>
                                  ))
                                ) : (
                                  <>
                                    <MenuItem value={0}>0%</MenuItem>
                                    <MenuItem value={5.5}>5,5%</MenuItem>
                                    <MenuItem value={10}>10%</MenuItem>
                                    <MenuItem value={20}>20%</MenuItem>
                                  </>
                                )}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              inputProps={{ min: 0, step: 0.01 }}
                              value={item.unit_price_ttc || ''}
                              onChange={(e) => updateQuoteLineItem(index, 'unit_price_ttc', parseFloat(e.target.value) || 0)}
                              placeholder="TTC"
                              sx={{ '& input': { textAlign: 'right' }, width: 100 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#F5C518' }}>
                              {formatCurrency(lineTTC, currency)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => removeQuoteLineItem(index)}
                              disabled={quoteLineItems.length <= 1}
                              sx={{ color: '#EF4444' }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Totaux */}
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Box sx={{ width: 300 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Sous-total HT</Typography>
                    <Typography variant="body2">{formatCurrency(calculateQuoteTotals().subtotal, currency)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">TVA (multi-taux)</Typography>
                    <Typography variant="body2">{formatCurrency(calculateQuoteTotals().taxAmount, currency)}</Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>Total TTC</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: '#F5C518' }}>
                      {formatCurrency(calculateQuoteTotals().total, currency)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>

            {/* Notes et conditions */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes (visible sur le devis)"
                value={quoteForm.notes}
                onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                placeholder="Informations complémentaires pour le client..."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Conditions"
                value={quoteForm.terms}
                onChange={(e) => setQuoteForm({ ...quoteForm, terms: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E5E7EB' }}>
          <Button
            onClick={() => {
              setOpenQuoteDialog(false);
              resetQuoteForm();
            }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateQuote}
            disabled={savingQuote || quoteLineItems.every(item => !item.description || item.unit_price <= 0)}
            sx={{
              bgcolor: '#F5C518',
              color: '#1A1A1A',
              '&:hover': { bgcolor: '#E0B000' },
            }}
          >
            {savingQuote ? <CircularProgress size={20} sx={{ color: '#1A1A1A' }} /> : 'Créer le devis'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog paramètres TVA */}
      <Dialog
        open={openVatDialog}
        onClose={() => {
          setOpenVatDialog(false);
          setEditingVatRate(null);
          setNewVatRate({ name: '', rate: 0, description: '' });
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon sx={{ color: '#F5C518' }} />
            Paramètres des taux de TVA
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Configurez les taux de TVA selon votre pays
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {vatRates.length === 0 && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Aucun taux de TVA configuré. Chargez les taux par défaut de votre pays :
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {[
                  { code: 'FR', label: 'France' },
                  { code: 'BE', label: 'Belgique' },
                  { code: 'CH', label: 'Suisse' },
                  { code: 'DE', label: 'Allemagne' },
                  { code: 'ES', label: 'Espagne' },
                  { code: 'IT', label: 'Italie' },
                  { code: 'LU', label: 'Luxembourg' },
                  { code: 'MA', label: 'Maroc' },
                  { code: 'NC', label: 'Nouvelle-Calédonie' },
                ].map((country) => (
                  <Button
                    key={country.code}
                    size="small"
                    variant="outlined"
                    onClick={() => handleSeedDefaultVatRates(country.code)}
                    sx={{ borderColor: '#F5C518', color: '#F5C518' }}
                  >
                    {country.label}
                  </Button>
                ))}
              </Box>
            </Alert>
          )}

          {/* Liste des taux existants */}
          {vatRates.length > 0 && (
            <TableContainer sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Nom</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Taux</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Par défaut</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vatRates.map((rate) => (
                    <TableRow key={rate.id}>
                      <TableCell>{rate.name}</TableCell>
                      <TableCell align="center">
                        <Chip label={`${rate.rate}%`} size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {rate.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {rate.is_default && (
                          <Chip label="Par défaut" size="small" color="primary" />
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingVatRate(rate);
                            setNewVatRate({
                              name: rate.name,
                              rate: rate.rate,
                              description: rate.description || '',
                              is_default: rate.is_default,
                            });
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteVatRate(rate.id)}
                          sx={{ color: '#EF4444' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Formulaire d'ajout/modification */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ color: '#6B7280', mb: 2, fontWeight: 600 }}>
            {editingVatRate ? 'Modifier le taux' : 'Ajouter un nouveau taux'}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Nom *"
                value={newVatRate.name}
                onChange={(e) => setNewVatRate({ ...newVatRate, name: e.target.value })}
                placeholder="Ex: TVA normale"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Taux (%) *"
                value={newVatRate.rate}
                onChange={(e) => setNewVatRate({ ...newVatRate, rate: parseFloat(e.target.value) || 0 })}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField
                fullWidth
                size="small"
                label="Description"
                value={newVatRate.description}
                onChange={(e) => setNewVatRate({ ...newVatRate, description: e.target.value })}
                placeholder="Ex: Taux standard"
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  onClick={handleSaveVatRate}
                  disabled={!newVatRate.name || savingVatRate}
                  sx={{
                    bgcolor: '#F5C518',
                    color: '#1A1A1A',
                    '&:hover': { bgcolor: '#E0B000' },
                  }}
                >
                  {savingVatRate ? <CircularProgress size={20} /> : editingVatRate ? 'Modifier' : 'Ajouter'}
                </Button>
                {editingVatRate && (
                  <Button
                    onClick={() => {
                      setEditingVatRate(null);
                      setNewVatRate({ name: '', rate: 0, description: '' });
                    }}
                  >
                    Annuler
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E5E7EB' }}>
          <Button onClick={() => {
            setOpenVatDialog(false);
            setEditingVatRate(null);
            setNewVatRate({ name: '', rate: 0, description: '' });
          }}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog doublon client */}
      <Dialog
        open={duplicateClientDialog}
        onClose={() => {
          setDuplicateClientDialog(false);
          setDuplicateClientInfo(null);
          setPendingClientData(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#F59E0B' }}>
            <PersonIcon />
            Client similaire existant
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Un client similaire existe déjà dans votre base de données :
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>
              {duplicateClientInfo?.name}
            </Typography>
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Que souhaitez-vous faire ?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E5E7EB', gap: 1 }}>
          <Button
            onClick={() => {
              setDuplicateClientDialog(false);
              setDuplicateClientInfo(null);
              setPendingClientData(null);
            }}
          >
            Annuler
          </Button>
          <Button
            variant="outlined"
            onClick={handleForceCreateClient}
            sx={{
              borderColor: '#F5C518',
              color: '#F5C518',
              '&:hover': { borderColor: '#E0B000', bgcolor: '#FEF9E7' },
            }}
          >
            Créer quand même
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateExistingClient}
            sx={{
              bgcolor: '#F5C518',
              color: '#1A1A1A',
              '&:hover': { bgcolor: '#E0B000' },
            }}
          >
            Mettre à jour l'existant
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog visualisation devis */}
      <Dialog
        open={openViewQuoteDialog}
        onClose={() => {
          setOpenViewQuoteDialog(false);
          setViewingQuote(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">Devis {viewingQuote?.quote_number}</Typography>
            <Typography variant="caption" color="text.secondary">
              Créé le {viewingQuote?.created_at ? new Date(viewingQuote.created_at).toLocaleDateString('fr-FR') : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={viewingQuote?.status || 'draft'}
                onChange={(e) => handleUpdateQuoteStatus(e.target.value)}
              >
                <MenuItem value="draft">Brouillon</MenuItem>
                <MenuItem value="sent">Envoyé</MenuItem>
                <MenuItem value="accepted">Accepté</MenuItem>
                <MenuItem value="rejected">Refusé</MenuItem>
                <MenuItem value="expired">Expiré</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {viewingQuote && (
            <Grid container spacing={3}>
              {/* Infos client */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ color: '#F5C518', fontWeight: 600, mb: 1 }}>
                  Client
                </Typography>
                <Typography variant="body2">
                  {viewingQuote.client_name || 'Aucun client'}
                </Typography>
              </Grid>

              {/* Dates */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ color: '#F5C518', fontWeight: 600, mb: 1 }}>
                  Validité
                </Typography>
                <Typography variant="body2">
                  Du {new Date(viewingQuote.issue_date).toLocaleDateString('fr-FR')} au{' '}
                  {new Date(viewingQuote.valid_until).toLocaleDateString('fr-FR')}
                </Typography>
              </Grid>

              {/* Description */}
              {viewingQuote.description && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ color: '#F5C518', fontWeight: 600, mb: 1 }}>
                    Objet
                  </Typography>
                  <Typography variant="body2">{viewingQuote.description}</Typography>
                </Grid>
              )}

              {/* Lignes du devis */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ color: '#F5C518', fontWeight: 600, mb: 1 }}>
                  Détail
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                        <TableCell>Description</TableCell>
                        <TableCell align="center">Qté</TableCell>
                        <TableCell align="right">Prix HT</TableCell>
                        <TableCell align="center">TVA</TableCell>
                        <TableCell align="right">Total TTC</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewingQuote.line_items?.map((item, index) => {
                        const lineHT = item.quantity * item.unit_price;
                        const vatRate = item.vat_rate || 0;
                        const lineTTC = lineHT * (1 + vatRate / 100);
                        return (
                          <TableRow key={index}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell align="center">{item.quantity}</TableCell>
                            <TableCell align="right">{formatCurrency(item.unit_price, currency)}</TableCell>
                            <TableCell align="center">{vatRate}%</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {formatCurrency(lineTTC, currency)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* Totaux */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Box sx={{ width: 250 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">Sous-total HT</Typography>
                      <Typography variant="body2">{formatCurrency(viewingQuote.subtotal, currency)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">TVA</Typography>
                      <Typography variant="body2">{formatCurrency(viewingQuote.tax_amount, currency)}</Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>Total TTC</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: '#F5C518' }}>
                        {formatCurrency(viewingQuote.total_amount, currency)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>

              {/* Notes */}
              {viewingQuote.notes && (
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ color: '#6B7280', fontWeight: 600, mb: 1 }}>
                    Notes
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{viewingQuote.notes}</Typography>
                </Grid>
              )}

              {/* Conditions */}
              {viewingQuote.terms && (
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ color: '#6B7280', fontWeight: 600, mb: 1 }}>
                    Conditions
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{viewingQuote.terms}</Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E5E7EB', gap: 1 }}>
          <Button
            onClick={() => {
              setOpenViewQuoteDialog(false);
              setViewingQuote(null);
            }}
          >
            Fermer
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => {
              if (viewingQuote) {
                setSelectedItemId(viewingQuote.id);
                handleDownloadPdf();
              }
            }}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? 'Téléchargement...' : 'Télécharger PDF'}
          </Button>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => {
              if (viewingQuote) {
                const client = clients.find(c => c.id === viewingQuote.client_id);
                setEmailForm({
                  quoteId: viewingQuote.id,
                  to_email: client?.email || '',
                  subject: `Devis ${viewingQuote.quote_number} - ${currentCompany?.name || ''}`,
                  message: '',
                });
                setEmailSent(false);
                setOpenEmailDialog(true);
              }
            }}
            sx={{
              bgcolor: '#F5C518',
              color: '#1A1A1A',
              '&:hover': { bgcolor: '#E0B000' },
            }}
          >
            Envoyer par email
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog envoi email */}
      <Dialog
        open={openEmailDialog}
        onClose={() => {
          setOpenEmailDialog(false);
          setEmailForm({ quoteId: 0, to_email: '', subject: '', message: '' });
          setEmailSent(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SendIcon sx={{ color: '#F5C518' }} />
            Envoyer le devis par email
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email du destinataire *"
                type="email"
                value={emailForm.to_email}
                onChange={(e) => setEmailForm({ ...emailForm, to_email: e.target.value })}
                placeholder="client@example.com"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Objet"
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Message personnalisé (optionnel)"
                value={emailForm.message}
                onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                placeholder="Laissez vide pour utiliser le message par défaut"
              />
            </Grid>
          </Grid>
          <Alert severity="info" sx={{ mt: 2 }}>
            Le devis sera envoyé en pièce jointe au format PDF.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E5E7EB' }}>
          {emailSent ? (
            <>
              <Button
                variant="contained"
                startIcon={<CheckIcon />}
                sx={{
                  bgcolor: '#22C55E',
                  color: 'white',
                  '&:hover': { bgcolor: '#16A34A' },
                  pointerEvents: 'none',
                }}
              >
                Envoyé
              </Button>
              <Button
                onClick={() => {
                  setOpenEmailDialog(false);
                  setEmailForm({ quoteId: 0, to_email: '', subject: '', message: '' });
                  setEmailSent(false);
                }}
                sx={{ ml: 1 }}
              >
                Fermer
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => {
                  setOpenEmailDialog(false);
                  setEmailForm({ quoteId: 0, to_email: '', subject: '', message: '' });
                  setEmailSent(false);
                }}
              >
                Annuler
              </Button>
              <Button
                variant="contained"
                onClick={handleSendEmail}
                disabled={!emailForm.to_email || sendingEmail}
                startIcon={sendingEmail ? <CircularProgress size={20} /> : <SendIcon />}
                sx={{
                  bgcolor: '#F5C518',
                  color: '#1A1A1A',
                  '&:hover': { bgcolor: '#E0B000' },
                }}
              >
                {sendingEmail ? 'Envoi en cours...' : 'Envoyer'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Dialog visualisation facture */}
      <Dialog
        open={openViewInvoiceDialog}
        onClose={() => {
          setOpenViewInvoiceDialog(false);
          setViewingInvoice(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">Facture {viewingInvoice?.invoice_number}</Typography>
            <Typography variant="caption" color="text.secondary">
              Créé le {viewingInvoice?.created_at ? new Date(viewingInvoice.created_at).toLocaleDateString('fr-FR') : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={viewingInvoice?.status || 'draft'}
                onChange={(e) => handleUpdateInvoiceStatus(e.target.value)}
              >
                <MenuItem value="draft">Brouillon</MenuItem>
                <MenuItem value="sent">Envoyée</MenuItem>
                <MenuItem value="partially_paid">Partiellement payée</MenuItem>
                <MenuItem value="paid">Payée</MenuItem>
                <MenuItem value="overdue">En retard</MenuItem>
                <MenuItem value="cancelled">Annulée</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {viewingInvoice && (
            <Grid container spacing={3}>
              {/* Infos client */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ color: '#F5C518', fontWeight: 600, mb: 1 }}>
                  Client
                </Typography>
                <Typography variant="body2">
                  {viewingInvoice.client_name || 'Aucun client'}
                </Typography>
              </Grid>

              {/* Dates */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ color: '#F5C518', fontWeight: 600, mb: 1 }}>
                  Échéance
                </Typography>
                <Typography variant="body2">
                  Émise le {new Date(viewingInvoice.issue_date).toLocaleDateString('fr-FR')} -
                  Échéance le {new Date(viewingInvoice.due_date).toLocaleDateString('fr-FR')}
                </Typography>
              </Grid>

              {/* Description */}
              {viewingInvoice.description && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ color: '#F5C518', fontWeight: 600, mb: 1 }}>
                    Objet
                  </Typography>
                  <Typography variant="body2">{viewingInvoice.description}</Typography>
                </Grid>
              )}

              {/* Lignes de la facture */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ color: '#F5C518', fontWeight: 600, mb: 1 }}>
                  Détail
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                        <TableCell>Description</TableCell>
                        <TableCell align="center">Qté</TableCell>
                        <TableCell align="right">Prix HT</TableCell>
                        <TableCell align="right">Total HT</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewingInvoice.line_items?.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell align="center">{item.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(item.unit_price || 0, currency)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatCurrency(item.amount || 0, currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* Totaux */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Box sx={{ width: 250 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">Sous-total HT</Typography>
                      <Typography variant="body2">{formatCurrency(viewingInvoice.subtotal, currency)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">TVA</Typography>
                      <Typography variant="body2">{formatCurrency(viewingInvoice.tax_amount, currency)}</Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>Total TTC</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: '#F5C518' }}>
                        {formatCurrency(viewingInvoice.total_amount, currency)}
                      </Typography>
                    </Box>
                    {(viewingInvoice.paid_amount || 0) > 0 && (
                      <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">Déjà payé</Typography>
                          <Typography variant="body2" sx={{ color: '#10B981' }}>
                            {formatCurrency(viewingInvoice.paid_amount || 0, currency)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>Reste à payer</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#EF4444' }}>
                            {formatCurrency(viewingInvoice.total_amount - (viewingInvoice.paid_amount || 0), currency)}
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Box>
                </Box>
              </Grid>

              {/* Notes */}
              {viewingInvoice.notes && (
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ color: '#6B7280', fontWeight: 600, mb: 1 }}>
                    Notes
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{viewingInvoice.notes}</Typography>
                </Grid>
              )}

              {/* Conditions de paiement */}
              {viewingInvoice.payment_terms && (
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ color: '#6B7280', fontWeight: 600, mb: 1 }}>
                    Conditions de paiement
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{viewingInvoice.payment_terms}</Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E5E7EB', gap: 1 }}>
          <Button
            onClick={() => {
              setOpenViewInvoiceDialog(false);
              setViewingInvoice(null);
            }}
          >
            Fermer
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => {
              if (viewingInvoice) {
                handleDownloadInvoicePdf(viewingInvoice.id);
              }
            }}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? 'Téléchargement...' : 'Télécharger PDF'}
          </Button>
          {viewingInvoice && viewingInvoice.status !== 'paid' && viewingInvoice.status !== 'cancelled' && (
            <Button
              variant="outlined"
              startIcon={<PaymentIcon />}
              onClick={() => handleOpenOnsitePaymentDialog()}
              color="success"
            >
              Paiement reçu
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => {
              if (viewingInvoice) {
                setInvoiceEmailForm({
                  invoiceId: viewingInvoice.id,
                  to_email: viewingInvoice.client_email || '',
                  subject: `Facture ${viewingInvoice.invoice_number} - ${currentCompany?.name || ''}`,
                  message: '',
                });
                setInvoiceEmailSent(false);
                setOpenInvoiceEmailDialog(true);
              }
            }}
            sx={{
              bgcolor: '#F5C518',
              color: '#1A1A1A',
              '&:hover': { bgcolor: '#E0B000' },
            }}
          >
            Envoyer par email
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog envoi email facture */}
      <Dialog
        open={openInvoiceEmailDialog}
        onClose={() => {
          setOpenInvoiceEmailDialog(false);
          setInvoiceEmailForm({ invoiceId: 0, to_email: '', subject: '', message: '' });
          setInvoiceEmailSent(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SendIcon sx={{ color: '#F5C518' }} />
            Envoyer la facture par email
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email du destinataire *"
                type="email"
                value={invoiceEmailForm.to_email}
                onChange={(e) => setInvoiceEmailForm({ ...invoiceEmailForm, to_email: e.target.value })}
                placeholder="client@example.com"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Objet"
                value={invoiceEmailForm.subject}
                onChange={(e) => setInvoiceEmailForm({ ...invoiceEmailForm, subject: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Message personnalisé (optionnel)"
                value={invoiceEmailForm.message}
                onChange={(e) => setInvoiceEmailForm({ ...invoiceEmailForm, message: e.target.value })}
                placeholder="Laissez vide pour utiliser le message par défaut"
              />
            </Grid>
          </Grid>
          <Alert severity="info" sx={{ mt: 2 }}>
            La facture sera envoyée en pièce jointe au format PDF.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E5E7EB' }}>
          {invoiceEmailSent ? (
            <>
              <Button
                variant="contained"
                startIcon={<CheckIcon />}
                sx={{
                  bgcolor: '#22C55E',
                  color: 'white',
                  '&:hover': { bgcolor: '#16A34A' },
                  pointerEvents: 'none',
                }}
              >
                Envoyé
              </Button>
              <Button
                onClick={() => {
                  setOpenInvoiceEmailDialog(false);
                  setInvoiceEmailForm({ invoiceId: 0, to_email: '', subject: '', message: '' });
                  setInvoiceEmailSent(false);
                }}
                sx={{ ml: 1 }}
              >
                Fermer
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => {
                  setOpenInvoiceEmailDialog(false);
                  setInvoiceEmailForm({ invoiceId: 0, to_email: '', subject: '', message: '' });
                  setInvoiceEmailSent(false);
                }}
              >
                Annuler
              </Button>
              <Button
                variant="contained"
                onClick={handleSendInvoiceEmail}
                disabled={!invoiceEmailForm.to_email || sendingInvoiceEmail}
                startIcon={sendingInvoiceEmail ? <CircularProgress size={20} /> : <SendIcon />}
                sx={{
                  bgcolor: '#F5C518',
                  color: '#1A1A1A',
                  '&:hover': { bgcolor: '#E0B000' },
                }}
              >
                {sendingInvoiceEmail ? 'Envoi en cours...' : 'Envoyer'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Dialog paiement sur place (CB/Espèces) */}
      <Dialog
        open={openOnsitePaymentDialog}
        onClose={() => {
          setOpenOnsitePaymentDialog(false);
          setOnsitePayment({ invoiceId: 0, amount: 0, payment_method: 'carte' });
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaymentIcon sx={{ color: '#10B981' }} />
            Enregistrer un paiement
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Enregistrez un paiement reçu en boutique (carte bancaire ou espèces).
            Ce paiement ne sera pas associé à une transaction bancaire.
          </Alert>

          <TextField
            fullWidth
            margin="dense"
            label="Montant reçu"
            type="number"
            value={onsitePayment.amount}
            onChange={(e) => setOnsitePayment({ ...onsitePayment, amount: Number(e.target.value) })}
            InputProps={{
              endAdornment: <Typography color="text.secondary">{currency}</Typography>,
            }}
          />

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: '#6B7280' }}>
            Mode de paiement
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant={onsitePayment.payment_method === 'carte' ? 'contained' : 'outlined'}
              startIcon={<CreditCardIcon />}
              onClick={() => setOnsitePayment({ ...onsitePayment, payment_method: 'carte' })}
              sx={onsitePayment.payment_method === 'carte' ? {
                bgcolor: '#10B981',
                color: 'white',
                '&:hover': { bgcolor: '#059669' },
              } : {}}
            >
              Carte bancaire
            </Button>
            <Button
              variant={onsitePayment.payment_method === 'especes' ? 'contained' : 'outlined'}
              startIcon={<LocalAtmIcon />}
              onClick={() => setOnsitePayment({ ...onsitePayment, payment_method: 'especes' })}
              sx={onsitePayment.payment_method === 'especes' ? {
                bgcolor: '#10B981',
                color: 'white',
                '&:hover': { bgcolor: '#059669' },
              } : {}}
            >
              Espèces
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #E5E7EB' }}>
          <Button
            onClick={() => {
              setOpenOnsitePaymentDialog(false);
              setOnsitePayment({ invoiceId: 0, amount: 0, payment_method: 'carte' });
            }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveOnsitePayment}
            disabled={savingOnsitePayment || !onsitePayment.amount}
            startIcon={savingOnsitePayment ? <CircularProgress size={20} /> : <CheckIcon />}
            sx={{
              bgcolor: '#10B981',
              color: 'white',
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            {savingOnsitePayment ? 'Enregistrement...' : 'Enregistrer le paiement'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog création/édition compte bancaire */}
      <Dialog
        open={openBankAccountDialog}
        onClose={() => {
          setOpenBankAccountDialog(false);
          resetBankAccountForm();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingBankAccount ? 'Modifier le compte bancaire' : 'Ajouter un compte bancaire'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Nom du compte"
                value={bankAccountForm.label || ''}
                onChange={(e) => setBankAccountForm({ ...bankAccountForm, label: e.target.value })}
                placeholder="Ex: Compte principal, Compte épargne..."
                helperText="Identifiant pour différencier vos comptes"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Titulaire du compte"
                value={bankAccountForm.account_holder || ''}
                onChange={(e) => setBankAccountForm({ ...bankAccountForm, account_holder: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Nom de la banque"
                value={bankAccountForm.bank_name || ''}
                onChange={(e) => setBankAccountForm({ ...bankAccountForm, bank_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="IBAN"
                value={bankAccountForm.iban || ''}
                onChange={(e) => setBankAccountForm({ ...bankAccountForm, iban: e.target.value })}
                placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="BIC / SWIFT (optionnel)"
                value={bankAccountForm.bic || ''}
                onChange={(e) => setBankAccountForm({ ...bankAccountForm, bic: e.target.value })}
                placeholder="BNPAFRPP"
              />
            </Grid>
            <Grid item xs={12}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 2,
                  bgcolor: bankAccountForm.is_default ? '#FEF3C7' : '#F9FAFB',
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
                onClick={() => setBankAccountForm({ ...bankAccountForm, is_default: !bankAccountForm.is_default })}
              >
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: bankAccountForm.is_default ? 'none' : '2px solid #D1D5DB',
                    bgcolor: bankAccountForm.is_default ? '#F5C518' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {bankAccountForm.is_default && <CheckIcon sx={{ fontSize: 14, color: '#1A1A1A' }} />}
                </Box>
                <Typography variant="body2">
                  Compte par défaut (utilisé sur les documents)
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => {
              setOpenBankAccountDialog(false);
              resetBankAccountForm();
            }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveBankAccount}
            disabled={savingBankAccount || !bankAccountForm.label?.trim() || !bankAccountForm.bank_name?.trim() || !bankAccountForm.iban?.trim()}
            startIcon={savingBankAccount ? <CircularProgress size={20} /> : <CheckIcon />}
            sx={{
              bgcolor: '#F5C518',
              color: '#1A1A1A',
              '&:hover': { bgcolor: '#E0B000' },
              '&.Mui-disabled': { bgcolor: '#E5E7EB', color: '#9CA3AF' },
            }}
          >
            {savingBankAccount ? 'Enregistrement...' : (editingBankAccount ? 'Modifier' : 'Ajouter')}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
