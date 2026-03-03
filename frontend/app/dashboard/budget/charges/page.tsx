'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import BudgetPieCharts from '@/components/BudgetPieCharts';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  IconButton,
  Chip,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  FormControlLabel,
  Checkbox,
  Switch,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  SubdirectoryArrowRight as SubIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  DriveFileMove as MoveIcon,
  Savings as SavingsIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { bankAPI, budgetCategoriesAPI, Category, BudgetCategory } from '@/lib/api';
import { useCompanyStore } from '@/store/companyStore';
import { formatCurrency } from '@/lib/currency';
import { HexColorPicker } from 'react-colorful';

export default function ChargesPage() {
  const theme = useTheme();
  const { currentCompany, fetchCurrentCompany } = useCompanyStore();
  const currency = currentCompany?.currency || 'EUR';
  const isPersonalAccount = currentCompany?.account_type === 'personal';

  // Navigation par mois
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [totalRevenue, setTotalRevenue] = useState(0);

  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog principal des paramètres
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Dialog pour configuration des pourcentages
  const [openPercentageDialog, setOpenPercentageDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [newPercentage, setNewPercentage] = useState(0);
  const [editingBudget, setEditingBudget] = useState<BudgetCategory | null>(null);
  const [isSavings, setIsSavings] = useState(false);

  // Paramètres - gestion des catégories
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [openCategoryDialog, setOpenCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'expense' as 'expense' | 'revenue',
    color: '#6B7280',
    parent_id: null as number | null,
  });
  const [expandedCategories, setExpandedCategories] = useState<number[]>([]);

  // Dialog pour déplacer une catégorie
  const [openMoveDialog, setOpenMoveDialog] = useState(false);
  const [movingCategory, setMovingCategory] = useState<Category | null>(null);
  const [newParentId, setNewParentId] = useState<number | null>(null);

  // État pour les catégories expandues dans l'onglet budgets
  const [expandedBudgetCategories, setExpandedBudgetCategories] = useState<number[]>([]);

  // Option pour masquer "Non alloué" (toutes les catégories sont ajoutées)
  const [hideUnallocated, setHideUnallocated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('budget_hideUnallocated');
      return saved === 'true';
    }
    return false;
  });

  // Sauvegarder la préférence quand elle change
  const handleHideUnallocatedChange = (value: boolean) => {
    setHideUnallocated(value);
    localStorage.setItem('budget_hideUnallocated', value.toString());
  };

  const fetchCategories = async () => {
    try {
      const response = await bankAPI.getCategories('expense');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchAllCategories = async () => {
    try {
      const response = await bankAPI.getCategories(undefined, true);
      setAllCategories(response.data);
    } catch (error) {
      console.error('Error fetching all categories:', error);
    }
  };

  const fetchBudgetCategories = async (month?: number, year?: number) => {
    try {
      const targetMonth = month ?? selectedMonth;
      const targetYear = year ?? selectedYear;
      const [budgetsRes, summaryRes] = await Promise.all([
        budgetCategoriesAPI.getAll(targetMonth, targetYear),
        budgetCategoriesAPI.getSummary(targetMonth, targetYear),
      ]);
      setBudgetCategories(budgetsRes.data);
      setTotalRevenue(summaryRes.data.total_revenue);
    } catch (error) {
      console.error('Error fetching budget categories:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        fetchCurrentCompany(),
        fetchCategories(),
        fetchBudgetCategories(selectedMonth, selectedYear),
        fetchAllCategories(),
      ]);
      setLoading(false);
    };
    init();
  }, []);

  // Refetch quand le mois/année change
  useEffect(() => {
    fetchBudgetCategories(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  // Écouter l'événement pour ouvrir les paramètres
  useEffect(() => {
    const handleOpenSettings = () => {
      setSettingsDialogOpen(true);
    };
    window.addEventListener('open-budget-settings', handleOpenSettings);
    return () => {
      window.removeEventListener('open-budget-settings', handleOpenSettings);
    };
  }, []);

  const handleSavePercentage = async () => {
    if (!selectedCategory && !editingBudget) return;

    try {
      if (editingBudget) {
        await budgetCategoriesAPI.update(editingBudget.id, {
          percentage: newPercentage,
          is_savings: isSavings
        });
      } else if (selectedCategory) {
        await budgetCategoriesAPI.create({
          category_id: selectedCategory,
          percentage: newPercentage,
          is_savings: isSavings,
        });
      }
      setOpenPercentageDialog(false);
      setSelectedCategory(null);
      setNewPercentage(0);
      setIsSavings(false);
      setEditingBudget(null);
      fetchBudgetCategories(selectedMonth, selectedYear);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteBudgetCategory = async (id: number) => {
    try {
      await budgetCategoriesAPI.delete(id);
      fetchBudgetCategories();
    } catch (error) {
      console.error('Error deleting budget category:', error);
    }
  };

  const handleEditBudgetCategory = (budget: BudgetCategory) => {
    setEditingBudget(budget);
    setNewPercentage(budget.percentage);
    setIsSavings(budget.is_savings || false);
    setOpenPercentageDialog(true);
  };

  // Gestion des catégories
  const handleCreateCategory = async () => {
    try {
      await bankAPI.createCategory({
        name: newCategory.name,
        type: newCategory.type,
        color: newCategory.color,
        parent_id: newCategory.parent_id || undefined,
      });
      setOpenCategoryDialog(false);
      setNewCategory({ name: '', type: 'expense', color: '#6B7280', parent_id: null });
      setEditingCategory(null);
      fetchAllCategories();
      fetchCategories();
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
      try {
        await bankAPI.deleteCategory(id);
        fetchAllCategories();
        fetchCategories();
      } catch (error) {
        console.error('Error deleting category:', error);
      }
    }
  };

  const toggleCategoryExpand = (id: number) => {
    setExpandedCategories((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleBudgetCategoryExpand = (id: number) => {
    setExpandedBudgetCategories((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleMoveCategory = async () => {
    if (!movingCategory) return;

    try {
      await bankAPI.updateCategory(movingCategory.id, {
        parent_id: newParentId,
      });
      setOpenMoveDialog(false);
      setMovingCategory(null);
      setNewParentId(null);
      fetchAllCategories();
      fetchCategories();
    } catch (error) {
      console.error('Error moving category:', error);
    }
  };

  const openMoveDialogFor = (category: Category) => {
    setMovingCategory(category);
    setNewParentId(category.parent_id || null);
    setOpenMoveDialog(true);
  };

  // Créer les catégories de base automatiquement
  const handleCreateBaseCategories = async () => {
    const baseCategories = isPersonalAccount
      ? [
          { name: 'Quotidien', color: '#3B82F6' },   // Bleu - besoins essentiels (50%)
          { name: 'Plaisirs', color: '#8B5CF6' },     // Violet - envies, loisirs (30%)
        ]
      : [
          { name: 'Loyer', color: '#3B82F6' },       // Bleu
          { name: 'Électricité', color: '#F59E0B' }, // Orange
          { name: 'Internet', color: '#8B5CF6' },    // Violet
          { name: 'Salaires', color: '#10B981' },    // Vert
          { name: 'PUB', color: '#EF4444' },         // Rouge
        ];

    const existingNames = allCategories.map((cat) => cat.name.toLowerCase());

    try {
      for (const cat of baseCategories) {
        // Ne pas créer si une catégorie avec ce nom existe déjà
        if (!existingNames.includes(cat.name.toLowerCase())) {
          await bankAPI.createCategory({
            name: cat.name,
            type: 'expense',
            color: cat.color,
          });
        }
      }
      fetchAllCategories();
      fetchCategories();
    } catch (error) {
      console.error('Error creating base categories:', error);
    }
  };

  // Catégories parentes
  const parentCategories = allCategories.filter((cat) => !cat.parent_id);

  // Total des pourcentages alloués
  const totalPercentage = budgetCategories.reduce((sum, b) => sum + b.percentage, 0);

  // Toutes les catégories de dépenses sans budget
  const allExpenseCategories: Category[] = [];
  allCategories
    .filter((cat) => cat.type === 'expense')
    .forEach((cat) => {
      if (!cat.parent_id) {
        allExpenseCategories.push(cat);
        if (cat.subcategories) {
          cat.subcategories.forEach((sub) => allExpenseCategories.push(sub as Category));
        }
      }
    });

  const categoriesWithoutBudget = allExpenseCategories.filter(
    (cat) => !budgetCategories.some((b) => b.category_id === cat.id)
  );

  const getBudgetForCategory = (categoryId: number) => {
    return budgetCategories.find((b) => b.category_id === categoryId);
  };

  const getSubcategoriesTotalPercentage = (parentCategory: Category) => {
    if (!parentCategory.subcategories) return 0;
    return parentCategory.subcategories.reduce((sum, sub) => {
      const budget = getBudgetForCategory(sub.id);
      return sum + (budget?.percentage || 0);
    }, 0);
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
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
          {isPersonalAccount ? 'Dépenses' : 'Charges'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {isPersonalAccount
            ? 'Gérez votre budget et suivez vos dépenses'
            : 'Gérez vos charges et suivez les dépenses de celles-ci'}
        </Typography>
      </Box>

      {/* Graphique principal */}
      <BudgetPieCharts hideUnallocated={hideUnallocated} />

      {/* Dialog des paramètres (popup modale) */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(10px)',
            maxHeight: '90vh',
          },
        }}
        BackdropProps={{
          sx: {
            bgcolor: alpha(theme.palette.common.black, 0.5),
            backdropFilter: 'blur(4px)',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Paramètres des budgets
          </Typography>
          <IconButton onClick={() => setSettingsDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 0 }}>
            {/* Section gauche: Gestion des catégories */}
            <Box sx={{ flex: 1, pr: 3 }}>
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6">Gestion des catégories</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Paramétrez vos catégories de charges : loyer, électricité, internet, salaires...
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setEditingCategory(null);
                      setNewCategory({ name: '', type: 'expense', color: '#6B7280', parent_id: null });
                      setOpenCategoryDialog(true);
                    }}
                    sx={{
                      bgcolor: '#F5C518',
                      color: '#1A1A1A',
                      '&:hover': { bgcolor: '#E0B000' },
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Nouvelle
                  </Button>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleCreateBaseCategories}
                  sx={{
                    borderColor: alpha(theme.palette.text.secondary, 0.3),
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: '#F5C518',
                      bgcolor: alpha('#F5C518', 0.1),
                    },
                  }}
                >
                  Créer les catégories de base
                </Button>
              </Box>

              {/* Liste des catégories */}
              <Paper sx={{ p: 2, borderRadius: 3, maxHeight: 450, overflow: 'auto' }}>
                <List dense>
                  {allCategories
                    .filter((cat) => cat.type === 'expense' && !cat.parent_id)
                    .map((category) => (
                      <ListItem
                        key={category.id}
                        sx={{
                          bgcolor: alpha(theme.palette.background.default, 0.5),
                          borderRadius: 2,
                          mb: 0.5,
                          '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.5) },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: category.color, ml: 0.5 }} />
                        </ListItemIcon>
                        <ListItemText primary={category.name} />
                        <ListItemSecondaryAction>
                          <IconButton size="small" color="error" onClick={() => handleDeleteCategory(category.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  {allCategories.filter((cat) => cat.type === 'expense' && !cat.parent_id).length === 0 && (
                    <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      Aucune catégorie créée
                    </Typography>
                  )}
                </List>
              </Paper>
            </Box>

            {/* Séparateur vertical */}
            <Box sx={{ width: '1px', bgcolor: 'divider', mx: 0 }} />

            {/* Section droite: Configuration des budgets */}
            <Box sx={{ flex: 1, pl: 3 }}>
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="h6">Configuration des budgets</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Définissez les pourcentages par catégorie
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingBudget(null);
                    setSelectedCategory(null);
                    setNewPercentage(0);
                    setOpenPercentageDialog(true);
                  }}
                  disabled={categoriesWithoutBudget.length === 0}
                  sx={{
                    bgcolor: '#F5C518',
                    color: '#1A1A1A',
                    '&:hover': { bgcolor: '#E0B000' },
                    whiteSpace: 'nowrap',
                  }}
                >
                  Ajouter
                </Button>
              </Box>

            {/* Barre de total */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Total alloué</Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: totalPercentage > 100 ? '#EF4444' : totalPercentage === 100 ? '#10B981' : '#6B7280',
                  }}
                >
                  {totalPercentage.toFixed(1)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(totalPercentage, 100)}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  bgcolor: '#E5E7EB',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: totalPercentage > 100 ? '#EF4444' : totalPercentage === 100 ? '#10B981' : '#F5C518',
                    borderRadius: 5,
                  },
                }}
              />
              {totalPercentage > 100 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Attention: Le total dépasse 100%. Ajustez vos pourcentages.
                </Alert>
              )}

              {/* Option pour masquer "Non alloué" */}
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: alpha(theme.palette.info.main, 0.05),
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={hideUnallocated}
                      onChange={(e) => handleHideUnallocatedChange(e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#F5C518',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          bgcolor: '#F5C518',
                        },
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Toutes mes catégories sont ajoutées
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Masque la part "Non alloué" du camembert. Les dépenses variables (TPE, etc.) ne seront pas affichées.
                      </Typography>
                    </Box>
                  }
                />
              </Box>
            </Paper>

            {/* Liste des budgets par catégorie avec hiérarchie */}
            <Paper sx={{ borderRadius: 3, maxHeight: 450, overflow: 'auto' }}>
              {/* En-têtes des colonnes */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 2,
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                  bgcolor: alpha(theme.palette.background.default, 0.5),
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                <Box sx={{ width: 40 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>
                    Catégorie
                  </Typography>
                </Box>
                <Box sx={{ width: 80, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>
                    %
                  </Typography>
                </Box>
                <Box sx={{ width: 100, textAlign: 'right' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>
                    Budget
                  </Typography>
                </Box>
                <Box sx={{ width: 80, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>
                    Actions
                  </Typography>
                </Box>
              </Box>

              {allCategories
                .filter((cat) => cat.type === 'expense' && !cat.parent_id)
                .map((category) => {
                  const budget = getBudgetForCategory(category.id);

                  return (
                    <Box
                      key={category.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 2,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.5) },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                        <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: category.color }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontWeight: 600 }}>{category.name}</Typography>
                          {budget?.is_savings && (
                            <Tooltip title="Budget d'épargne">
                              <SavingsIcon sx={{ fontSize: 16, color: '#F5C518' }} />
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                      <Box sx={{ width: 80, textAlign: 'center' }}>
                        {budget ? (
                          <Chip
                            label={`${budget.percentage.toFixed(1)}%`}
                            size="small"
                            sx={{
                              bgcolor: alpha(category.color, 0.2),
                              color: category.color,
                              fontWeight: 600,
                            }}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </Box>
                      <Box sx={{ width: 100, textAlign: 'right' }}>
                        <Typography variant="body2">
                          {budget ? formatCurrency(budget.allocated_amount, currency) : '-'}
                        </Typography>
                      </Box>
                      <Box sx={{ width: 80, textAlign: 'center' }}>
                        {budget ? (
                          <>
                            <IconButton size="small" onClick={() => handleEditBudgetCategory(budget)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteBudgetCategory(budget.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </>
                        ) : (
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedCategory(category.id);
                              setNewPercentage(0);
                              setEditingBudget(null);
                              setOpenPercentageDialog(true);
                            }}
                            sx={{ color: '#F5C518' }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                  );
                })}

              {allCategories.filter((cat) => cat.type === 'expense' && !cat.parent_id).length === 0 && (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    Aucune catégorie de dépenses. Créez des catégories à gauche.
                  </Typography>
                </Box>
              )}
            </Paper>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Dialog création/édition catégorie */}
      <Dialog
        open={openCategoryDialog}
        onClose={() => {
          setOpenCategoryDialog(false);
          setEditingCategory(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom de la catégorie"
            fullWidth
            value={newCategory.name}
            onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
            sx={{ mt: 2 }}
          />

          {/* Type masqué - toujours 'expense' */}
          {/*
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={newCategory.type}
              label="Type"
              onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value as 'expense' | 'revenue' })}
            >
              <MenuItem value="expense">Dépense</MenuItem>
              <MenuItem value="revenue">Revenu</MenuItem>
            </Select>
          </FormControl>
          */}

          {/* Catégorie parente masquée - pas de sous-catégories pour le moment */}
          {/*
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Catégorie parente (optionnel)</InputLabel>
            <Select
              value={newCategory.parent_id || ''}
              label="Catégorie parente (optionnel)"
              onChange={(e) =>
                setNewCategory({
                  ...newCategory,
                  parent_id: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <MenuItem value="">
                <em>Aucune (catégorie principale)</em>
              </MenuItem>
              {parentCategories
                .filter((cat) => cat.type === newCategory.type)
                .map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cat.color }} />
                      {cat.name}
                    </Box>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          */}

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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenCategoryDialog(false);
              setEditingCategory(null);
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleCreateCategory}
            variant="contained"
            disabled={!newCategory.name}
            sx={{
              bgcolor: '#F5C518',
              color: '#1A1A1A',
              '&:hover': { bgcolor: '#E0B000' },
            }}
          >
            {editingCategory ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog configuration pourcentage */}
      <Dialog
        open={openPercentageDialog}
        onClose={() => {
          setOpenPercentageDialog(false);
          setEditingBudget(null);
          setIsSavings(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingBudget ? 'Modifier le pourcentage' : 'Ajouter un budget par catégorie'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {error}
            </Alert>
          )}

          {!editingBudget && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Catégorie</InputLabel>
              <Select
                value={selectedCategory || ''}
                label="Catégorie"
                onChange={(e) => setSelectedCategory(Number(e.target.value))}
              >
                {categoriesWithoutBudget.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: cat.parent_id ? 2 : 0 }}>
                      {cat.parent_id && <SubIcon sx={{ color: '#9CA3AF', fontSize: 16 }} />}
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cat.color }} />
                      {cat.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {editingBudget && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: editingBudget.category?.color || '#6B7280' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {editingBudget.category?.name}
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 3 }}>
            <TextField
              fullWidth
              label="Pourcentage du revenu"
              type="number"
              value={newPercentage}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value >= 0 && value <= 100) {
                  setNewPercentage(value);
                } else if (e.target.value === '') {
                  setNewPercentage(0);
                }
              }}
              InputProps={{
                endAdornment: <Typography sx={{ color: '#6B7280' }}>%</Typography>,
              }}
              inputProps={{ min: 0, max: 100, step: 0.1 }}
              helperText="Entrez une valeur entre 0 et 100"
            />
          </Box>

          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">0%</Typography>
              <Typography variant="caption" color="text.secondary">100%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(newPercentage, 100)}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: '#E5E7EB',
                '& .MuiLinearProgress-bar': {
                  bgcolor: newPercentage > 100 ? '#EF4444' : '#F5C518',
                  borderRadius: 4,
                },
              }}
            />
          </Box>

          <Box sx={{ mt: 3, p: 2, bgcolor: '#FEF9E7', borderRadius: 2, border: '1px solid #F5C518' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={isSavings}
                  onChange={(e) => setIsSavings(e.target.checked)}
                  sx={{ color: '#F5C518', '&.Mui-checked': { color: '#F5C518' } }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SavingsIcon sx={{ color: '#F5C518', fontSize: 20 }} />
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Budget d'épargne
                  </Typography>
                </Box>
              }
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
              Le montant s'accumulera mois après mois.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenPercentageDialog(false);
              setEditingBudget(null);
              setIsSavings(false);
              setError(null);
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSavePercentage}
            variant="contained"
            disabled={!editingBudget && !selectedCategory}
            sx={{
              bgcolor: '#F5C518',
              color: '#1A1A1A',
              '&:hover': { bgcolor: '#E0B000' },
            }}
          >
            {editingBudget ? 'Modifier' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog déplacer catégorie - masqué pour le moment (pas de sous-catégories) */}
      {/*
      <Dialog
        open={openMoveDialog}
        onClose={() => {
          setOpenMoveDialog(false);
          setMovingCategory(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Déplacer la catégorie</DialogTitle>
        <DialogContent>
          {movingCategory && (
            <>
              <Box sx={{ mt: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 1.5, p: 2, bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 2 }}>
                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: movingCategory.color }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {movingCategory.name}
                </Typography>
                <Chip
                  label={movingCategory.type === 'expense' ? 'Dépense' : 'Revenu'}
                  size="small"
                  sx={{
                    bgcolor: movingCategory.type === 'expense' ? '#FEF2F2' : '#ECFDF5',
                    color: movingCategory.type === 'expense' ? '#EF4444' : '#10B981',
                  }}
                />
              </Box>

              <FormControl fullWidth>
                <InputLabel>Nouvelle catégorie parente</InputLabel>
                <Select
                  value={newParentId || ''}
                  label="Nouvelle catégorie parente"
                  onChange={(e) => setNewParentId(e.target.value ? Number(e.target.value) : null)}
                >
                  <MenuItem value="">
                    <em>Aucune (catégorie principale)</em>
                  </MenuItem>
                  {allCategories
                    .filter(
                      (cat) =>
                        cat.type === movingCategory.type &&
                        !cat.parent_id &&
                        cat.id !== movingCategory.id &&
                        cat.id !== movingCategory.parent_id
                    )
                    .map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: cat.color }} />
                          {cat.name}
                        </Box>
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {newParentId === null && movingCategory.parent_id && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Cette catégorie deviendra une catégorie principale.
                </Alert>
              )}

              {newParentId && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Cette catégorie deviendra une sous-catégorie de{' '}
                  <strong>{allCategories.find((c) => c.id === newParentId)?.name}</strong>.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenMoveDialog(false);
              setMovingCategory(null);
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleMoveCategory}
            variant="contained"
            sx={{
              bgcolor: '#F5C518',
              color: '#1A1A1A',
              '&:hover': { bgcolor: '#E0B000' },
            }}
          >
            Déplacer
          </Button>
        </DialogActions>
      </Dialog>
      */}
    </DashboardLayout>
  );
}
