'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import TimePieCharts from '@/components/TimePieCharts';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Divider,
  Chip,
  alpha,
  useTheme,
  Slider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  AccessTime as TimeIcon,
  Work as WorkIcon,
  School as SchoolIcon,
  Weekend as WeekendIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import {
  timeEntriesAPI,
  timeCategoriesAPI,
  timeBudgetSettingsAPI,
  TimeEntryCreate,
  TimeCategory,
} from '@/lib/api';

// Couleurs prédéfinies pour les catégories
const CATEGORY_COLORS = [
  '#8B5CF6', // Violet
  '#3B82F6', // Bleu
  '#10B981', // Vert
  '#F59E0B', // Orange
  '#EF4444', // Rouge
  '#EC4899', // Rose
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

export default function BudgetTempsPage() {
  const theme = useTheme();

  // Data
  const [categories, setCategories] = useState<TimeCategory[]>([]);
  const [initializing, setInitializing] = useState(true);

  // Entry Dialog
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryFormData, setEntryFormData] = useState({
    category_id: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    hours: 0,
    minutes: 0,
    description: '',
  });

  // Settings Dialog
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TimeCategory | null>(null);
  const [creatingDefaults, setCreatingDefaults] = useState(false);
  const [parentForNewCategory, setParentForNewCategory] = useState<TimeCategory | null>(null);

  // Budget settings
  const [weeklyBudgetHours, setWeeklyBudgetHours] = useState(40); // Default 40h/week
  const [savingBudget, setSavingBudget] = useState(false);

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    color: '#8B5CF6',
    icon: 'Work',
    parent_id: null as number | null,
    percentage: 0,  // Pourcentage du budget hebdomadaire global
  });

  // Format duration
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  };

  // Fetch budget settings
  const fetchBudgetSettings = async () => {
    try {
      const res = await timeBudgetSettingsAPI.get();
      setWeeklyBudgetHours(res.data.weekly_budget_hours);
    } catch (error) {
      console.error('Error fetching budget settings:', error);
    }
  };

  // Save budget settings
  const saveBudgetSettings = async (hours: number) => {
    setSavingBudget(true);
    try {
      await timeBudgetSettingsAPI.update({ weekly_budget_hours: hours });
      setWeeklyBudgetHours(hours);
      window.dispatchEvent(new CustomEvent('refresh-time-data'));
    } catch (error) {
      console.error('Error saving budget settings:', error);
    } finally {
      setSavingBudget(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const res = await timeCategoriesAPI.getAll();
      setCategories(res.data || []);
      return res.data || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  };

  // Create default categories
  const createDefaultCategories = async () => {
    try {
      setCreatingDefaults(true);
      const res = await timeCategoriesAPI.seedDefaults();
      console.log('seedDefaults response:', res);
      // Refresh categories after creation
      const cats = await fetchCategories();
      console.log('Categories after fetch:', cats);
      window.dispatchEvent(new CustomEvent('refresh-time-data'));
      return cats;
    } catch (error: any) {
      console.error('Error creating default categories:', error);
      const message = error.response?.data?.detail || 'Erreur lors de la création des catégories';
      alert(message);
      return [];
    } finally {
      setCreatingDefaults(false);
    }
  };

  // Initialize - fetch settings and create default categories if needed
  useEffect(() => {
    const init = async () => {
      setInitializing(true);
      await fetchBudgetSettings();
      const cats = await fetchCategories();
      if (cats.length === 0) {
        await createDefaultCategories();
      }
      setInitializing(false);
    };
    init();
  }, []);

  // Helper pour aplatir les catégories (pour les select et le comptage)
  const getFlatCategories = (): TimeCategory[] => {
    const flat: TimeCategory[] = [];
    const addCategory = (cat: TimeCategory) => {
      flat.push(cat);
      if (cat.children) {
        cat.children.forEach(addCategory);
      }
    };
    categories.forEach(addCategory);
    return flat;
  };

  // === ENTRY DIALOG ===

  const handleOpenEntryDialog = () => {
    const flatCats = getFlatCategories();
    setEntryFormData({
      category_id: flatCats.length > 0 ? flatCats[0].id : 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      hours: 0,
      minutes: 0,
      description: '',
    });
    setEntryDialogOpen(true);
  };

  const handleSaveEntry = async () => {
    try {
      const duration_minutes = entryFormData.hours * 60 + entryFormData.minutes;

      if (duration_minutes <= 0) {
        alert('Veuillez entrer une durée valide');
        return;
      }

      const data: TimeEntryCreate = {
        category_id: entryFormData.category_id,
        date: entryFormData.date,
        duration_minutes,
        description: entryFormData.description || undefined,
      };

      await timeEntriesAPI.create(data);

      setEntryDialogOpen(false);
      window.dispatchEvent(new CustomEvent('refresh-time-data'));
    } catch (error: any) {
      console.error('Error saving time entry:', error);
      alert(error.response?.data?.detail || 'Erreur lors de la sauvegarde');
    }
  };

  // === CATEGORY DIALOG ===

  // Ouvrir le dialog pour créer/modifier une catégorie
  // Si parentCategory est passé, on crée une sous-catégorie
  const handleOpenCategoryDialog = (category?: TimeCategory, parentCategory?: TimeCategory) => {
    if (category) {
      // Mode édition
      setEditingCategory(category);
      setParentForNewCategory(null);
      setCategoryFormData({
        name: category.name,
        description: category.description || '',
        color: category.color,
        icon: category.icon || 'Work',
        parent_id: category.parent_id || null,
        percentage: category.percentage || 0,
      });
    } else {
      // Mode création
      setEditingCategory(null);
      setParentForNewCategory(parentCategory || null);
      // Compter les catégories existantes pour la couleur
      const flatCategories = getFlatCategories();
      setCategoryFormData({
        name: '',
        description: '',
        color: parentCategory?.color || CATEGORY_COLORS[flatCategories.length % CATEGORY_COLORS.length],
        icon: parentCategory?.icon || 'Work',
        parent_id: parentCategory?.id || null,
        percentage: 0,
      });
    }
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    try {
      if (editingCategory) {
        await timeCategoriesAPI.update(editingCategory.id, {
          name: categoryFormData.name,
          description: categoryFormData.description || undefined,
          color: categoryFormData.color,
          icon: categoryFormData.icon,
          percentage: categoryFormData.percentage,
        });
      } else {
        await timeCategoriesAPI.create({
          name: categoryFormData.name,
          description: categoryFormData.description || undefined,
          color: categoryFormData.color,
          icon: categoryFormData.icon,
          parent_id: categoryFormData.parent_id,
          percentage: categoryFormData.percentage,
        });
      }

      setCategoryDialogOpen(false);
      setParentForNewCategory(null);
      await fetchCategories();
      window.dispatchEvent(new CustomEvent('refresh-time-data'));
    } catch (error: any) {
      console.error('Error saving category:', error);
      alert(error.response?.data?.detail || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Supprimer cette catégorie ?')) return;
    try {
      await timeCategoriesAPI.delete(id);
      await fetchCategories();
      window.dispatchEvent(new CustomEvent('refresh-time-data'));
    } catch (error: any) {
      console.error('Error deleting category:', error);
      alert(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  // Get category icon
  const getCategoryIcon = (iconName?: string, color?: string) => {
    const sx = { fontSize: 18, color: color || '#8B5CF6' };
    switch (iconName) {
      case 'Work': return <WorkIcon sx={sx} />;
      case 'School': return <SchoolIcon sx={sx} />;
      case 'Weekend': return <WeekendIcon sx={sx} />;
      default: return <TimeIcon sx={sx} />;
    }
  };

  if (initializing) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Typography color="text.secondary">Chargement...</Typography>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Budget temps
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez votre temps entre travail, formation et repos
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            onClick={() => setSettingsDialogOpen(true)}
            sx={{
              bgcolor: alpha(theme.palette.grey[500], 0.1),
              '&:hover': { bgcolor: alpha('#8B5CF6', 0.2) },
            }}
          >
            <SettingsIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenEntryDialog}
            sx={{ bgcolor: '#8B5CF6', '&:hover': { bgcolor: '#7C3AED' } }}
          >
            Enregistrer du temps
          </Button>
        </Box>
      </Box>

      {/* Pie chart - full width */}
      <TimePieCharts renderMode="full" />

      {/* === SETTINGS DIALOG === */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon sx={{ color: '#8B5CF6' }} />
            <Typography variant="h6">Paramètres du budget temps</Typography>
          </Box>
          <IconButton onClick={() => setSettingsDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          {/* Budget hebdomadaire global */}
          <Box sx={{ mb: 3, p: 2, bgcolor: alpha('#8B5CF6', 0.05), borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Budget hebdomadaire global
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                label="Heures par semaine"
                type="number"
                value={weeklyBudgetHours}
                onChange={(e) => setWeeklyBudgetHours(Math.max(1, parseFloat(e.target.value) || 40))}
                inputProps={{ min: 1, max: 168, step: 0.5 }}
                size="small"
                sx={{ width: 150 }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={() => saveBudgetSettings(weeklyBudgetHours)}
                disabled={savingBudget}
                sx={{ bgcolor: '#8B5CF6', '&:hover': { bgcolor: '#7C3AED' } }}
              >
                {savingBudget ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Ce budget sera réparti entre les catégories selon leurs pourcentages
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Catégories de temps
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleOpenCategoryDialog()}
              sx={{ color: '#8B5CF6' }}
            >
              Ajouter
            </Button>
          </Box>

          {categories.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {categories.map((cat) => (
                <Box key={cat.id}>
                  {/* Catégorie parente */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      bgcolor: alpha(cat.color, 0.1),
                      borderRadius: 2,
                      border: `1px solid ${alpha(cat.color, 0.3)}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        bgcolor: alpha(cat.color, 0.2),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {getCategoryIcon(cat.icon, cat.color)}
                      </Box>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {cat.name}
                          </Typography>
                          <Chip
                            label={`${cat.percentage || 0}%`}
                            size="small"
                            sx={{ height: 18, fontSize: '0.65rem', bgcolor: alpha(cat.color, 0.2), color: cat.color, fontWeight: 600 }}
                          />
                        </Box>
                        {cat.description && (
                          <Typography variant="caption" color="text.secondary">
                            {cat.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenCategoryDialog(undefined, cat)}
                        title="Ajouter une sous-catégorie"
                        sx={{ color: cat.color }}
                      >
                        <AddIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleOpenCategoryDialog(cat)}>
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteCategory(cat.id)}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Sous-catégories */}
                  {cat.children && cat.children.length > 0 && (
                    <Box sx={{ ml: 3, mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {cat.children.map((child) => (
                        <Box
                          key={child.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1,
                            pl: 1.5,
                            bgcolor: theme.palette.background.paper,
                            borderRadius: 1.5,
                            border: `1px solid ${theme.palette.divider}`,
                            borderLeft: `3px solid ${child.color}`,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: child.color,
                            }} />
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {child.name}
                            </Typography>
                            <Chip
                              label={`${child.percentage || 0}%`}
                              size="small"
                              sx={{ height: 16, fontSize: '0.6rem', bgcolor: alpha(child.color, 0.2), color: child.color, fontWeight: 600 }}
                            />
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <IconButton size="small" onClick={() => handleOpenCategoryDialog(child)}>
                              <EditIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                            <IconButton size="small" onClick={() => handleDeleteCategory(child.id)}>
                              <DeleteIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <TimeIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 1 }} />
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Aucune catégorie configurée
              </Typography>
              <Button
                variant="contained"
                onClick={createDefaultCategories}
                disabled={creatingDefaults}
                sx={{ bgcolor: '#8B5CF6', '&:hover': { bgcolor: '#7C3AED' } }}
              >
                {creatingDefaults ? 'Création en cours...' : 'Créer les catégories par défaut'}
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setSettingsDialogOpen(false)}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      {/* === CATEGORY DIALOG === */}
      <Dialog
        open={categoryDialogOpen}
        onClose={() => {
          setCategoryDialogOpen(false);
          setParentForNewCategory(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle>
          {editingCategory
            ? 'Modifier la catégorie'
            : parentForNewCategory
              ? `Nouvelle sous-catégorie de "${parentForNewCategory.name}"`
              : 'Nouvelle catégorie'
          }
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Indication de la catégorie parente si c'est une sous-catégorie */}
            {parentForNewCategory && !editingCategory && (
              <Box sx={{
                p: 1.5,
                bgcolor: alpha(parentForNewCategory.color, 0.1),
                borderRadius: 1.5,
                border: `1px solid ${alpha(parentForNewCategory.color, 0.3)}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}>
                <Box sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: alpha(parentForNewCategory.color, 0.2),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {getCategoryIcon(parentForNewCategory.icon, parentForNewCategory.color)}
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Sous-catégorie de : {parentForNewCategory.name}
                </Typography>
              </Box>
            )}

            <TextField
              label="Nom"
              value={categoryFormData.name}
              onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
              fullWidth
              required
            />

            <TextField
              label="Description (optionnel)"
              value={categoryFormData.description}
              onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />

            {/* Pourcentage du budget */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Pourcentage du budget
                </Typography>
                <Chip
                  label={`${categoryFormData.percentage}%`}
                  size="small"
                  sx={{ bgcolor: alpha('#8B5CF6', 0.1), color: '#8B5CF6', fontWeight: 600 }}
                />
              </Box>
              <Slider
                value={categoryFormData.percentage}
                onChange={(_, value) => setCategoryFormData({
                  ...categoryFormData,
                  percentage: value as number
                })}
                min={0}
                max={100}
                step={5}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 25, label: '25%' },
                  { value: 50, label: '50%' },
                  { value: 75, label: '75%' },
                  { value: 100, label: '100%' },
                ]}
                sx={{
                  color: '#8B5CF6',
                  '& .MuiSlider-markLabel': { fontSize: '0.7rem' },
                }}
              />
              <Typography variant="caption" color="text.secondary">
                = {formatDuration((categoryFormData.percentage / 100) * weeklyBudgetHours * 60)} par semaine
              </Typography>
            </Box>

            <FormControl fullWidth>
              <InputLabel>Icône</InputLabel>
              <Select
                value={categoryFormData.icon}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, icon: e.target.value })}
                label="Icône"
              >
                <MenuItem value="Work">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WorkIcon sx={{ fontSize: 18 }} /> Travail
                  </Box>
                </MenuItem>
                <MenuItem value="School">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SchoolIcon sx={{ fontSize: 18 }} /> Formation
                  </Box>
                </MenuItem>
                <MenuItem value="Weekend">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WeekendIcon sx={{ fontSize: 18 }} /> Repos
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>Couleur</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {CATEGORY_COLORS.map((color) => (
                  <Box
                    key={color}
                    onClick={() => setCategoryFormData({ ...categoryFormData, color })}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: color,
                      cursor: 'pointer',
                      border: categoryFormData.color === color ? '3px solid' : '2px solid transparent',
                      borderColor: categoryFormData.color === color ? theme.palette.text.primary : 'transparent',
                      '&:hover': { transform: 'scale(1.1)' },
                      transition: 'all 0.2s',
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCategoryDialogOpen(false)}>Annuler</Button>
          <Button
            onClick={handleSaveCategory}
            variant="contained"
            disabled={!categoryFormData.name.trim()}
            sx={{ bgcolor: '#8B5CF6', '&:hover': { bgcolor: '#7C3AED' } }}
          >
            {editingCategory ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* === ENTRY DIALOG === */}
      <Dialog
        open={entryDialogOpen}
        onClose={() => setEntryDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle>
          Enregistrer du temps consommé
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Catégorie</InputLabel>
              <Select
                value={entryFormData.category_id}
                onChange={(e) => setEntryFormData({ ...entryFormData, category_id: e.target.value as number })}
                label="Catégorie"
              >
                {getFlatCategories().map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: cat.color,
                      }} />
                      {getCategoryIcon(cat.icon, cat.color)}
                      {cat.parent_id ? `↳ ${cat.name}` : cat.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Date"
              type="date"
              value={entryFormData.date}
              onChange={(e) => setEntryFormData({ ...entryFormData, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Heures"
                type="number"
                value={entryFormData.hours}
                onChange={(e) => setEntryFormData({ ...entryFormData, hours: parseInt(e.target.value) || 0 })}
                inputProps={{ min: 0, max: 24 }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Minutes"
                type="number"
                value={entryFormData.minutes}
                onChange={(e) => setEntryFormData({ ...entryFormData, minutes: parseInt(e.target.value) || 0 })}
                inputProps={{ min: 0, max: 59 }}
                sx={{ flex: 1 }}
              />
            </Box>

            <TextField
              label="Description (optionnel)"
              value={entryFormData.description}
              onChange={(e) => setEntryFormData({ ...entryFormData, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
              placeholder="Ex: Développement nouvelle fonctionnalité, Réunion client..."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEntryDialogOpen(false)}>Annuler</Button>
          <Button
            onClick={handleSaveEntry}
            variant="contained"
            sx={{ bgcolor: '#8B5CF6', '&:hover': { bgcolor: '#7C3AED' } }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
