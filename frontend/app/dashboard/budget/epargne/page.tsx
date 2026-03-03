'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import SavingsPieCharts from '@/components/SavingsPieCharts';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Slider,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Savings as SavingsIcon,
  Close as CloseIcon,
  TrendingUp as GrowthIcon,
  Build as InvestIcon,
  School as FormationIcon,
} from '@mui/icons-material';
import { savingsCategoriesAPI, budgetCategoriesAPI, SavingsCategory, SavingsCategorySummary } from '@/lib/api';
import { useCompanyStore } from '@/store/companyStore';
import { formatCurrency } from '@/lib/currency';
import { HexColorPicker } from 'react-colorful';

export default function EpargnePage() {
  const theme = useTheme();
  const { currentCompany } = useCompanyStore();
  const currency = currentCompany?.currency || 'EUR';
  const isPersonalAccount = currentCompany?.account_type === 'personal';

  // Navigation par mois
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  // Données
  const [savingsCategories, setSavingsCategories] = useState<SavingsCategory[]>([]);
  const [summary, setSummary] = useState<SavingsCategorySummary | null>(null);
  const [savingsPercentage, setSavingsPercentage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Dialog principal des paramètres
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Dialog pour éditer une catégorie
  const [openCategoryDialog, setOpenCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SavingsCategory | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    color: '#10B981',
    percentage: 0,
  });

  // Dialog pour le pourcentage global d'épargne
  const [openSavingsPercentDialog, setOpenSavingsPercentDialog] = useState(false);
  const [tempSavingsPercent, setTempSavingsPercent] = useState(0);

  const formatAmount = (amount: number) => formatCurrency(amount, currency);

  const fetchSavingsData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, summaryRes] = await Promise.all([
        savingsCategoriesAPI.getAll(selectedMonth, selectedYear),
        savingsCategoriesAPI.getSummary(selectedMonth, selectedYear),
      ]);
      setSavingsCategories(categoriesRes.data);
      setSummary(summaryRes.data);
      setSavingsPercentage(summaryRes.data.total_savings_percentage);
    } catch (error) {
      console.error('Error fetching savings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavingsPercentage = async () => {
    try {
      const res = await budgetCategoriesAPI.getSavingsSummary();
      setSavingsPercentage(res.data.percentage);
    } catch (error) {
      console.error('Error fetching savings percentage:', error);
    }
  };

  useEffect(() => {
    fetchSavingsData();
  }, [selectedMonth, selectedYear]);

  // Écouter l'événement d'ouverture des paramètres
  useEffect(() => {
    const handleOpenSettings = () => setSettingsDialogOpen(true);
    window.addEventListener('open-savings-settings', handleOpenSettings);
    return () => window.removeEventListener('open-savings-settings', handleOpenSettings);
  }, []);

  const handleCreateDefaultCategories = async () => {
    try {
      await savingsCategoriesAPI.seedDefaults();
      fetchSavingsData();
      // Notifier les composants SavingsPieCharts de rafraîchir leurs données
      window.dispatchEvent(new CustomEvent('refresh-savings-data'));
    } catch (error: any) {
      console.error('Error creating default categories:', error);
    }
  };

  const handleSaveCategory = async () => {
    try {
      if (editingCategory) {
        await savingsCategoriesAPI.update(editingCategory.id, {
          name: newCategory.name,
          description: newCategory.description,
          color: newCategory.color,
          percentage: newCategory.percentage,
        });
      } else {
        await savingsCategoriesAPI.create({
          name: newCategory.name,
          description: newCategory.description,
          color: newCategory.color,
          percentage: newCategory.percentage,
        });
      }
      setOpenCategoryDialog(false);
      setEditingCategory(null);
      setNewCategory({ name: '', description: '', color: '#10B981', percentage: 0 });
      fetchSavingsData();
      // Notifier les composants SavingsPieCharts de rafraîchir leurs données
      window.dispatchEvent(new CustomEvent('refresh-savings-data'));
    } catch (error: any) {
      console.error('Error saving category:', error);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Supprimer cette catégorie d\'épargne ?')) return;
    try {
      await savingsCategoriesAPI.delete(id);
      fetchSavingsData();
      // Notifier les composants SavingsPieCharts de rafraîchir leurs données
      window.dispatchEvent(new CustomEvent('refresh-savings-data'));
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const handleUpdateSavingsPercentage = async () => {
    try {
      // Trouver ou créer le budget d'épargne
      const budgetsRes = await budgetCategoriesAPI.getAll();
      const savingsBudget = budgetsRes.data.find(b => b.is_savings);

      if (savingsBudget) {
        await budgetCategoriesAPI.update(savingsBudget.id, { percentage: tempSavingsPercent });
      } else {
        // Créer un budget d'épargne sans category_id (optionnel pour is_savings=true)
        await budgetCategoriesAPI.create({
          percentage: tempSavingsPercent,
          is_savings: true,
        });
      }
      setOpenSavingsPercentDialog(false);
      setSavingsPercentage(tempSavingsPercent);
      fetchSavingsData();
      // Notifier les composants SavingsPieCharts de rafraîchir leurs données
      window.dispatchEvent(new CustomEvent('refresh-savings-data'));
    } catch (error) {
      console.error('Error updating savings percentage:', error);
    }
  };

  const openEditDialog = (category: SavingsCategory) => {
    setEditingCategory(category);
    setNewCategory({
      name: category.name,
      description: category.description || '',
      color: category.color,
      percentage: category.percentage,
    });
    setOpenCategoryDialog(true);
  };

  const totalCategoryPercentage = savingsCategories.reduce((sum, cat) => sum + cat.percentage, 0);

  const getCategoryIcon = (name: string) => {
    if (name.toLowerCase().includes('croissance')) return <GrowthIcon />;
    if (name.toLowerCase().includes('investissement')) return <InvestIcon />;
    if (name.toLowerCase().includes('formation')) return <FormationIcon />;
    return <SavingsIcon />;
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
          Épargne
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Gérez votre épargne et suivez vos objectifs financiers
        </Typography>
      </Box>

      {/* Graphique principal */}
      <SavingsPieCharts />

      {/* Dialog des paramètres */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: theme.palette.background.paper,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SavingsIcon sx={{ color: '#10B981' }} />
            <Typography variant="h6">Paramètres d'épargne</Typography>
          </Box>
          <IconButton onClick={() => setSettingsDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {/* Pourcentage global d'épargne */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6">Pourcentage d'épargne</Typography>
                <Typography variant="body2" color="text.secondary">
                  {isPersonalAccount ? 'Part des revenus mensuels à mettre de côté' : 'Part du CA mensuel à mettre de côté'}
                </Typography>
              </Box>
              <Chip
                label={`${savingsPercentage}%`}
                sx={{
                  bgcolor: '#10B981',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '1rem',
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Slider
                value={savingsPercentage}
                onChange={(_, value) => setSavingsPercentage(value as number)}
                onChangeCommitted={async (_, value) => {
                  const newPercent = value as number;
                  // Sauvegarder directement
                  try {
                    const budgetsRes = await budgetCategoriesAPI.getAll();
                    const savingsBudget = budgetsRes.data.find(b => b.is_savings);
                    if (savingsBudget) {
                      await budgetCategoriesAPI.update(savingsBudget.id, { percentage: newPercent });
                    } else {
                      // Créer le budget d'épargne s'il n'existe pas (sans category_id)
                      await budgetCategoriesAPI.create({
                        percentage: newPercent,
                        is_savings: true,
                      });
                    }
                    // Notifier les composants SavingsPieCharts de rafraîchir leurs données
                    window.dispatchEvent(new CustomEvent('refresh-savings-data'));
                  } catch (error) {
                    console.error('Error updating savings percentage:', error);
                    // En cas d'erreur, recharger les données pour avoir la vraie valeur
                    fetchSavingsData();
                  }
                }}
                min={0}
                max={50}
                valueLabelDisplay="auto"
                sx={{
                  flex: 1,
                  color: '#10B981',
                  '& .MuiSlider-thumb': { bgcolor: '#10B981' },
                  '& .MuiSlider-track': { bgcolor: '#10B981' },
                }}
              />
            </Box>
            {summary && (
              <Box sx={{ mt: 2, p: 2, bgcolor: alpha('#10B981', 0.1), borderRadius: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Alloué ce mois</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#10B981' }}>
                      {formatAmount(summary.current_month_allocated)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Total alloué</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {formatAmount(summary.total_allocated)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Dépensé</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#EF4444' }}>
                      {formatAmount(summary.total_spent)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Solde restant</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: summary.total_remaining >= 0 ? '#10B981' : '#EF4444' }}>
                      {formatAmount(summary.total_remaining)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>

          {/* Catégories d'épargne */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6">Répartition de l'épargne</Typography>
                <Typography variant="body2" color="text.secondary">
                  Comment répartir votre épargne entre différents objectifs
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {savingsCategories.length === 0 && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleCreateDefaultCategories}
                    sx={{
                      borderColor: alpha(theme.palette.text.secondary, 0.3),
                      color: 'text.secondary',
                      '&:hover': {
                        borderColor: '#10B981',
                        bgcolor: alpha('#10B981', 0.1),
                      },
                    }}
                  >
                    Créer catégories par défaut
                  </Button>
                )}
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingCategory(null);
                    setNewCategory({ name: '', description: '', color: '#10B981', percentage: 0 });
                    setOpenCategoryDialog(true);
                  }}
                  sx={{
                    bgcolor: '#10B981',
                    color: 'white',
                    '&:hover': { bgcolor: '#059669' },
                  }}
                >
                  Nouvelle
                </Button>
              </Box>
            </Box>

            {/* Barre de progression du total */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Total alloué
                </Typography>
                <Typography variant="caption" sx={{ color: totalCategoryPercentage > 100 ? '#EF4444' : 'text.secondary' }}>
                  {totalCategoryPercentage.toFixed(0)}% / 100%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(totalCategoryPercentage, 100)}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: alpha('#10B981', 0.2),
                  '& .MuiLinearProgress-bar': {
                    bgcolor: totalCategoryPercentage > 100 ? '#EF4444' : '#10B981',
                    borderRadius: 4,
                  },
                }}
              />
            </Box>

            {totalCategoryPercentage > 100 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Le total des pourcentages dépasse 100%. Ajustez vos répartitions.
              </Alert>
            )}

            {/* Liste des catégories */}
            <Paper sx={{ borderRadius: 2 }}>
              <List dense>
                {savingsCategories.map((cat) => (
                  <ListItem
                    key={cat.id}
                    sx={{
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <ListItemIcon>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 2,
                          bgcolor: alpha(cat.color, 0.2),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: cat.color,
                        }}
                      >
                        {getCategoryIcon(cat.name)}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {cat.name}
                          </Typography>
                          <Chip
                            label={`${cat.percentage}%`}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              bgcolor: alpha(cat.color, 0.2),
                              color: cat.color,
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          {cat.description && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {cat.description}
                            </Typography>
                          )}
                          <Typography variant="caption" sx={{ color: cat.remaining_amount >= 0 ? '#10B981' : '#EF4444' }}>
                            Solde: {formatAmount(cat.remaining_amount)}
                          </Typography>
                        </Box>
                      }
                    />
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => openEditDialog(cat)}>
                        <EditIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteCategory(cat.id)} sx={{ color: '#EF4444' }}>
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  </ListItem>
                ))}
                {savingsCategories.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary={
                        <Typography color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                          Aucune catégorie d'épargne configurée
                        </Typography>
                      }
                    />
                  </ListItem>
                )}
              </List>
            </Paper>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Dialog pour créer/éditer une catégorie */}
      <Dialog
        open={openCategoryDialog}
        onClose={() => setOpenCategoryDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie d\'épargne'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Nom"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Description"
              value={newCategory.description}
              onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>Pourcentage: {newCategory.percentage}%</Typography>
              <Slider
                value={newCategory.percentage}
                onChange={(_, value) => setNewCategory({ ...newCategory, percentage: value as number })}
                min={0}
                max={100}
                valueLabelDisplay="auto"
                sx={{ color: newCategory.color }}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>Couleur</Typography>
              <HexColorPicker
                color={newCategory.color}
                onChange={(color) => setNewCategory({ ...newCategory, color })}
                style={{ width: '100%', height: 150 }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCategoryDialog(false)}>Annuler</Button>
          <Button
            onClick={handleSaveCategory}
            variant="contained"
            sx={{ bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' } }}
          >
            {editingCategory ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
