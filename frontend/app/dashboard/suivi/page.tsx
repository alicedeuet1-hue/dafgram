'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Grid,
  Button,
  CircularProgress,
  LinearProgress,
  IconButton,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Savings as SavingsIcon,
  AccessTime as TimeIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { HexColorPicker } from 'react-colorful';
import {
  budgetCategoriesAPI,
  savingsCategoriesAPI,
  SavingsSummary,
  SavingsCategory,
  SavingsCategorySummary,
} from '@/lib/api';
import { useCompanyStore } from '@/store/companyStore';
import { formatCurrency } from '@/lib/currency';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function SuiviPage() {
  const router = useRouter();
  const { currentCompany } = useCompanyStore();
  const currency = currentCompany?.currency || 'EUR';
  const isPersonalAccount = currentCompany?.account_type === 'personal';

  // Navigation par mois
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const [activeTab, setActiveTab] = useState<'epargne' | 'temps'>('epargne');
  const [savingsSummary, setSavingsSummary] = useState<SavingsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // État pour les catégories d'épargne
  const [savingsCategories, setSavingsCategories] = useState<SavingsCategory[]>([]);
  const [savingsCategoriesSummary, setSavingsCategoriesSummary] = useState<SavingsCategorySummary | null>(null);
  const [savingsCategoriesLoading, setSavingsCategoriesLoading] = useState(true);

  // État pour le dialog de catégorie d'épargne
  const [savingsCategoryDialog, setSavingsCategoryDialog] = useState(false);
  const [editingSavingsCategory, setEditingSavingsCategory] = useState<SavingsCategory | null>(null);
  const [newSavingsCategory, setNewSavingsCategory] = useState({
    name: '',
    description: '',
    color: '#F5C518',
    percentage: 0,
  });
  const [seedingCategories, setSeedingCategories] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // État pour le dialog de détail d'une catégorie
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDetailCategory, setSelectedDetailCategory] = useState<SavingsCategory | null>(null);

  // Handler pour le clic sur une part du camembert
  const handlePieClick = (category: SavingsCategory) => {
    setSelectedDetailCategory(category);
    setDetailDialogOpen(true);
  };

  // Navigation mois
  const handlePreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Fetch savings summary global
  useEffect(() => {
    const fetchSavings = async () => {
      try {
        setLoading(true);
        const response = await budgetCategoriesAPI.getSavingsSummary();
        setSavingsSummary(response.data);
      } catch (error) {
        console.error('Error fetching savings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSavings();
  }, []);

  // Fetch savings categories avec le mois sélectionné
  const fetchSavingsCategories = async (month?: number, year?: number) => {
    try {
      setSavingsCategoriesLoading(true);
      const response = await savingsCategoriesAPI.getSummary(month, year);
      setSavingsCategoriesSummary(response.data);
      setSavingsCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching savings categories:', error);
    } finally {
      setSavingsCategoriesLoading(false);
    }
  };

  useEffect(() => {
    fetchSavingsCategories(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  // Créer les catégories d'épargne par défaut
  const handleSeedDefaultCategories = async () => {
    try {
      setSeedingCategories(true);
      await savingsCategoriesAPI.seedDefaults();
      await fetchSavingsCategories(selectedMonth, selectedYear);
      setSnackbar({
        open: true,
        message: 'Catégories d\'épargne créées avec succès !',
        severity: 'success',
      });
    } catch (error: any) {
      console.error('Error seeding default categories:', error);
      const errorMessage = error.response?.data?.detail || 'Erreur lors de la création des catégories.';
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setSeedingCategories(false);
    }
  };

  // Ouvrir le dialog pour créer/modifier une catégorie
  const openSavingsCategoryDialog = (category?: SavingsCategory) => {
    if (category) {
      setEditingSavingsCategory(category);
      setNewSavingsCategory({
        name: category.name,
        description: category.description || '',
        color: category.color,
        percentage: category.percentage,
      });
    } else {
      setEditingSavingsCategory(null);
      setNewSavingsCategory({
        name: '',
        description: '',
        color: '#F5C518',
        percentage: 0,
      });
    }
    setSavingsCategoryDialog(true);
  };

  // Sauvegarder une catégorie d'épargne
  const handleSaveSavingsCategory = async () => {
    try {
      if (editingSavingsCategory) {
        await savingsCategoriesAPI.update(editingSavingsCategory.id, newSavingsCategory);
      } else {
        await savingsCategoriesAPI.create(newSavingsCategory);
      }
      setSavingsCategoryDialog(false);
      fetchSavingsCategories(selectedMonth, selectedYear);
    } catch (error) {
      console.error('Error saving savings category:', error);
    }
  };

  // Supprimer une catégorie d'épargne
  const handleDeleteSavingsCategory = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;
    try {
      await savingsCategoriesAPI.delete(id);
      fetchSavingsCategories(selectedMonth, selectedYear);
    } catch (error) {
      console.error('Error deleting savings category:', error);
    }
  };

  const hasSavingsBudget = savingsSummary && savingsSummary.percentage > 0;

  return (
    <DashboardLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: 'text.primary',
            }}
          >
            Suivi
          </Typography>

          {/* Navigation par mois */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: '#F3F4F6',
              borderRadius: 2,
              px: 1,
              py: 0.5,
            }}
          >
            <IconButton onClick={handlePreviousMonth} size="small" sx={{ bgcolor: 'white' }}>
              <ChevronLeft />
            </IconButton>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, minWidth: 150, textAlign: 'center' }}>
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </Typography>
            <IconButton onClick={handleNextMonth} size="small" sx={{ bgcolor: 'white' }}>
              <ChevronRight />
            </IconButton>
          </Box>
        </Box>
        <Typography variant="body1" sx={{ color: '#6B7280' }}>
          Le suivi est réparti avec le suivi de l'épargne et un suivi du temps
        </Typography>
      </Box>

      {/* Onglets */}
      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        sx={{
          mb: 3,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.95rem',
            minHeight: 48,
          },
          '& .Mui-selected': {
            color: '#F5C518 !important',
          },
          '& .MuiTabs-indicator': {
            backgroundColor: '#F5C518',
          },
        }}
      >
        <Tab
          value="epargne"
          icon={<SavingsIcon sx={{ fontSize: 20 }} />}
          iconPosition="start"
          label="Suivi de l'épargne"
          sx={{
            '&.Mui-selected': { color: '#F5C518' },
          }}
        />
        <Tab
          value="temps"
          icon={<TimeIcon sx={{ fontSize: 20 }} />}
          iconPosition="start"
          label="Suivi du temps"
          sx={{
            '&.Mui-selected': { color: '#F5C518' },
          }}
        />
      </Tabs>

      {/* Contenu de l'onglet Épargne */}
      {activeTab === 'epargne' && (
        <>
          {loading || savingsCategoriesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress sx={{ color: '#F5C518' }} />
            </Box>
          ) : hasSavingsBudget ? (
            <Box>
              {/* Cartes de résumé */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      border: '1px solid #E5E7EB',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <AccountBalanceIcon sx={{ color: '#F5C518' }} />
                      <Typography variant="subtitle2" sx={{ color: '#6B7280' }}>
                        Total alloué (cumulé)
                      </Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 600, color: '#F5C518' }}>
                      {formatCurrency(savingsCategoriesSummary?.total_allocated || 0, currency)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#9CA3AF', mt: 1 }}>
                      {formatCurrency(savingsCategoriesSummary?.current_month_allocated || 0, currency)} ce mois
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      border: '1px solid #E5E7EB',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <TrendingDownIcon sx={{ color: '#EF4444' }} />
                      <Typography variant="subtitle2" sx={{ color: '#6B7280' }}>
                        Total dépensé (cumulé)
                      </Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 600, color: '#EF4444' }}>
                      {formatCurrency(savingsCategoriesSummary?.total_spent || 0, currency)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#9CA3AF', mt: 1 }}>
                      {formatCurrency(savingsCategoriesSummary?.current_month_spent || 0, currency)} ce mois
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      border: '1px solid #E5E7EB',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <SavingsIcon sx={{ color: (savingsCategoriesSummary?.total_remaining || 0) >= 0 ? '#10B981' : '#EF4444' }} />
                      <Typography variant="subtitle2" sx={{ color: '#6B7280' }}>
                        Solde restant
                      </Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 600, color: (savingsCategoriesSummary?.total_remaining || 0) >= 0 ? '#10B981' : '#EF4444' }}>
                      {formatCurrency(savingsCategoriesSummary?.total_remaining || 0, currency)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#9CA3AF', mt: 1 }}>
                      {savingsCategoriesSummary?.total_savings_percentage || 0}% {isPersonalAccount ? 'des revenus alloué à l\'épargne' : 'du CA alloué à l\'épargne'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Camembert et détail par catégorie */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: '1px solid #E5E7EB',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Répartition de l'épargne - {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => openSavingsCategoryDialog()}
                    sx={{
                      borderColor: '#10B981',
                      color: '#10B981',
                      '&:hover': { borderColor: '#059669', bgcolor: '#ECFDF5' },
                    }}
                  >
                    Ajouter
                  </Button>
                </Box>

                {savingsCategories.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body2" sx={{ color: '#6B7280', mb: 2 }}>
                      Aucune catégorie d'épargne configurée.
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={handleSeedDefaultCategories}
                      disabled={seedingCategories}
                      sx={{
                        bgcolor: '#10B981',
                        '&:hover': { bgcolor: '#059669' },
                      }}
                    >
                      {seedingCategories ? (
                        <>
                          <CircularProgress size={20} sx={{ color: 'white', mr: 1 }} />
                          Création en cours...
                        </>
                      ) : (
                        'Créer les catégories par défaut'
                      )}
                    </Button>
                  </Box>
                ) : (
                  <Grid container spacing={3}>
                    {/* Camembert */}
                    <Grid item xs={12} md={5}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <ResponsiveContainer width="100%" height={280}>
                          <PieChart>
                            {/* Camembert unique - utilise toujours le pourcentage pour la répartition */}
                            <Pie
                              data={savingsCategories.map(cat => ({
                                name: cat.name,
                                // Toujours utiliser le pourcentage pour la répartition visuelle
                                value: cat.percentage > 0 ? cat.percentage : 1,
                                color: cat.color,
                                allocated: cat.allocated_amount,
                                spent: cat.spent_amount,
                                remaining: cat.remaining_amount,
                                percentage: cat.percentage,
                                // Calcul du ratio dépensé pour l'opacité
                                spentRatio: cat.allocated_amount > 0
                                  ? Math.min(cat.spent_amount / cat.allocated_amount, 1)
                                  : (cat.spent_amount > 0 ? 1 : 0),
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={0}
                              outerRadius={100}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {savingsCategories.map((cat, index) => {
                                // L'opacité varie selon le ratio dépensé (plus dépensé = plus foncé)
                                const spentRatio = cat.allocated_amount > 0
                                  ? Math.min(cat.spent_amount / cat.allocated_amount, 1)
                                  : (cat.spent_amount > 0 ? 1 : 0);
                                // Opacité: 0.3 (non dépensé) à 1.0 (tout dépensé)
                                const opacity = 0.3 + (spentRatio * 0.7);
                                return (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={cat.color}
                                    opacity={opacity}
                                    stroke={cat.color}
                                    strokeWidth={1}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handlePieClick(cat)}
                                  />
                                );
                              })}
                            </Pie>
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length > 0) {
                                  const data = payload[0].payload;
                                  return (
                                    <Box sx={{ bgcolor: 'white', p: 1.5, borderRadius: 1, boxShadow: 2, border: '1px solid #E5E7EB' }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: data.color }}>
                                        {data.name} ({data.percentage}%)
                                      </Typography>
                                      <Typography variant="caption" display="block">
                                        Alloué: {formatCurrency(data.allocated, currency)}
                                      </Typography>
                                      <Typography variant="caption" display="block">
                                        Dépensé: {formatCurrency(data.spent, currency)}
                                      </Typography>
                                      <Typography variant="caption" display="block" sx={{ color: data.remaining >= 0 ? '#10B981' : '#EF4444' }}>
                                        Restant: {formatCurrency(data.remaining, currency)}
                                      </Typography>
                                    </Box>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend
                              payload={savingsCategories.map(cat => ({
                                value: `${cat.name} (${cat.percentage}%)`,
                                type: 'square' as const,
                                color: cat.color,
                              }))}
                            />
                          </PieChart>
                        </ResponsiveContainer>

                        {/* Légende du camembert */}
                        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 12, height: 12, bgcolor: '#10B981', opacity: 0.3, borderRadius: 1 }} />
                            <Typography variant="caption" color="text.secondary">Non dépensé</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 12, height: 12, bgcolor: '#10B981', borderRadius: 1 }} />
                            <Typography variant="caption" color="text.secondary">Dépensé</Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Grid>

                    {/* Détail par catégorie */}
                    <Grid item xs={12} md={7}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {savingsCategories.map((cat) => {
                          const spentPercent = cat.allocated_amount > 0
                            ? Math.min((cat.spent_amount / cat.allocated_amount) * 100, 100)
                            : 0;
                          const isOverBudget = cat.spent_amount > cat.allocated_amount;

                          return (
                            <Box
                              key={cat.id}
                              sx={{
                                p: 2,
                                borderRadius: 2,
                                border: '1px solid #E5E7EB',
                                bgcolor: '#FAFAFA',
                              }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                                      bgcolor: cat.color + '20',
                                      color: cat.color,
                                      fontWeight: 600,
                                    }}
                                  />
                                  {isOverBudget && (
                                    <Chip
                                      label="Dépassé"
                                      size="small"
                                      sx={{
                                        bgcolor: '#FEE2E2',
                                        color: '#EF4444',
                                        fontWeight: 600,
                                      }}
                                    />
                                  )}
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <Tooltip title="Modifier">
                                    <IconButton size="small" onClick={() => openSavingsCategoryDialog(cat)}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Supprimer">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDeleteSavingsCategory(cat.id)}
                                      sx={{ color: 'error.main' }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Box>

                              {cat.description && (
                                <Typography variant="body2" sx={{ color: '#6B7280', mb: 1.5, fontSize: '0.8rem' }}>
                                  {cat.description}
                                </Typography>
                              )}

                              {/* Barre de progression: dépensé / alloué */}
                              <Box sx={{ mb: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={spentPercent}
                                  sx={{
                                    height: 8,
                                    borderRadius: 4,
                                    bgcolor: cat.color + '30',
                                    '& .MuiLinearProgress-bar': {
                                      bgcolor: isOverBudget ? '#EF4444' : cat.color,
                                      borderRadius: 4,
                                    },
                                  }}
                                />
                              </Box>

                              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                <Typography variant="caption" sx={{ color: '#6B7280' }}>
                                  Dépensé: <strong>{formatCurrency(cat.spent_amount, currency)}</strong> / {formatCurrency(cat.allocated_amount, currency)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontWeight: 600,
                                    color: isOverBudget ? '#EF4444' : '#10B981',
                                  }}
                                >
                                  Restant: {formatCurrency(cat.remaining_amount, currency)}
                                </Typography>
                              </Box>

                              {/* Montants du mois */}
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '0.7rem' }}>
                                  Ce mois: {formatCurrency(cat.current_month_spent, currency)} dépensé / {formatCurrency(cat.current_month_allocated, currency)} alloué
                                </Typography>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Grid>
                  </Grid>
                )}
              </Paper>

              {/* Explication */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  mt: 3,
                  borderRadius: 3,
                  bgcolor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1E293B', mb: 1 }}>
                  Comment fonctionne l'épargne ?
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B' }}>
                  Chaque mois, {savingsSummary?.percentage || 0}% de {isPersonalAccount ? 'vos revenus' : 'votre chiffre d\'affaires'} est automatiquement
                  alloué à l'épargne. Ce montant est ensuite réparti entre vos différentes catégories d'épargne
                  selon leurs pourcentages respectifs. Lorsque vous assignez une transaction à une catégorie d'épargne,
                  le montant est comptabilisé comme dépensé et déduit du solde restant.
                </Typography>
              </Paper>
            </Box>
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 6,
                borderRadius: 4,
                border: '1px solid #E5E7EB',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                minHeight: 400,
              }}
            >
              <Box
                sx={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  bgcolor: '#FEF9E7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3,
                }}
              >
                <SavingsIcon sx={{ fontSize: 50, color: '#F5C518' }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>
                Aucun budget d'épargne configuré
              </Typography>
              <Typography variant="body1" sx={{ color: '#9CA3AF', maxWidth: 450, mb: 3 }}>
                Pour suivre votre épargne, vous devez d'abord configurer un budget d'épargne
                dans l'onglet Budgets. Activez l'option "Épargne" sur une catégorie de budget.
              </Typography>
              <Button
                variant="contained"
                startIcon={<SettingsIcon />}
                onClick={() => router.push('/dashboard/budget')}
                sx={{
                  bgcolor: '#F5C518',
                  color: '#1A1A1A',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: '#E0B000',
                  },
                }}
              >
                Configurer un budget d'épargne
              </Button>
            </Paper>
          )}
        </>
      )}

      {/* Contenu de l'onglet Temps */}
      {activeTab === 'temps' && (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            borderRadius: 4,
            border: '1px solid #E5E7EB',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: 400,
          }}
        >
          <Box
            sx={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              bgcolor: '#EBF5FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <TimeIcon sx={{ fontSize: 50, color: '#3B82F6' }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>
            Suivi du temps
          </Typography>
          <Typography variant="body1" sx={{ color: '#9CA3AF', maxWidth: 400, mb: 3 }}>
            Gérez et analysez le temps passé sur vos projets et activités.
            Suivez votre productivité et optimisez votre organisation.
          </Typography>
          <Typography
            variant="body2"
            sx={{
              px: 3,
              py: 1,
              bgcolor: '#F3F4F6',
              borderRadius: 2,
              color: '#6B7280',
              fontWeight: 500,
            }}
          >
            Bientôt disponible
          </Typography>
        </Paper>
      )}

      {/* Dialog pour créer/modifier une catégorie d'épargne */}
      <Dialog
        open={savingsCategoryDialog}
        onClose={() => setSavingsCategoryDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingSavingsCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie d\'épargne'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom de la catégorie"
            fullWidth
            value={newSavingsCategory.name}
            onChange={(e) => setNewSavingsCategory({ ...newSavingsCategory, name: e.target.value })}
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={newSavingsCategory.description}
            onChange={(e) => setNewSavingsCategory({ ...newSavingsCategory, description: e.target.value })}
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            label="Pourcentage de l'épargne (%)"
            type="number"
            fullWidth
            value={newSavingsCategory.percentage}
            onChange={(e) => setNewSavingsCategory({ ...newSavingsCategory, percentage: parseFloat(e.target.value) || 0 })}
            inputProps={{ min: 0, max: 100, step: 1 }}
            sx={{ mb: 2 }}
          />

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Couleur
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <HexColorPicker
                color={newSavingsCategory.color}
                onChange={(color) => setNewSavingsCategory({ ...newSavingsCategory, color })}
                style={{ width: '100%', height: 150 }}
              />
              <Box
                sx={{
                  width: 50,
                  height: 50,
                  borderRadius: 2,
                  bgcolor: newSavingsCategory.color,
                  border: '2px solid',
                  borderColor: 'divider',
                  flexShrink: 0,
                }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSavingsCategoryDialog(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleSaveSavingsCategory}
            disabled={!newSavingsCategory.name}
            sx={{
              bgcolor: '#10B981',
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            {editingSavingsCategory ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de détail d'une catégorie d'épargne */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        {selectedDetailCategory && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: selectedDetailCategory.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SavingsIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {selectedDetailCategory.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedDetailCategory.percentage}% de l'épargne totale
                  </Typography>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              {selectedDetailCategory.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {selectedDetailCategory.description}
                </Typography>
              )}

              {/* Grille de statistiques */}
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Budget du mois
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#10B981' }}>
                      {formatCurrency(selectedDetailCategory.current_month_allocated, currency)}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Report mois précédent
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#3B82F6' }}>
                      {(() => {
                        const previousRemaining = selectedDetailCategory.allocated_amount - selectedDetailCategory.current_month_allocated - (selectedDetailCategory.spent_amount - selectedDetailCategory.current_month_spent);
                        return previousRemaining >= 0 ? '+' : '';
                      })()}
                      {formatCurrency(
                        selectedDetailCategory.allocated_amount - selectedDetailCategory.current_month_allocated - (selectedDetailCategory.spent_amount - selectedDetailCategory.current_month_spent),
                        currency
                      )}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: selectedDetailCategory.color + '15',
                      border: `1px solid ${selectedDetailCategory.color}40`,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Total disponible
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: selectedDetailCategory.color }}>
                      {formatCurrency(selectedDetailCategory.allocated_amount, currency)}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: '#FEF2F2',
                      border: '1px solid #FECACA',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Dépensé
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#EF4444' }}>
                      {formatCurrency(selectedDetailCategory.spent_amount, currency)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ({formatCurrency(selectedDetailCategory.current_month_spent, currency)} ce mois)
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: selectedDetailCategory.remaining_amount >= 0 ? '#F0FDF4' : '#FEF2F2',
                      border: `1px solid ${selectedDetailCategory.remaining_amount >= 0 ? '#BBF7D0' : '#FECACA'}`,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Restant
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        color: selectedDetailCategory.remaining_amount >= 0 ? '#10B981' : '#EF4444',
                      }}
                    >
                      {formatCurrency(selectedDetailCategory.remaining_amount, currency)}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Barre de progression */}
              <Box sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Progression des dépenses
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedDetailCategory.allocated_amount > 0
                      ? Math.round((selectedDetailCategory.spent_amount / selectedDetailCategory.allocated_amount) * 100)
                      : 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(
                    selectedDetailCategory.allocated_amount > 0
                      ? (selectedDetailCategory.spent_amount / selectedDetailCategory.allocated_amount) * 100
                      : 0,
                    100
                  )}
                  sx={{
                    height: 12,
                    borderRadius: 6,
                    bgcolor: selectedDetailCategory.color + '30',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: selectedDetailCategory.spent_amount > selectedDetailCategory.allocated_amount
                        ? '#EF4444'
                        : selectedDetailCategory.color,
                      borderRadius: 6,
                    },
                  }}
                />
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setDetailDialogOpen(false)}>
                Fermer
              </Button>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => {
                  setDetailDialogOpen(false);
                  openSavingsCategoryDialog(selectedDetailCategory);
                }}
                sx={{
                  borderColor: selectedDetailCategory.color,
                  color: selectedDetailCategory.color,
                  '&:hover': {
                    borderColor: selectedDetailCategory.color,
                    bgcolor: selectedDetailCategory.color + '10',
                  },
                }}
              >
                Modifier
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Snackbar pour les notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
