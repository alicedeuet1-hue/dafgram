'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import BudgetPieCharts from '@/components/BudgetPieCharts';
import SavingsPieCharts from '@/components/SavingsPieCharts';
import TimePieCharts from '@/components/TimePieCharts';
import BudgetAlerts from '@/components/BudgetAlerts';
import RevenueChart from '@/components/RevenueChart';
import PersonalExpenseSummary from '@/components/PersonalExpenseSummary';
import SalesTracker from '@/components/SalesTracker';
import {
  Box,
  Typography,
  IconButton,
  Grid,
  Card,
  CardContent,
  alpha,
  useTheme,
  useMediaQuery,
  Skeleton,
  Tooltip,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Build as BuildIcon,
  AdminPanelSettings as AdminIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { transactionsAPI, Transaction, bankAPI, Category } from '@/lib/api';
import { useCompanyStore } from '@/store/companyStore';
import { useAuthStore } from '@/store/authStore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function DashboardPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentCompany } = useCompanyStore();
  const { user } = useAuthStore();
  const isPersonalAccount = currentCompany?.account_type === 'personal';

  // État pour la navigation par mois
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  // Transactions récentes
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  // Option hideUnallocated synchronisée avec la page Charges via localStorage
  const [hideUnallocated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('budget_hideUnallocated');
      return saved === 'true';
    }
    return false;
  });

  // Clé de rafraîchissement pour forcer le re-render des composants après ajout de transaction
  const [refreshKey, setRefreshKey] = useState(0);

  // Transaction rapide (comptes personnels)
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [txType, setTxType] = useState<'revenue' | 'expense'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txCategoryId, setTxCategoryId] = useState<number | ''>('');
  const [txCategories, setTxCategories] = useState<Category[]>([]);
  const [txSaving, setTxSaving] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const openTxDialog = async (type: 'revenue' | 'expense') => {
    setTxType(type);
    setTxAmount('');
    setTxDescription('');
    setTxCategoryId('');
    setTxError(null);
    setTxDialogOpen(true);
    try {
      const catRes = await bankAPI.getCategories(type, false);
      setTxCategories(catRes.data || []);
    } catch {
      setTxCategories([]);
    }
  };

  const handleCreateTransaction = async () => {
    if (!txAmount || !txCategoryId) return;
    setTxSaving(true);
    setTxError(null);
    try {
      await transactionsAPI.create({
        type: txType,
        amount: parseFloat(txAmount),
        description: txDescription,
        category_id: txCategoryId,
        company_id: user?.company_id,
        account_type: 'company',
      });
      setTxDialogOpen(false);
      // Rafraîchir les données du dashboard
      setRefreshKey(k => k + 1);
      window.dispatchEvent(new CustomEvent('refresh-budget-data'));
      window.dispatchEvent(new CustomEvent('refresh-savings-data'));
    } catch (err: any) {
      console.error('Error creating transaction:', err);
      setTxError(err.response?.data?.detail || 'Erreur lors de l\'enregistrement');
    } finally {
      setTxSaving(false);
    }
  };

  // Mode admin (affiche les contrôles d'édition)
  const [adminMode, setAdminMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard_adminMode');
      return saved !== 'false'; // Par défaut true
    }
    return true;
  });

  // Sauvegarder le mode admin dans localStorage
  useEffect(() => {
    localStorage.setItem('dashboard_adminMode', String(adminMode));
  }, [adminMode]);

  // Date actuelle pour le composant BudgetPieCharts
  const currentDate = new Date(selectedYear, selectedMonth - 1, 1);

  // Fetch recent transactions (pro seulement)
  const fetchRecentTransactions = useCallback(async () => {
    if (isPersonalAccount) {
      setTransactionsLoading(false);
      return;
    }
    try {
      setTransactionsLoading(true);
      // Dates du mois sélectionné
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${lastDay}`;

      const res = await transactionsAPI.getAll({
        start_date: startDate,
        end_date: endDate,
        limit: 5, // Limiter à 5 transactions récentes
        account_type: 'company',
      });
      setRecentTransactions(res.data.items || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setRecentTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  }, [selectedMonth, selectedYear, isPersonalAccount]);

  useEffect(() => {
    fetchRecentTransactions();
  }, [fetchRecentTransactions]);

  // Format montant
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Navigation par mois
  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    const now = new Date();
    const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();
    if (isCurrentMonth) return; // Ne pas aller dans le futur

    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <Box sx={{ mb: { xs: 2, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
          Vue d'ensemble
        </Typography>
        <Tooltip title={adminMode ? 'Masquer les contrôles admin' : 'Afficher les contrôles admin'}>
          <Chip
            icon={adminMode ? <AdminIcon sx={{ fontSize: 18 }} /> : <ViewIcon sx={{ fontSize: 18 }} />}
            label={adminMode ? 'Mode Admin' : 'Mode Lecture'}
            onClick={() => setAdminMode(!adminMode)}
            size="small"
            sx={{
              cursor: 'pointer',
              bgcolor: adminMode ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.text.disabled, 0.1),
              color: adminMode ? theme.palette.primary.main : theme.palette.text.secondary,
              '& .MuiChip-icon': {
                color: adminMode ? theme.palette.primary.main : theme.palette.text.secondary,
              },
              '&:hover': {
                bgcolor: adminMode ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.text.disabled, 0.2),
              },
            }}
          />
        </Tooltip>
      </Box>

      {/* Month Navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 1, sm: 2 }, flexWrap: 'wrap' }}>
        <IconButton
          onClick={goToPreviousMonth}
          size="small"
          sx={{
            bgcolor: 'action.hover',
            color: 'text.primary',
            '&:hover': { bgcolor: 'action.selected' }
          }}
        >
          <ChevronLeft />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', minWidth: { xs: 'auto', sm: 180 }, textAlign: 'center', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
          {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
        </Typography>
        <IconButton
          onClick={goToNextMonth}
          size="small"
          sx={{
            bgcolor: 'action.hover',
            color: 'text.primary',
            '&:hover': { bgcolor: 'action.selected' }
          }}
          disabled={isCurrentMonth()}
        >
          <ChevronRight />
        </IconButton>

      </Box>

      {/* Boutons rapides revenus/dépenses (personnel) */}
      {isPersonalAccount && (
        <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2 }, mt: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<TrendingUpIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />}
            onClick={() => openTxDialog('revenue')}
            size={isMobile ? 'medium' : 'small'}
            sx={{
              flex: { xs: 1, sm: 'none' },
              maxWidth: { sm: 200 },
              bgcolor: '#10B981',
              color: '#fff',
              fontWeight: 600,
              borderRadius: 2,
              textTransform: 'none',
              py: { xs: 1.2, sm: 0.8 },
              fontSize: { xs: '0.9rem', sm: '0.875rem' },
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            + Revenu
          </Button>
          <Button
            variant="contained"
            startIcon={<TrendingDownIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />}
            onClick={() => openTxDialog('expense')}
            size={isMobile ? 'medium' : 'small'}
            sx={{
              flex: { xs: 1, sm: 'none' },
              maxWidth: { sm: 200 },
              bgcolor: '#EF4444',
              color: '#fff',
              fontWeight: 600,
              borderRadius: 2,
              textTransform: 'none',
              py: { xs: 1.2, sm: 0.8 },
              fontSize: { xs: '0.9rem', sm: '0.875rem' },
              '&:hover': { bgcolor: '#DC2626' },
            }}
          >
            + Dépense
          </Button>
        </Box>
      )}

      {/* Grille principale */}
      <Grid container spacing={2} sx={{ mt: isPersonalAccount ? 0.5 : 2 }}>
        {/* Colonne gauche: Camemberts + Alertes */}
        <Grid item xs={12} lg={isPersonalAccount ? 12 : 9}>
          {/* Sous-grille pour les camemberts */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={isPersonalAccount ? 6 : 4}>
              <BudgetPieCharts
                key={`budget-${refreshKey}`}
                currentDate={currentDate}
                hideUnallocated={hideUnallocated}
                renderMode="pie-only"
              />
            </Grid>
            <Grid item xs={12} sm={isPersonalAccount ? 6 : 4}>
              <SavingsPieCharts
                key={`savings-${refreshKey}`}
                currentDate={currentDate}
                renderMode="pie-only"
              />
            </Grid>
            {!isPersonalAccount && (
              <Grid item xs={12} sm={4}>
                <TimePieCharts
                  currentDate={currentDate}
                  renderMode="pie-only"
                />
              </Grid>
            )}
          </Grid>
          {/* Alertes budgétaires sous les camemberts */}
          <Box sx={{ mt: 2 }}>
            <BudgetAlerts currentDate={currentDate} />
          </Box>
        </Grid>

        {/* Colonne droite: Transactions (pro seulement) */}
        {!isPersonalAccount && (
          <Grid item xs={12} lg={3}>
            <Card
              sx={{ borderRadius: 2, bgcolor: theme.palette.background.paper, height: '100%' }}
              onClick={() => {
                // Désélectionner les camemberts quand on clique sur Transactions
                window.dispatchEvent(new CustomEvent('deselect-budget-slice'));
                window.dispatchEvent(new CustomEvent('deselect-savings-slice'));
                window.dispatchEvent(new CustomEvent('deselect-time-slice'));
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                    Transactions récentes
                  </Typography>
                </Box>

                {/* Liste mixte des transactions récentes */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {transactionsLoading ? (
                    // Skeleton loading
                    [...Array(4)].map((_, i) => (
                      <Skeleton key={i} variant="rectangular" height={36} sx={{ borderRadius: 1 }} />
                    ))
                  ) : recentTransactions.length > 0 ? (
                    recentTransactions.map((transaction) => {
                      const isRevenue = transaction.type === 'revenue';
                      const color = isRevenue ? '#10B981' : '#EF4444';
                      return (
                        <Box
                          key={transaction.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            py: 0.75,
                            px: 1,
                            borderRadius: 1,
                            bgcolor: alpha(color, 0.05),
                            '&:hover': { bgcolor: alpha(color, 0.1) },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                            {isRevenue ? (
                              <TrendingUpIcon sx={{ fontSize: 14, color, flexShrink: 0 }} />
                            ) : (
                              <TrendingDownIcon sx={{ fontSize: 14, color, flexShrink: 0 }} />
                            )}
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography
                                variant="caption"
                                sx={{
                                  fontWeight: 500,
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  lineHeight: 1.3,
                                }}
                              >
                                {transaction.description || transaction.category?.name || 'Transaction'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                {format(new Date(transaction.transaction_date), 'dd MMM', { locale: fr })}
                              </Typography>
                            </Box>
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 600, color, flexShrink: 0, ml: 1 }}
                          >
                            {isRevenue ? '+' : '-'}{formatAmount(Math.abs(transaction.amount))}
                          </Typography>
                        </Box>
                      );
                    })
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                      Aucune transaction ce mois
                    </Typography>
                  )}
                </Box>

                {/* Transactions en attente - Module comptabilité */}
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    bgcolor: alpha(theme.palette.text.disabled, 0.05),
                    borderRadius: 1.5,
                    border: `1px dashed ${alpha(theme.palette.text.disabled, 0.2)}`,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BuildIcon sx={{ fontSize: 16, color: theme.palette.text.disabled }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, display: 'block' }}>
                        Transactions en attente
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                        Disponible dans une prochaine mise à jour avec le module Comptabilité
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Revenue Chart (pro) / Expense Summary (personal) */}
      {isPersonalAccount ? (
        <PersonalExpenseSummary key={`expense-${refreshKey}`} currentDate={currentDate} />
      ) : (
        <RevenueChart currentDate={currentDate} adminMode={adminMode} />
      )}

      {/* Encart Comptabilité - À venir (pro seulement) */}
      {!isPersonalAccount && (
        <Card
          sx={{
            mt: 2,
            borderRadius: 2,
            bgcolor: theme.palette.background.paper,
            border: `1px dashed ${alpha(theme.palette.text.disabled, 0.3)}`,
          }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.text.disabled, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BuildIcon sx={{ color: theme.palette.text.disabled, fontSize: 22 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.text.secondary }}>
                  Envoi Comptabilité
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', lineHeight: 1.4 }}>
                  Envoi automatique des rapports mensuels à votre comptable, suivi des retours et validation - Disponible dans une prochaine mise à jour
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Suivi Vendeur (pro seulement) */}
      {!isPersonalAccount && <SalesTracker adminMode={adminMode} />}

      {/* Dialog transaction rapide (personnel) */}
      {isPersonalAccount && (
        <Dialog
          open={txDialogOpen}
          onClose={() => !txSaving && setTxDialogOpen(false)}
          maxWidth="xs"
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle sx={{ fontWeight: 700, color: txType === 'revenue' ? '#10B981' : '#EF4444' }}>
            {txType === 'revenue' ? 'Nouveau revenu' : 'Nouvelle dépense'}
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <FormControl fullWidth required>
              <InputLabel>Catégorie *</InputLabel>
              <Select
                value={txCategoryId}
                label="Catégorie *"
                onChange={(e) => setTxCategoryId(Number(e.target.value))}
              >
                {txCategories.map(cat => (
                  <MenuItem key={cat.id} value={cat.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cat.color }} />
                      {cat.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Montant"
              type="number"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              autoFocus
              inputProps={{ min: 0, step: '0.01' }}
            />
            <TextField
              fullWidth
              label="Description (optionnel)"
              value={txDescription}
              onChange={(e) => setTxDescription(e.target.value)}
            />
            {txError && (
              <Typography variant="caption" sx={{ color: '#EF4444' }}>
                {txError}
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setTxDialogOpen(false)}
              disabled={txSaving}
              sx={{ color: 'text.secondary' }}
            >
              Annuler
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateTransaction}
              disabled={txSaving || !txAmount || !txCategoryId}
              sx={{
                bgcolor: txType === 'revenue' ? '#10B981' : '#EF4444',
                fontWeight: 600,
                '&:hover': { bgcolor: txType === 'revenue' ? '#059669' : '#DC2626' },
              }}
            >
              {txSaving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Enregistrer'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
