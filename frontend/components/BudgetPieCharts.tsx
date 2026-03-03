'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Popover,
  Button,
  useTheme,
  alpha,
  Fade,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  Category as CategoryIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Receipt as ReceiptIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
  Sector,
} from 'recharts';
import { budgetCategoriesAPI, BudgetSummary, BudgetCategory, transactionsAPI, Transaction, bankAPI, Category, API_BASE_URL } from '@/lib/api';
import { format, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCompanyStore } from '@/store/companyStore';
import { formatCurrency } from '@/lib/currency';
import { useRouter } from 'next/navigation';
import { AccountBalance as AccountBalanceIcon } from '@mui/icons-material';

// Types pour les modes d'interaction
type InteractionMode = 'overview' | 'selected' | 'details';

interface BudgetPieChartsProps {
  onCategoryClick?: (category: BudgetCategory) => void;
  currentDate?: Date; // Date externe pour synchroniser avec le dashboard
  renderMode?: 'full' | 'pie-only' | 'detail-only'; // Mode d'affichage
  hideUnallocated?: boolean; // Masquer la part "Non alloué" du camembert
}

// Types pour le popup
interface ParentCategoryData {
  id: number;
  name: string;
  color: string;
  totalPercentage: number;
  totalAllocated: number;
  totalCarriedOver: number;
  totalAvailable: number;
  totalSpent: number;
  totalRemaining: number;
  subcategories: BudgetCategory[];
}

interface SubcategoryTransactions {
  subcategory: BudgetCategory;
  transactions: Transaction[];
  totalRevenue: number;
  totalExpense: number;
}

export default function BudgetPieCharts({ onCategoryClick, currentDate: externalDate, renderMode = 'full', hideUnallocated = false }: BudgetPieChartsProps) {
  const theme = useTheme();
  const router = useRouter();
  const { currentCompany } = useCompanyStore();
  const currency = currentCompany?.currency || 'EUR';
  const isPersonalAccount = currentCompany?.account_type === 'personal';
  const containerRef = useRef<HTMLDivElement>(null);

  // Utiliser la date externe si fournie, sinon état local
  const [internalDate, setInternalDate] = useState(new Date());
  const currentDate = externalDate || internalDate;
  const setCurrentDate = setInternalDate;
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  // États pour l'interactivité du camembert
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('overview');
  const [hoveredSliceId, setHoveredSliceId] = useState<number | null>(null);
  const [selectedSliceId, setSelectedSliceId] = useState<number | null>(null);
  const [selectedCategoryData, setSelectedCategoryData] = useState<ParentCategoryData | null>(null);
  const [categoryTransactions, setCategoryTransactions] = useState<Transaction[]>([]);
  const [loadingCategoryTransactions, setLoadingCategoryTransactions] = useState(false);
  const [showUnallocatedPanel, setShowUnallocatedPanel] = useState(false);

  // État pour le popup (legacy - à conserver pour les autres modes)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedParentCategory, setSelectedParentCategory] = useState<ParentCategoryData | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<SubcategoryTransactions | null>(null);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [dialogMonth, setDialogMonth] = useState(new Date());

  // État pour le détail d'une catégorie (depuis la liste de droite)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDetailCategory, setSelectedDetailCategory] = useState<BudgetCategory | null>(null);
  const [detailTransactions, setDetailTransactions] = useState<Transaction[]>([]);

  // État pour le drill-down popup (quand on reclique sur une slice sélectionnée)
  const [drillDownDialogOpen, setDrillDownDialogOpen] = useState(false);

  // État pour le sélecteur de mois
  const [monthAnchorEl, setMonthAnchorEl] = useState<HTMLElement | null>(null);

  // État pour le positionnement dynamique du logo
  const [logoTop, setLogoTop] = useState(92);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const dialogMonthNum = dialogMonth.getMonth() + 1;
  const dialogYearNum = dialogMonth.getFullYear();

  useEffect(() => {
    fetchData();
    fetchCategories();
  }, [month, year]);

  // Calcul dynamique de la position du logo basé sur la hauteur de la légende
  useEffect(() => {
    const calculateLogoPosition = () => {
      if (chartContainerRef.current) {
        const legend = chartContainerRef.current.querySelector('.recharts-legend-wrapper');
        if (legend) {
          const containerHeight = 220; // Hauteur du ResponsiveContainer
          const legendHeight = legend.getBoundingClientRect().height;
          // Le centre du camembert est au milieu de (containerHeight - legendHeight)
          const pieCenter = (containerHeight - legendHeight) / 2;
          setLogoTop(pieCenter);
        }
      }
    };

    // Calculer après le rendu initial
    const timer = setTimeout(calculateLogoPosition, 100);

    // Observer les changements de taille
    const resizeObserver = new ResizeObserver(calculateLogoPosition);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [summary]); // Recalculer quand les données changent

  // Gestion de la touche ESC pour désélectionner
  // Ne pas interférer si un dialog est ouvert (le dialog gère son propre ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Ne rien faire si un dialog est ouvert - le dialog gère son propre ESC
        if (drillDownDialogOpen || dialogOpen || detailDialogOpen) {
          return;
        }
        if (interactionMode === 'details') {
          // Revenir à la vue sélection
          setInteractionMode('selected');
        } else if (interactionMode === 'selected') {
          // Revenir à la vue d'ensemble
          handleDeselectSlice();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [interactionMode, drillDownDialogOpen, dialogOpen, detailDialogOpen]);

  // Gestion du clic extérieur pour désélectionner
  // Ne pas désélectionner si un dialog est ouvert
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Ne rien faire si un dialog est ouvert
      if (drillDownDialogOpen || dialogOpen || detailDialogOpen) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (interactionMode !== 'overview') {
          handleDeselectSlice();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [interactionMode, drillDownDialogOpen, dialogOpen, detailDialogOpen]);

  // Écouter l'événement de désélection (quand on clique sur un autre camembert)
  useEffect(() => {
    const handleDeselect = () => {
      setSelectedSliceId(null);
      setSelectedCategoryData(null);
      setInteractionMode('overview');
      setShowUnallocatedPanel(false);
    };
    window.addEventListener('deselect-budget-slice', handleDeselect);
    return () => window.removeEventListener('deselect-budget-slice', handleDeselect);
  }, []);

  // Désélectionner une slice
  const handleDeselectSlice = useCallback(() => {
    setSelectedSliceId(null);
    setSelectedCategoryData(null);
    setInteractionMode('overview');
    setCategoryTransactions([]);
    setShowUnallocatedPanel(false);
  }, []);

  // Sélectionner une slice (premier clic)
  const handleSelectSlice = useCallback((parentData: ParentCategoryData) => {
    // Désélectionner les autres camemberts quand on clique ici
    window.dispatchEvent(new CustomEvent('deselect-savings-slice'));
    window.dispatchEvent(new CustomEvent('deselect-time-slice'));

    if (selectedSliceId === parentData.id) {
      // Re-clic sur la même slice -> drill-down
      handleDrillDown(parentData);
    } else {
      // Premier clic -> sélection
      setSelectedSliceId(parentData.id);
      setSelectedCategoryData(parentData);
      setInteractionMode('selected');
    }
  }, [selectedSliceId]);

  // Drill-down vers les transactions
  const handleDrillDown = useCallback(async (parentData: ParentCategoryData) => {
    // Ouvrir le dialog popup au lieu de changer le mode inline
    setDrillDownDialogOpen(true);
    setLoadingCategoryTransactions(true);

    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Récupérer les IDs de toutes les catégories liées (parent + sous-catégories)
      const categoryIds = [parentData.id, ...parentData.subcategories.map(s => s.category_id)].filter((id): id is number => id !== null);

      const allTransactions: Transaction[] = [];

      for (const catId of categoryIds) {
        const response = await transactionsAPI.getAll({
          category_id: catId,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          limit: 100,
        });
        allTransactions.push(...(response.data.items || []));
      }

      // Trier par date décroissante
      allTransactions.sort((a, b) =>
        new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
      );

      setCategoryTransactions(allTransactions);
    } catch (err) {
      console.error('Error fetching category transactions:', err);
    } finally {
      setLoadingCategoryTransactions(false);
    }
  }, [month, year]);

  // Fermer le dialog de drill-down
  const handleCloseDrillDownDialog = useCallback(() => {
    setDrillDownDialogOpen(false);
  }, []);

  // Retour de la vue détails vers la vue sélection (legacy - pour le mode inline si utilisé)
  const handleBackFromDetails = useCallback(() => {
    setInteractionMode('selected');
  }, []);

  // Gérer le clic sur une slice (avec gestion de "Non alloué")
  const handleSliceClick = useCallback((data: any) => {
    // Désélectionner les autres camemberts quand on clique ici
    window.dispatchEvent(new CustomEvent('deselect-savings-slice'));
    window.dispatchEvent(new CustomEvent('deselect-time-slice'));

    if (data.parentData) {
      // Slice avec catégorie -> sélectionner
      setShowUnallocatedPanel(false);
      handleSelectSlice(data.parentData);
    } else if (data.name === 'Non alloué') {
      // Slice "Non alloué" -> afficher le panneau informatif
      setSelectedSliceId(null);
      setSelectedCategoryData(null);
      setInteractionMode('overview');
      setShowUnallocatedPanel(true);
    }
  }, [handleSelectSlice]);

  // Gérer le clic sur l'arrière-plan du graphique (pas sur une slice)
  const handleChartBackgroundClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Vérifier si le clic est sur une slice (élément SVG path de classe recharts)
    const target = e.target as HTMLElement;
    const isSliceClick = target.closest('.recharts-pie-sector') ||
                         (target.closest('.recharts-layer') && target.tagName.toLowerCase() === 'path');

    // Si ce n'est pas un clic sur une slice et qu'une slice est sélectionnée, désélectionner
    if (!isSliceClick && selectedSliceId) {
      handleDeselectSlice();
    }
  }, [selectedSliceId, handleDeselectSlice]);

  const fetchCategories = async () => {
    try {
      const response = await bankAPI.getCategories(undefined, true);
      setAllCategories(response.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await budgetCategoriesAPI.getSummary(month, year);
      setSummary(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleMonthClick = (event: React.MouseEvent<HTMLElement>) => {
    setMonthAnchorEl(event.currentTarget);
  };

  const handleMonthClose = () => {
    setMonthAnchorEl(null);
  };

  const handleMonthSelect = (selectedMonth: number, selectedYear: number) => {
    setCurrentDate(new Date(selectedYear, selectedMonth - 1, 1));
    setMonthAnchorEl(null);
  };

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const handleDialogPrevMonth = () => {
    setDialogMonth(subMonths(dialogMonth, 1));
  };

  const handleDialogNextMonth = () => {
    setDialogMonth(addMonths(dialogMonth, 1));
  };

  // Grouper les catégories de budget par catégorie mère
  const getParentCategoriesData = (): ParentCategoryData[] => {
    if (!summary) return [];

    const parentMap = new Map<number, ParentCategoryData>();

    // Premier passage: identifier les catégories mères avec budget > 0
    // Une catégorie mère avec percentage=0 sera traitée comme si elle n'avait pas de budget
    const parentIdsWithRealBudget = new Set<number>();
    summary.categories.forEach(budgetCat => {
      const category = budgetCat.category;
      if (!category) return;

      // Si c'est une catégorie sans parent_id ET avec un pourcentage > 0
      if (!category.parent_id && budgetCat.percentage > 0) {
        parentIdsWithRealBudget.add(category.id);
      }
    });

    // Deuxième passage: traiter chaque catégorie de budget
    summary.categories.forEach(budgetCat => {
      const category = budgetCat.category;

      // Pour les comptes personnels, inclure l'épargne dans le camembert
      if (!category && isPersonalAccount && budgetCat.is_savings && budgetCat.percentage > 0) {
        const savingsId = -1; // ID fictif pour l'épargne
        parentMap.set(savingsId, {
          id: savingsId,
          name: 'Épargne',
          color: '#10B981',
          totalPercentage: budgetCat.percentage,
          totalAllocated: budgetCat.allocated_amount,
          totalCarriedOver: budgetCat.carried_over,
          totalAvailable: budgetCat.total_available,
          totalSpent: budgetCat.spent_amount,
          totalRemaining: budgetCat.remaining_amount,
          subcategories: [],
        });
        return;
      }

      if (!category) return;

      const isSubcategory = !!category.parent_id;

      if (!isSubcategory) {
        // C'est une catégorie mère (sans parent_id)
        const existing = parentMap.get(category.id);

        // Si la catégorie mère a un budget réel (> 0), utiliser ses valeurs
        if (budgetCat.percentage > 0) {
          parentMap.set(category.id, {
            id: category.id,
            name: category.name,
            color: category.color,
            totalPercentage: budgetCat.percentage,
            totalAllocated: budgetCat.allocated_amount,
            totalCarriedOver: budgetCat.carried_over,
            totalAvailable: budgetCat.total_available,
            totalSpent: budgetCat.spent_amount,
            totalRemaining: budgetCat.remaining_amount,
            subcategories: existing?.subcategories || [],
          });
        } else if (!existing) {
          // Si percentage = 0 et pas d'entrée existante, créer une entrée vide
          // Les valeurs seront remplies par les sous-catégories
          parentMap.set(category.id, {
            id: category.id,
            name: category.name,
            color: category.color,
            totalPercentage: 0,
            totalAllocated: 0,
            totalCarriedOver: 0,
            totalAvailable: 0,
            totalSpent: 0,
            totalRemaining: 0,
            subcategories: [],
          });
        }
        // Si percentage = 0 mais entrée existante (créée par sous-catégories),
        // on garde les valeurs agrégées des sous-catégories
      } else {
        // C'est une sous-catégorie
        const parentId = category.parent_id!;

        // Créer l'entrée parent si elle n'existe pas encore
        if (!parentMap.has(parentId)) {
          const parentCat = allCategories.find(c => c.id === parentId);
          parentMap.set(parentId, {
            id: parentId,
            name: parentCat?.name || `Parent ${parentId}`,
            color: parentCat?.color || '#6B7280',
            totalPercentage: 0,
            totalAllocated: 0,
            totalCarriedOver: 0,
            totalAvailable: 0,
            totalSpent: 0,
            totalRemaining: 0,
            subcategories: [],
          });
        }

        const parent = parentMap.get(parentId)!;

        // Ajouter la sous-catégorie à la liste
        parent.subcategories.push(budgetCat);

        // Si la mère N'A PAS de budget réel (percentage=0 ou non présente),
        // additionner les valeurs des sous-catégories
        if (!parentIdsWithRealBudget.has(parentId)) {
          parent.totalPercentage += budgetCat.percentage;
          parent.totalAllocated += budgetCat.allocated_amount;
          parent.totalCarriedOver += budgetCat.carried_over;
          parent.totalAvailable += budgetCat.total_available;
          parent.totalSpent += budgetCat.spent_amount;
          parent.totalRemaining += budgetCat.remaining_amount;
        }
      }
    });

    return Array.from(parentMap.values());
  };

  const parentCategoriesData = getParentCategoriesData();

  // Détection: budgets configurés mais pas de revenus
  const totalConfiguredPercentage = parentCategoriesData.reduce((sum, p) => sum + p.totalPercentage, 0);
  const hasBudgetsConfigured = totalConfiguredPercentage > 0;
  const hasNoRevenue = (summary?.total_revenue || 0) === 0;
  const budgetsConfiguredButNoRevenue = hasBudgetsConfigured && hasNoRevenue;

  // Fonction pour assombrir une couleur hex
  const darkenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  };

  // Fonction pour adapter les couleurs au mode sombre
  // - Les couleurs sombres deviennent plus claires
  // - Le noir devient blanc et vice versa
  const adaptColorForTheme = (hex: string): string => {
    if (!hex) return '#6B7280';
    const isDarkMode = theme.palette.mode === 'dark';
    if (!isDarkMode) return hex;

    // Convertir hex en RGB
    const num = parseInt(hex.replace('#', ''), 16);
    const R = (num >> 16) & 0xFF;
    const G = (num >> 8) & 0xFF;
    const B = num & 0xFF;

    // Calculer la luminosité (0-255)
    const luminance = (0.299 * R + 0.587 * G + 0.114 * B);

    // Si la couleur est très sombre (noir ou proche), inverser vers blanc/clair
    if (luminance < 30) {
      return '#F5F5F5';
    }

    // Si la couleur est sombre, l'éclaircir pour le mode sombre
    if (luminance < 128) {
      const brightenAmount = 80;
      const newR = Math.min(255, R + brightenAmount);
      const newG = Math.min(255, G + brightenAmount);
      const newB = Math.min(255, B + brightenAmount);
      return '#' + (0x1000000 + newR * 0x10000 + newG * 0x100 + newB).toString(16).slice(1);
    }

    // Les couleurs déjà claires restent identiques
    return hex;
  };

  // Appliquer l'adaptation des couleurs aux catégories parentes pour un affichage cohérent
  const adaptedParentCategoriesData = parentCategoriesData.map(parent => ({
    ...parent,
    originalColor: parent.color,
    color: adaptColorForTheme(parent.color),
    subcategories: parent.subcategories.map(sub => ({
      ...sub,
      category: sub.category ? { ...sub.category, color: adaptColorForTheme(sub.category.color) } : sub.category,
    })),
  }));

  // Calculer le facteur de normalisation si on masque "Non alloué"
  const totalConfiguredPercent = parentCategoriesData.reduce((sum, p) => sum + p.totalPercentage, 0);
  const normalizationFactor = hideUnallocated && totalConfiguredPercent > 0 ? 100 / totalConfiguredPercent : 1;

  // Données pour le camembert - comme TimePieCharts avec restant (coloré) + dépensé (clair)
  const pieData: any[] = [];

  adaptedParentCategoriesData.forEach(parent => {
    const basePercent = parent.totalPercentage * normalizationFactor;
    const spentPercent = parent.totalAvailable > 0
      ? (parent.totalSpent / parent.totalAvailable) * basePercent
      : 0;
    const remainingPercent = Math.max(0, basePercent - spentPercent);

    // Part RESTANTE (colorée) - ce qui reste à dépenser
    if (remainingPercent > 0) {
      pieData.push({
        id: parent.id,
        name: parent.name,
        value: remainingPercent,
        amount: parent.totalRemaining,
        color: parent.color,
        originalColor: parent.originalColor || parent.color,
        parentData: parent,
        totalSpent: parent.totalSpent,
        totalAvailable: parent.totalAvailable,
        totalRemaining: parent.totalRemaining,
        isSpent: false,
      });
    }

    // Part DÉPENSÉE (couleur plus claire)
    if (spentPercent > 0) {
      pieData.push({
        id: `${parent.id}-spent`,
        name: `${parent.name} - Dépensé`,
        value: Math.min(spentPercent, basePercent),
        amount: parent.totalSpent,
        color: theme.palette.mode === 'dark'
          ? alpha(parent.color, 0.3)
          : alpha(parent.originalColor || parent.color, 0.25),
        originalColor: parent.originalColor || parent.color,
        parentData: parent,
        totalSpent: parent.totalSpent,
        totalAvailable: parent.totalAvailable,
        totalRemaining: parent.totalRemaining,
        isSpent: true,
        categoryName: parent.name,
      });
    }
  });

  // Ajouter "Non alloué" seulement si on ne le masque pas
  if (!hideUnallocated) {
    const unallocatedValue = Math.max(0, 100 - totalConfiguredPercent);
    if (unallocatedValue > 0) {
      pieData.push({
        id: -1,
        name: 'Non alloué',
        value: unallocatedValue,
        amount: Math.max(0, (summary?.total_revenue || 0) - parentCategoriesData.reduce((sum, p) => sum + p.totalAllocated, 0)),
        color: theme.palette.mode === 'dark' ? '#4B5563' : '#E5E7EB',
        originalColor: '#9CA3AF',
        parentData: null as any,
        isSpent: false,
      });
    }
  }

  // Pour compatibilité avec l'ancien code
  const overviewData = pieData.filter(d => !d.isSpent);

  // Ouvrir le popup pour une catégorie mère
  const handleParentCategoryClick = (data: any) => {
    if (data.parentData) {
      setSelectedParentCategory(data.parentData);
      setSelectedSubcategory(null);
      setDialogMonth(currentDate);
      setDialogOpen(true);
    }
  };

  // Charger les transactions pour une sous-catégorie
  const handleSubcategoryClick = async (subcategory: BudgetCategory) => {
    setLoadingTransactions(true);
    try {
      const startDate = new Date(dialogYearNum, dialogMonthNum - 1, 1);
      const endDate = new Date(dialogYearNum, dialogMonthNum, 0);

      const response = await transactionsAPI.getAll({
        category_id: subcategory.category_id ?? undefined,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        limit: 100,
      });

      const transactions = response.data.items || [];
      const totalRevenue = transactions
        .filter(t => t.type === 'revenue')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      setSelectedSubcategory({
        subcategory,
        transactions,
        totalRevenue,
        totalExpense,
      });
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Recharger les transactions quand le mois change dans le dialog
  useEffect(() => {
    if (selectedSubcategory && dialogOpen) {
      handleSubcategoryClick(selectedSubcategory.subcategory);
    }
  }, [dialogMonthNum, dialogYearNum]);

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedParentCategory(null);
    setSelectedSubcategory(null);
  };

  const handleBackToSubcategories = () => {
    setSelectedSubcategory(null);
  };

  // Ouvrir le dialog de détail pour une catégorie (depuis la liste de droite)
  const handleDetailCategoryClick = async (budgetCat: BudgetCategory) => {
    setSelectedDetailCategory(budgetCat);
    setDetailDialogOpen(true);
    setLoadingTransactions(true);

    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Récupérer les sous-catégories pour inclure leurs transactions aussi
      const subcategoryIds = allCategories
        .filter(c => c.parent_id === budgetCat.category_id)
        .map(c => c.id);

      // Charger les transactions de la catégorie et de ses sous-catégories
      const allTransactions: Transaction[] = [];

      // Transactions de la catégorie principale
      const mainResponse = await transactionsAPI.getAll({
        category_id: budgetCat.category_id ?? undefined,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        limit: 100,
      });
      allTransactions.push(...(mainResponse.data.items || []));

      // Transactions des sous-catégories
      for (const subId of subcategoryIds) {
        const subResponse = await transactionsAPI.getAll({
          category_id: subId,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          limit: 100,
        });
        allTransactions.push(...(subResponse.data.items || []));
      }

      // Trier par date décroissante
      allTransactions.sort((a, b) =>
        new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
      );

      setDetailTransactions(allTransactions);
    } catch (err) {
      console.error('Error fetching detail transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setSelectedDetailCategory(null);
    setDetailTransactions([]);
  };

  // Données pour le graphique par catégorie
  const categoryData = summary?.categories.map(cat => ({
    name: cat.category?.name || `Catégorie ${cat.category_id}`,
    value: cat.allocated_amount,
    spent: cat.spent_amount,
    remaining: cat.remaining_amount,
    percentage: cat.percentage,
    color: cat.category?.color || '#6B7280',
    category: cat,
  })) || [];

  const formatAmount = (value: number) => formatCurrency(value, currency);

  // Rendu de la slice active avec effet de zoom
  const renderActiveShape = (props: any) => {
    const {
      cx, cy, innerRadius, outerRadius, startAngle, endAngle,
      fill, payload, percent
    } = props;

    const isSelected = payload.parentData && payload.parentData.id === selectedSliceId;
    const zoomOffset = isSelected ? 10 : 0;

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + zoomOffset}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          style={{
            filter: isSelected ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' : 'none',
            transition: 'all 0.3s ease',
          }}
        />
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      // Tooltip pour la part "Dépensé" d'une catégorie
      if (data.isSpent && data.parentData) {
        const parent = data.parentData;
        const spentPercent = parent.totalAvailable > 0
          ? ((parent.totalSpent / parent.totalAvailable) * 100).toFixed(0)
          : '0';

        return (
          <Box
            sx={{
              bgcolor: theme.palette.background.paper,
              p: 2,
              borderRadius: 2,
              boxShadow: theme.shadows[8],
              minWidth: 180,
              border: `1px solid ${theme.palette.divider}`,
              zIndex: 9999,
              position: 'relative',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, color: data.originalColor }}>
              {data.categoryName} - Dépensé
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: '#EF4444' }}>
              {formatAmount(parent.totalSpent)} / {formatAmount(parent.totalAvailable)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {spentPercent}% du budget {data.categoryName} utilisé
            </Typography>
          </Box>
        );
      }

      // Si c'est une donnée du camembert principal (avec parentData) - part restante
      if (data.parentData) {
        const parent = data.parentData;
        // Calculer le pourcentage restant basé sur le total disponible
        const remainingPercent = parent.totalAvailable > 0
          ? ((parent.totalRemaining / parent.totalAvailable) * 100).toFixed(1)
          : '0';

        return (
          <Box
            sx={{
              bgcolor: theme.palette.background.paper,
              p: 2,
              borderRadius: 2,
              boxShadow: theme.shadows[8],
              minWidth: 180,
              border: `1px solid ${theme.palette.divider}`,
              zIndex: 9999,
              position: 'relative',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: data.originalColor || parent.color,
                }}
              />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                {parent.name} - Restant
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Budget
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                  {formatAmount(parent.totalAvailable)}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Dépensé
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#EF4444' }}>
                  {formatAmount(parent.totalSpent)}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Restant
                </Typography>
                <Typography variant="body2" sx={{
                  fontWeight: 700,
                  color: parent.totalRemaining >= 0 ? '#10B981' : '#EF4444'
                }}>
                  {formatAmount(parent.totalRemaining)} ({remainingPercent}%)
                </Typography>
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                Cliquez pour voir les détails
              </Typography>
            </Box>
          </Box>
        );
      }

      // Pour "Non alloué" ou autres données sans parentData
      if (data.name === 'Non alloué') {
        return (
          <Box
            sx={{
              bgcolor: theme.palette.background.paper,
              p: 1.5,
              borderRadius: 2,
              boxShadow: theme.shadows[4],
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.secondary }}>
              Non alloué
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {data.value?.toFixed(1)}% des revenus
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, color: theme.palette.text.primary }}>
              {formatAmount(data.amount || 0)}
            </Typography>
          </Box>
        );
      }

      // Fallback pour d'autres données
      return (
        <Box
          sx={{
            bgcolor: theme.palette.background.paper,
            p: 1.5,
            borderRadius: 1,
            boxShadow: theme.shadows[4],
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
            {data.name}
          </Typography>
          {data.amount !== undefined && (
            <Typography variant="body2" sx={{ fontWeight: 500, color: theme.palette.text.primary }}>
              {formatAmount(data.amount)}
            </Typography>
          )}
        </Box>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <LinearProgress sx={{ borderRadius: 1 }} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography color="error">{error}</Typography>
        </CardContent>
      </Card>
    );
  }

  const totalAllocatedPercent = summary?.categories.reduce((sum, cat) => sum + cat.percentage, 0) || 0;
  const totalUnallocatedPercent = 100 - totalAllocatedPercent;

  // Composant du panneau de détails pour la catégorie sélectionnée
  const SelectedCategoryPanel = () => {
    if (!selectedCategoryData) return null;

    const parent = selectedCategoryData;
    const remainingPercent = parent.totalAvailable > 0
      ? ((parent.totalRemaining / parent.totalAvailable) * 100).toFixed(1)
      : '0';
    const spentPercent = parent.totalAvailable > 0
      ? ((parent.totalSpent / parent.totalAvailable) * 100).toFixed(1)
      : '0';

    return (
      <Fade in={interactionMode === 'selected'}>
        <Box
          sx={{
            mt: 1.5,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: alpha(parent.color, 0.1),
            border: `1px solid ${parent.color}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: parent.color,
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                {parent.name}
              </Typography>
              <Chip
                label={`${parent.totalPercentage.toFixed(1)}%`}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  bgcolor: alpha(parent.color, 0.2),
                  color: parent.color,
                  fontWeight: 700,
                }}
              />
            </Box>
            <IconButton size="small" onClick={handleDeselectSlice} sx={{ p: 0.5 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          <Grid container spacing={1}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: theme.palette.background.paper, borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Budget
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary, fontSize: '0.8rem' }}>
                  {formatAmount(parent.totalAllocated)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{
                textAlign: 'center',
                p: 1,
                bgcolor: parent.totalCarriedOver >= 0 ? alpha('#3B82F6', 0.1) : alpha('#EF4444', 0.1),
                borderRadius: 1
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Report
                </Typography>
                <Typography variant="body2" sx={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: parent.totalCarriedOver >= 0 ? '#3B82F6' : '#EF4444'
                }}>
                  {parent.totalCarriedOver >= 0 ? '+' : ''}{formatAmount(parent.totalCarriedOver)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: alpha('#EF4444', 0.1), borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Dépensé ({spentPercent}%)
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#EF4444', fontSize: '0.8rem' }}>
                  {formatAmount(parent.totalSpent)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{
                textAlign: 'center',
                p: 1,
                bgcolor: parent.totalRemaining >= 0 ? alpha('#10B981', 0.1) : alpha('#EF4444', 0.1),
                borderRadius: 1
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Restant ({remainingPercent}%)
                </Typography>
                <Typography variant="body2" sx={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: parent.totalRemaining >= 0 ? '#10B981' : '#EF4444'
                }}>
                  {formatAmount(parent.totalRemaining)}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(parseFloat(spentPercent), 100)}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: alpha(parent.color, 0.2),
                '& .MuiLinearProgress-bar': {
                  bgcolor: parseFloat(spentPercent) > 100 ? '#EF4444' : parent.color,
                  borderRadius: 3,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center', fontSize: '0.65rem' }}>
              Cliquez à nouveau pour voir les transactions
            </Typography>
          </Box>
        </Box>
      </Fade>
    );
  };

  // Composant du panneau "Non alloué" (overlay)
  const UnallocatedPanel = () => {
    if (!showUnallocatedPanel) return null;

    const unallocatedAmount = (summary?.total_revenue || 0) - parentCategoriesData.reduce((sum, p) => sum + p.totalAllocated, 0);
    const unallocatedPercent = 100 - parentCategoriesData.reduce((sum, p) => sum + p.totalPercentage, 0);

    return (
      <Fade in={showUnallocatedPanel}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.background.default, 0.85),
            backdropFilter: 'blur(4px)',
            borderRadius: 3,
            zIndex: 10,
          }}
          onClick={() => setShowUnallocatedPanel(false)}
        >
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: theme.shadows[8],
              textAlign: 'center',
              maxWidth: 360,
              mx: 2,
            }}
          >
            {budgetsConfiguredButNoRevenue ? (
              // Cas: budgets configurés mais pas de revenus
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
                  <AccountBalanceIcon sx={{ fontSize: 28, color: '#F5C518' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                    Aucun revenu enregistré
                  </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Vos budgets sont configurés ({totalConfiguredPercentage.toFixed(0)}% alloués), mais aucune entrée d'argent n'a été enregistrée ce mois-ci.
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Ajoutez des transactions de revenus pour voir votre budget réparti.
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowUnallocatedPanel(false)}
                    sx={{
                      borderColor: theme.palette.divider,
                      color: theme.palette.text.secondary,
                    }}
                  >
                    Fermer
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                      setShowUnallocatedPanel(false);
                      router.push('/dashboard/banque');
                    }}
                    sx={{
                      bgcolor: '#F5C518',
                      color: '#1A1A1A',
                      '&:hover': { bgcolor: '#E0B000' },
                    }}
                  >
                    Aller aux Transactions
                  </Button>
                </Box>
              </>
            ) : (
              // Cas normal: pas de budgets configurés ou il reste du non alloué
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
                  <CategoryIcon sx={{ fontSize: 28, color: theme.palette.grey[500] }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                    Budget non alloué
                  </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Cette portion représente le budget qui n'est attribué à aucune catégorie.
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
                  <Box sx={{
                    textAlign: 'center',
                    p: 1.5,
                    bgcolor: alpha(theme.palette.grey[500], 0.1),
                    borderRadius: 2,
                    minWidth: 100
                  }}>
                    <Typography variant="caption" color="text.secondary">
                      Montant
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                      {formatAmount(Math.max(0, unallocatedAmount))}
                    </Typography>
                  </Box>
                  <Box sx={{
                    textAlign: 'center',
                    p: 1.5,
                    bgcolor: alpha(theme.palette.grey[500], 0.1),
                    borderRadius: 2,
                    minWidth: 100
                  }}>
                    <Typography variant="caption" color="text.secondary">
                      Pourcentage
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                      {Math.max(0, unallocatedPercent).toFixed(1)}%
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Configurez des catégories pour mieux répartir vos revenus.
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowUnallocatedPanel(false)}
                    sx={{
                      borderColor: theme.palette.divider,
                      color: theme.palette.text.secondary,
                    }}
                  >
                    Fermer
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                      setShowUnallocatedPanel(false);
                      window.dispatchEvent(new CustomEvent('open-budget-settings'));
                    }}
                    sx={{
                      bgcolor: '#F5C518',
                      color: '#1A1A1A',
                      '&:hover': { bgcolor: '#E0B000' },
                    }}
                  >
                    Configurer les budgets
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Fade>
    );
  };

  // Composant de la vue drill-down avec les transactions
  const TransactionsView = () => {
    if (!selectedCategoryData) return null;

    const parent = selectedCategoryData;

    return (
      <Fade in={interactionMode === 'details'}>
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton size="small" onClick={handleBackFromDetails}>
                <ArrowBackIcon />
              </IconButton>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  bgcolor: parent.color,
                }}
              />
              <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                Transactions - {parent.name}
              </Typography>
            </Box>
            <Tooltip title="Paramètres de la catégorie">
              <IconButton size="small" sx={{ color: theme.palette.text.secondary }}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Résumé rapide */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Chip
              label={`${categoryTransactions.length} transaction(s)`}
              size="small"
              sx={{ bgcolor: alpha(parent.color, 0.1), color: parent.color }}
            />
            <Chip
              label={`Total: ${formatAmount(categoryTransactions.reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : 0), 0))}`}
              size="small"
              sx={{ bgcolor: alpha('#EF4444', 0.1), color: '#EF4444' }}
            />
          </Box>

          {loadingCategoryTransactions ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={40} sx={{ color: parent.color }} />
            </Box>
          ) : categoryTransactions.length > 0 ? (
            <TableContainer
              component={Paper}
              sx={{
                borderRadius: 2,
                maxHeight: 400,
                bgcolor: theme.palette.background.paper,
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, bgcolor: theme.palette.background.paper }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: theme.palette.background.paper }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: theme.palette.background.paper }}>Catégorie</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, bgcolor: theme.palette.background.paper }}>Montant</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categoryTransactions.map((tx) => (
                    <TableRow key={tx.id} hover>
                      <TableCell sx={{ color: theme.palette.text.primary }}>
                        {format(new Date(tx.transaction_date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200, color: theme.palette.text.primary }}>
                          {tx.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: adaptColorForTheme(tx.category?.color || '#6B7280'),
                            }}
                          />
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                            {tx.category?.name || '-'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 600,
                          color: tx.type === 'revenue' ? '#10B981' : '#EF4444',
                        }}
                      >
                        {tx.type === 'revenue' ? '+' : '-'}{formatAmount(tx.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <ReceiptIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 1 }} />
              <Typography color="text.secondary">
                Aucune transaction pour cette catégorie ce mois-ci
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Cliquez sur la slice ou appuyez sur Entrée pour voir les transactions
            </Typography>
          </Box>
        </Box>
      </Fade>
    );
  };

  return (
    <Box ref={containerRef}>
      {/* Navigation par mois - masquée si date externe fournie */}
      {!externalDate && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            mb: 3,
            p: 2,
            bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : '#F9FAFB',
            borderRadius: 3,
          }}
        >
          <IconButton onClick={handlePrevMonth} size="small" sx={{ bgcolor: theme.palette.background.paper }}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              minWidth: 180,
              textAlign: 'center',
              textTransform: 'capitalize',
              color: theme.palette.text.primary,
            }}
          >
            {format(currentDate, 'MMMM yyyy', { locale: fr })}
          </Typography>
          <IconButton onClick={handleNextMonth} size="small" sx={{ bgcolor: theme.palette.background.paper }}>
            <ChevronRightIcon />
          </IconButton>
        </Box>
      )}

      {/* Mode full: Grid avec les deux colonnes ou vue détails */}
      {renderMode === 'full' && (
        <>
          {interactionMode === 'details' ? (
            <TransactionsView />
          ) : (
            <Grid container spacing={3}>
              {/* Colonne gauche: Vue d'ensemble */}
              <Grid item xs={12} md={8}>
                <Card sx={{ borderRadius: 3, bgcolor: theme.palette.background.paper }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                        Vue d'ensemble
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" color="text.secondary">
                            Revenus du mois
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#10B981' }}>
                            {formatAmount(summary?.total_revenue || 0)}
                          </Typography>
                        </Box>
                        <Tooltip title="Paramètres des budgets">
                          <IconButton
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('open-budget-settings'));
                            }}
                            sx={{
                              bgcolor: alpha(theme.palette.grey[500], 0.1),
                              '&:hover': {
                                bgcolor: alpha('#F5C518', 0.2),
                              },
                            }}
                          >
                            <SettingsIcon sx={{ fontSize: 20 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {/* Camembert interactif */}
                    {overviewData.length > 0 ? (
                      <Box sx={{ position: 'relative' }} onClick={handleChartBackgroundClick}>
                        <ResponsiveContainer width="100%" height={280}>
                          <PieChart>
                            {/* Camembert unique: restant (coloré) + dépensé (clair) */}
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={0}
                              outerRadius={100}
                              paddingAngle={1}
                              dataKey="value"
                              onClick={handleSliceClick}
                              onMouseEnter={(data, index) => {
                                const categoryId = data.isSpent
                                  ? String(data.id).replace('-spent', '')
                                  : data.id;
                                if (categoryId && categoryId !== '-1') setHoveredSliceId(Number(categoryId));
                              }}
                              onMouseLeave={() => setHoveredSliceId(null)}
                              style={{ cursor: 'pointer' }}
                            >
                              {pieData.map((entry, index) => {
                                const categoryId = entry.isSpent
                                  ? Number(String(entry.id).replace('-spent', ''))
                                  : entry.id;
                                const isSelected = categoryId === selectedSliceId;
                                const isHovered = categoryId === hoveredSliceId;
                                return (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                    opacity={
                                      selectedSliceId
                                        ? (isSelected ? 1 : 0.3)
                                        : (hoveredSliceId && !isHovered ? 0.3 : 1)
                                    }
                                    style={{ transition: 'opacity 0.3s ease' }}
                                  />
                                );
                              })}
                            </Pie>
                            <RechartsTooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                            <Legend
                              payload={pieData.filter(d => !d.isSpent).map(entry => ({
                                value: entry.name,
                                type: 'square',
                                color: entry.color,
                              }))}
                              wrapperStyle={{ color: theme.palette.text.primary }}
                            />
                          </PieChart>
                        </ResponsiveContainer>

                        {/* Panneau de détails pour la catégorie sélectionnée */}
                        {interactionMode === 'selected' && <SelectedCategoryPanel />}

                        {/* Panneau pour "Non alloué" */}
                        <UnallocatedPanel />
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          height: 280,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 2,
                          p: 3,
                          bgcolor: alpha(theme.palette.primary.main, 0.03),
                          borderRadius: 3,
                          border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
                        }}
                      >
                        {budgetsConfiguredButNoRevenue ? (
                          <>
                            <AccountBalanceIcon sx={{ fontSize: 48, color: '#F5C518' }} />
                            <Typography color="text.secondary" textAlign="center" sx={{ fontWeight: 500 }}>
                              Aucun revenu enregistré
                            </Typography>
                            <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ maxWidth: 250 }}>
                              Vos budgets sont configurés ({totalConfiguredPercentage.toFixed(0)}% alloués). Ajoutez des transactions de revenus pour visualiser la répartition.
                            </Typography>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => router.push('/dashboard/banque')}
                              sx={{
                                mt: 1,
                                bgcolor: '#F5C518',
                                color: '#1A1A1A',
                                '&:hover': { bgcolor: '#E0B000' },
                              }}
                            >
                              Aller aux Transactions
                            </Button>
                          </>
                        ) : (
                          <>
                            <CategoryIcon sx={{ fontSize: 48, color: theme.palette.text.disabled }} />
                            <Typography color="text.secondary" textAlign="center" sx={{ fontWeight: 500 }}>
                              Aucun budget configuré
                            </Typography>
                            <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ maxWidth: 250 }}>
                              Créez des catégories et définissez des pourcentages pour visualiser vos budgets
                            </Typography>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent('open-budget-settings'));
                              }}
                              sx={{
                                mt: 1,
                                bgcolor: '#F5C518',
                                color: '#1A1A1A',
                                '&:hover': { bgcolor: '#E0B000' },
                              }}
                            >
                              Configurer les budgets
                            </Button>
                          </>
                        )}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Colonne droite: Détail par catégorie */}
              <Grid item xs={12} md={4}>
                <Card sx={{ borderRadius: 3, height: '100%', bgcolor: theme.palette.background.paper }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: theme.palette.text.primary }}>
                      Détail par catégorie
                    </Typography>

                    {adaptedParentCategoriesData.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {adaptedParentCategoriesData.map((parent) => {
                          const parentSpentPercent = parent.totalAvailable > 0
                            ? (parent.totalSpent / parent.totalAvailable) * 100
                            : 0;
                          const parentIsOverBudget = parent.totalSpent > parent.totalAvailable;
                          const isSelected = selectedSliceId === parent.id;

                          return (
                            <Box key={parent.id}>
                              {/* Catégorie mère */}
                              <Box
                                onClick={() => handleSelectSlice(parent)}
                                sx={{
                                  p: 2,
                                  borderRadius: 2,
                                  bgcolor: isSelected
                                    ? alpha(parent.color, 0.15)
                                    : (theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : '#F3F4F6'),
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  border: isSelected ? `2px solid ${parent.color}` : '2px solid transparent',
                                  '&:hover': {
                                    bgcolor: isSelected
                                      ? alpha(parent.color, 0.2)
                                      : (theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.08) : '#E5E7EB'),
                                  },
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <Box
                                    sx={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: '50%',
                                      bgcolor: parent.color,
                                    }}
                                  />
                                  <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, color: theme.palette.text.primary }}>
                                    {parent.name}
                                  </Typography>
                                  <Chip
                                    label={`${parent.totalPercentage.toFixed(1)}%`}
                                    size="small"
                                    sx={{
                                      bgcolor: alpha(parent.color, 0.2),
                                      color: parent.color,
                                      fontWeight: 700,
                                      fontSize: '0.75rem',
                                    }}
                                  />
                                  {parent.totalCarriedOver !== 0 && (
                                    <Chip
                                      label={`Report: ${parent.totalCarriedOver >= 0 ? '+' : ''}${formatAmount(parent.totalCarriedOver)}`}
                                      size="small"
                                      sx={{
                                        bgcolor: parent.totalCarriedOver >= 0 ? alpha('#3B82F6', 0.15) : alpha('#EF4444', 0.15),
                                        color: parent.totalCarriedOver >= 0 ? '#3B82F6' : '#EF4444',
                                        fontWeight: 600,
                                        fontSize: '0.65rem',
                                      }}
                                    />
                                  )}
                                </Box>

                                <Box sx={{ mb: 1 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={Math.min(parentSpentPercent, 100)}
                                    sx={{
                                      height: 8,
                                      borderRadius: 4,
                                      bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.1) : '#E5E7EB',
                                      '& .MuiLinearProgress-bar': {
                                        bgcolor: parentIsOverBudget ? '#EF4444' : parent.color,
                                        borderRadius: 4,
                                      },
                                    }}
                                  />
                                </Box>

                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {formatAmount(parent.totalSpent)} / {formatAmount(parent.totalAvailable)}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontWeight: 600,
                                      color: parentIsOverBudget ? '#EF4444' : '#10B981',
                                    }}
                                  >
                                    {formatAmount(parent.totalRemaining)} restant
                                  </Typography>
                                </Box>
                              </Box>

                              {/* Sous-catégories (avec alinéa) */}
                              {parent.subcategories.length > 0 && (
                                <Box sx={{ ml: 3, mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  {parent.subcategories.map((subcat) => {
                                    const subcatSpentPercent = subcat.total_available > 0
                                      ? (subcat.spent_amount / subcat.total_available) * 100
                                      : 0;
                                    const subcatIsOverBudget = subcat.spent_amount > subcat.total_available;

                                    return (
                                      <Box
                                        key={subcat.id}
                                        onClick={() => handleDetailCategoryClick(subcat)}
                                        sx={{
                                          p: 1.5,
                                          borderRadius: 2,
                                          bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.03) : '#F9FAFB',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s ease',
                                          borderLeft: `3px solid ${subcat.category?.color || parent.color}`,
                                          '&:hover': {
                                            bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.06) : '#F3F4F6',
                                            transform: 'translateX(4px)',
                                          },
                                        }}
                                      >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                          <Box
                                            sx={{
                                              width: 10,
                                              height: 10,
                                              borderRadius: '50%',
                                              bgcolor: subcat.category?.color || parent.color,
                                            }}
                                          />
                                          <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, color: theme.palette.text.primary }}>
                                            {subcat.category?.name}
                                          </Typography>
                                          <Chip
                                            label={`${subcat.percentage}%`}
                                            size="small"
                                            sx={{
                                              bgcolor: alpha(subcat.category?.color || parent.color, 0.15),
                                              color: subcat.category?.color || parent.color,
                                              fontWeight: 600,
                                              fontSize: '0.65rem',
                                              height: 20,
                                            }}
                                          />
                                          {subcat.carried_over !== 0 && (
                                            <Chip
                                              label={`${subcat.carried_over >= 0 ? '+' : ''}${formatAmount(subcat.carried_over)}`}
                                              size="small"
                                              sx={{
                                                bgcolor: subcat.carried_over >= 0 ? alpha('#3B82F6', 0.15) : alpha('#EF4444', 0.15),
                                                color: subcat.carried_over >= 0 ? '#3B82F6' : '#EF4444',
                                                fontWeight: 600,
                                                fontSize: '0.6rem',
                                                height: 18,
                                              }}
                                            />
                                          )}
                                        </Box>

                                        <Box sx={{ mb: 0.5 }}>
                                          <LinearProgress
                                            variant="determinate"
                                            value={Math.min(subcatSpentPercent, 100)}
                                            sx={{
                                              height: 5,
                                              borderRadius: 2.5,
                                              bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.1) : '#E5E7EB',
                                              '& .MuiLinearProgress-bar': {
                                                bgcolor: subcatIsOverBudget ? '#EF4444' : (subcat.category?.color || parent.color),
                                                borderRadius: 2.5,
                                              },
                                            }}
                                          />
                                        </Box>

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                            {formatAmount(subcat.spent_amount)} / {formatAmount(subcat.total_available)}
                                          </Typography>
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              fontWeight: 600,
                                              fontSize: '0.7rem',
                                              color: subcatIsOverBudget ? '#EF4444' : '#10B981',
                                            }}
                                          >
                                            {formatAmount(subcat.remaining_amount)} restant
                                          </Typography>
                                        </Box>
                                      </Box>
                                    );
                                  })}
                                </Box>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="text.secondary">
                          Configurez vos budgets par catégorie dans les paramètres
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      )}

      {/* Mode pie-only: Seulement le camembert interactif */}
      {renderMode === 'pie-only' && (
        <>
          {interactionMode === 'details' ? (
            <TransactionsView />
          ) : (
            <Card sx={{ borderRadius: 2, bgcolor: theme.palette.background.paper }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                    {isPersonalAccount ? 'Budgétisation' : 'Charges'}
                  </Typography>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      Revenus
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#10B981' }}>
                      {formatAmount(summary?.total_revenue || 0)}
                    </Typography>
                  </Box>
                </Box>

                {/* Camembert interactif */}
                {pieData.length > 0 && pieData.some(d => d.value > 0) ? (
                  <Box ref={chartContainerRef} sx={{ position: 'relative' }} onClick={handleChartBackgroundClick}>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={20}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                          onClick={handleSliceClick}
                          onMouseEnter={(data) => {
                            const catId = data.isSpent ? data.parentData?.id : data.parentData?.id;
                            if (catId) setHoveredSliceId(catId);
                          }}
                          onMouseLeave={() => setHoveredSliceId(null)}
                          activeIndex={pieData.findIndex(d =>
                            d.isSpent ? d.parentData?.id === selectedSliceId : d.parentData?.id === selectedSliceId
                          )}
                          activeShape={renderActiveShape}
                          style={{ cursor: 'pointer' }}
                        >
                          {pieData.map((entry, index) => {
                            const entryCategoryId = entry.parentData?.id;
                            const isSelected = selectedSliceId === entryCategoryId;
                            const isHovered = hoveredSliceId === entryCategoryId;

                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                opacity={
                                  selectedSliceId
                                    ? (isSelected ? (entry.isSpent ? 0.7 : 1) : 0.3)
                                    : hoveredSliceId
                                      ? (isHovered ? (entry.isSpent ? 0.7 : 1) : 0.3)
                                      : (entry.isSpent ? 0.7 : 0.9)
                                }
                                style={{
                                  transition: 'opacity 0.3s ease',
                                  cursor: 'pointer',
                                }}
                              />
                            );
                          })}
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                        <Legend
                          payload={pieData.filter(d => !d.isSpent && d.id !== -1).map(entry => ({
                            value: entry.name,
                            type: 'square',
                            color: entry.originalColor || entry.color,
                          }))}
                          wrapperStyle={{ color: theme.palette.text.primary, fontSize: '0.75rem' }}
                          iconSize={8}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Logo de l'entreprise au centre du camembert */}
                    {currentCompany?.logo_url && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: logoTop,
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          bgcolor: theme.palette.background.paper,
                          boxShadow: theme.shadows[2],
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                          zIndex: 0,
                        }}
                      >
                        <img
                          src={`${API_BASE_URL}${currentCompany.logo_url}`}
                          alt="Logo"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                    )}

                    {/* Panneau de détails pour la catégorie sélectionnée */}
                    {interactionMode === 'selected' && <SelectedCategoryPanel />}

                    {/* Panneau pour "Non alloué" */}
                    <UnallocatedPanel />
                  </Box>
                ) : (
                  <Box
                    sx={{
                      height: 180,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      p: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.03),
                      borderRadius: 2,
                      border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
                    }}
                  >
                    {budgetsConfiguredButNoRevenue ? (
                      <>
                        <AccountBalanceIcon sx={{ fontSize: 32, color: '#F5C518' }} />
                        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ fontWeight: 500 }}>
                          Aucun revenu enregistré
                        </Typography>
                        <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ maxWidth: 200, fontSize: '0.7rem' }}>
                          Ajoutez des transactions de revenus
                        </Typography>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => router.push('/dashboard/banque')}
                          sx={{
                            bgcolor: '#F5C518',
                            color: '#1A1A1A',
                            fontSize: '0.75rem',
                            py: 0.5,
                            '&:hover': { bgcolor: '#E0B000' },
                          }}
                        >
                          Transactions
                        </Button>
                      </>
                    ) : (
                      <>
                        <CategoryIcon sx={{ fontSize: 32, color: theme.palette.text.disabled }} />
                        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ fontWeight: 500 }}>
                          Aucun budget configuré
                        </Typography>
                        <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ maxWidth: 200, fontSize: '0.7rem' }}>
                          Configurez vos catégories de charges
                        </Typography>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('open-budget-settings'));
                          }}
                          sx={{
                            bgcolor: '#F5C518',
                            color: '#1A1A1A',
                            fontSize: '0.75rem',
                            py: 0.5,
                            '&:hover': { bgcolor: '#E0B000' },
                          }}
                        >
                          Configurer
                        </Button>
                      </>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Mode detail-only: Seulement le détail par catégorie */}
      {renderMode === 'detail-only' && (
        <Card sx={{ borderRadius: 3, height: '100%', bgcolor: theme.palette.background.paper }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: theme.palette.text.primary }}>
              Détail par catégorie
            </Typography>

            {adaptedParentCategoriesData.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {adaptedParentCategoriesData.map((parent) => {
                  const parentSpentPercent = parent.totalAvailable > 0
                    ? (parent.totalSpent / parent.totalAvailable) * 100
                    : 0;
                  const parentIsOverBudget = parent.totalSpent > parent.totalAvailable;
                  const isSelected = selectedSliceId === parent.id;

                  return (
                    <Box key={parent.id}>
                      {/* Catégorie mère */}
                      <Box
                        onClick={() => handleSelectSlice(parent)}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: isSelected
                            ? alpha(parent.color, 0.15)
                            : (theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : '#F3F4F6'),
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          border: isSelected ? `2px solid ${parent.color}` : '2px solid transparent',
                          '&:hover': {
                            bgcolor: isSelected
                              ? alpha(parent.color, 0.2)
                              : (theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.08) : '#E5E7EB'),
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Box
                            sx={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              bgcolor: parent.color,
                            }}
                          />
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, color: theme.palette.text.primary }}>
                            {parent.name}
                          </Typography>
                          <Chip
                            label={`${parent.totalPercentage.toFixed(1)}%`}
                            size="small"
                            sx={{
                              bgcolor: alpha(parent.color, 0.2),
                              color: parent.color,
                              fontWeight: 700,
                              fontSize: '0.75rem',
                            }}
                          />
                          {parent.totalCarriedOver !== 0 && (
                            <Chip
                              label={`Report: ${parent.totalCarriedOver >= 0 ? '+' : ''}${formatAmount(parent.totalCarriedOver)}`}
                              size="small"
                              sx={{
                                bgcolor: parent.totalCarriedOver >= 0 ? alpha('#3B82F6', 0.15) : alpha('#EF4444', 0.15),
                                color: parent.totalCarriedOver >= 0 ? '#3B82F6' : '#EF4444',
                                fontWeight: 600,
                                fontSize: '0.65rem',
                              }}
                            />
                          )}
                        </Box>

                        <Box sx={{ mb: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(parentSpentPercent, 100)}
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.1) : '#E5E7EB',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: parentIsOverBudget ? '#EF4444' : parent.color,
                                borderRadius: 4,
                              },
                            }}
                          />
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatAmount(parent.totalSpent)} / {formatAmount(parent.totalAvailable)}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 600,
                              color: parentIsOverBudget ? '#EF4444' : '#10B981',
                            }}
                          >
                            {formatAmount(parent.totalRemaining)} restant
                          </Typography>
                        </Box>
                      </Box>

                      {/* Sous-catégories (avec alinéa) */}
                      {parent.subcategories.length > 0 && (
                        <Box sx={{ ml: 3, mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {parent.subcategories.map((subcat) => {
                            const subcatSpentPercent = subcat.total_available > 0
                              ? (subcat.spent_amount / subcat.total_available) * 100
                              : 0;
                            const subcatIsOverBudget = subcat.spent_amount > subcat.total_available;

                            return (
                              <Box
                                key={subcat.id}
                                onClick={() => handleDetailCategoryClick(subcat)}
                                sx={{
                                  p: 1.5,
                                  borderRadius: 2,
                                  bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.03) : '#F9FAFB',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  borderLeft: `3px solid ${subcat.category?.color || parent.color}`,
                                  '&:hover': {
                                    bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.06) : '#F3F4F6',
                                    transform: 'translateX(4px)',
                                  },
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Box
                                    sx={{
                                      width: 10,
                                      height: 10,
                                      borderRadius: '50%',
                                      bgcolor: subcat.category?.color || parent.color,
                                    }}
                                  />
                                  <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, color: theme.palette.text.primary }}>
                                    {subcat.category?.name}
                                  </Typography>
                                  <Chip
                                    label={`${subcat.percentage}%`}
                                    size="small"
                                    sx={{
                                      bgcolor: alpha(subcat.category?.color || parent.color, 0.15),
                                      color: subcat.category?.color || parent.color,
                                      fontWeight: 600,
                                      fontSize: '0.65rem',
                                      height: 20,
                                    }}
                                  />
                                  {subcat.carried_over !== 0 && (
                                    <Chip
                                      label={`${subcat.carried_over >= 0 ? '+' : ''}${formatAmount(subcat.carried_over)}`}
                                      size="small"
                                      sx={{
                                        bgcolor: subcat.carried_over >= 0 ? alpha('#3B82F6', 0.15) : alpha('#EF4444', 0.15),
                                        color: subcat.carried_over >= 0 ? '#3B82F6' : '#EF4444',
                                        fontWeight: 600,
                                        fontSize: '0.6rem',
                                        height: 18,
                                      }}
                                    />
                                  )}
                                </Box>

                                <Box sx={{ mb: 0.5 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={Math.min(subcatSpentPercent, 100)}
                                    sx={{
                                      height: 5,
                                      borderRadius: 2.5,
                                      bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.1) : '#E5E7EB',
                                      '& .MuiLinearProgress-bar': {
                                        bgcolor: subcatIsOverBudget ? '#EF4444' : (subcat.category?.color || parent.color),
                                        borderRadius: 2.5,
                                      },
                                    }}
                                  />
                                </Box>

                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                    {formatAmount(subcat.spent_amount)} / {formatAmount(subcat.total_available)}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: '0.7rem',
                                      color: subcatIsOverBudget ? '#EF4444' : '#10B981',
                                    }}
                                  >
                                    {formatAmount(subcat.remaining_amount)} restant
                                  </Typography>
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  Configurez vos budgets par catégorie dans les paramètres
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de détail des catégories */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, minHeight: '60vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {selectedSubcategory && (
              <IconButton onClick={handleBackToSubcategories} size="small">
                <ArrowBackIcon />
              </IconButton>
            )}
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: selectedParentCategory?.color || '#6B7280',
              }}
            />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {selectedSubcategory
                ? selectedSubcategory.subcategory.category?.name
                : selectedParentCategory?.name}
            </Typography>
          </Box>
          <IconButton onClick={handleCloseDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {/* Navigation par mois dans le dialog */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              mb: 3,
              py: 1,
              borderBottom: '1px solid #E5E7EB',
            }}
          >
            <IconButton onClick={handleDialogPrevMonth} size="small">
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, minWidth: 150, textAlign: 'center' }}>
              {format(dialogMonth, 'MMMM yyyy', { locale: fr })}
            </Typography>
            <IconButton onClick={handleDialogNextMonth} size="small">
              <ChevronRightIcon />
            </IconButton>
          </Box>

          {selectedSubcategory ? (
            // Vue des transactions pour une sous-catégorie
            <Box>
              {isPersonalAccount ? (
                // Profil personnel : vue simplifiée avec résumé et bouton d'enregistrement
                <Box>
                  <Box sx={{ textAlign: 'center', p: 3, bgcolor: '#F9FAFB', borderRadius: 2, mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Budget alloué
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: selectedSubcategory.subcategory.category?.color || '#6B7280' }}>
                      {formatAmount(selectedSubcategory.subcategory.allocated_amount)}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 2 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Dépensé</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#EF4444' }}>
                          {formatAmount(selectedSubcategory.subcategory.spent_amount)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Restant</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#10B981' }}>
                          {formatAmount(selectedSubcategory.subcategory.remaining_amount)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Utilisez les boutons du tableau de bord pour enregistrer une dépense ou un revenu.
                    </Typography>
                  </Box>
                </Box>
              ) : (
                // Profil business : vue complète avec transactions
                <Box>
                  {/* Résumé revenus/dépenses */}
                  <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <Card sx={{ flex: 1, bgcolor: '#10B98110', borderRadius: 2 }}>
                      <CardContent sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TrendingUpIcon sx={{ color: '#10B981' }} />
                          <Typography variant="body2" color="text.secondary">
                            Revenus
                          </Typography>
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#10B981', mt: 1 }}>
                          {formatAmount(selectedSubcategory.totalRevenue)}
                        </Typography>
                      </CardContent>
                    </Card>
                    <Card sx={{ flex: 1, bgcolor: '#EF444410', borderRadius: 2 }}>
                      <CardContent sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TrendingDownIcon sx={{ color: '#EF4444' }} />
                          <Typography variant="body2" color="text.secondary">
                            Dépenses
                          </Typography>
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#EF4444', mt: 1 }}>
                          {formatAmount(selectedSubcategory.totalExpense)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>

                  {/* Liste des transactions */}
                  {loadingTransactions ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : selectedSubcategory.transactions.length > 0 ? (
                    <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                            <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                            <TableCell sx={{ fontWeight: 600 }} align="right">Montant</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedSubcategory.transactions.map((tx) => (
                            <TableRow key={tx.id} hover>
                              <TableCell>
                                {format(new Date(tx.transaction_date), 'dd/MM/yyyy')}
                              </TableCell>
                              <TableCell>{tx.description}</TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  fontWeight: 600,
                                  color: tx.type === 'revenue' ? '#10B981' : '#EF4444',
                                }}
                              >
                                {tx.type === 'revenue' ? '+' : '-'}{formatAmount(tx.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <ReceiptIcon sx={{ fontSize: 48, color: '#E5E7EB', mb: 1 }} />
                      <Typography color="text.secondary">
                        Aucune transaction pour ce mois
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            // Vue des sous-catégories
            <Box>
              {/* Résumé de la catégorie mère avec report */}
              {selectedParentCategory && (
                <Box sx={{ mb: 3 }}>
                  {/* Pourcentage alloué */}
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#F9FAFB', borderRadius: 2, mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Pourcentage alloué du budget total
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: selectedParentCategory.color }}>
                      {selectedParentCategory.totalPercentage.toFixed(1)}%
                    </Typography>
                  </Box>

                  {/* Camembert des sous-catégories ramenées à 100% */}
                  {selectedParentCategory.subcategories.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, textAlign: 'center' }}>
                        Répartition interne
                      </Typography>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={selectedParentCategory.subcategories.map(subcat => {
                              // Calculer le pourcentage ramené à 100%
                              const scaledPercentage = selectedParentCategory.totalPercentage > 0
                                ? (subcat.percentage / selectedParentCategory.totalPercentage) * 100
                                : 0;
                              return {
                                name: subcat.category?.name || 'Inconnu',
                                value: scaledPercentage,
                                originalPercentage: subcat.percentage,
                                allocated: subcat.allocated_amount,
                                spent: subcat.spent_amount,
                                remaining: subcat.remaining_amount,
                                color: subcat.category?.color || '#6B7280',
                                subcat,
                              };
                            })}
                            cx="50%"
                            cy="50%"
                            innerRadius={0}
                            outerRadius={85}
                            paddingAngle={2}
                            dataKey="value"
                            onClick={(data) => data.subcat && handleSubcategoryClick(data.subcat)}
                            style={{ cursor: 'pointer' }}
                          >
                            {selectedParentCategory.subcategories.map((subcat, index) => (
                              <Cell
                                key={`subcell-${index}`}
                                fill={subcat.category?.color || '#6B7280'}
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <Box
                                    sx={{
                                      bgcolor: 'white',
                                      p: 1.5,
                                      borderRadius: 2,
                                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                      minWidth: 160,
                                    }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                      <Box
                                        sx={{
                                          width: 10,
                                          height: 10,
                                          borderRadius: '50%',
                                          bgcolor: data.color,
                                        }}
                                      />
                                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        {data.name}
                                      </Typography>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {data.value.toFixed(1)}% de {selectedParentCategory.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      ({data.originalPercentage}% du budget total)
                                    </Typography>
                                    <Divider sx={{ my: 0.5 }} />
                                    <Typography variant="caption" display="block">
                                      Budget: {formatAmount(data.allocated)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#EF4444' }} display="block">
                                      Dépensé: {formatAmount(data.spent)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: data.remaining >= 0 ? '#10B981' : '#EF4444' }} display="block">
                                      Restant: {formatAmount(data.remaining)}
                                    </Typography>
                                  </Box>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend
                            payload={selectedParentCategory.subcategories.map(subcat => {
                              const scaledPercentage = selectedParentCategory.totalPercentage > 0
                                ? (subcat.percentage / selectedParentCategory.totalPercentage) * 100
                                : 0;
                              return {
                                value: `${subcat.category?.name} (${scaledPercentage.toFixed(1)}%)`,
                                type: 'square' as const,
                                color: subcat.category?.color || '#6B7280',
                              };
                            })}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  )}

                  {/* Budget du mois et Report */}
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#F9FAFB', borderRadius: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Budget du mois
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                          {formatAmount(selectedParentCategory.totalAllocated)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{
                        textAlign: 'center',
                        p: 2,
                        bgcolor: selectedParentCategory.totalCarriedOver >= 0 ? '#3B82F610' : '#EF444410',
                        borderRadius: 2
                      }}>
                        <Typography variant="body2" color="text.secondary">
                          Report mois précédent
                        </Typography>
                        <Typography variant="h5" sx={{
                          fontWeight: 700,
                          color: selectedParentCategory.totalCarriedOver >= 0 ? '#3B82F6' : '#EF4444'
                        }}>
                          {selectedParentCategory.totalCarriedOver >= 0 ? '+' : ''}{formatAmount(selectedParentCategory.totalCarriedOver)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Total disponible, Dépensé, Restant */}
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#8B5CF610', borderRadius: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Total disponible
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#8B5CF6' }}>
                          {formatAmount(selectedParentCategory.totalAvailable)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#EF444410', borderRadius: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Dépensé
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#EF4444' }}>
                          {formatAmount(selectedParentCategory.totalSpent)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box sx={{
                        textAlign: 'center',
                        p: 2,
                        bgcolor: selectedParentCategory.totalRemaining >= 0 ? '#10B98110' : '#EF444410',
                        borderRadius: 2
                      }}>
                        <Typography variant="body2" color="text.secondary">
                          Restant
                        </Typography>
                        <Typography variant="h6" sx={{
                          fontWeight: 700,
                          color: selectedParentCategory.totalRemaining >= 0 ? '#10B981' : '#EF4444'
                        }}>
                          {formatAmount(selectedParentCategory.totalRemaining)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Liste des sous-catégories */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                Détail par sous-catégorie
              </Typography>

              {selectedParentCategory?.subcategories.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CategoryIcon sx={{ fontSize: 48, color: '#E5E7EB', mb: 1 }} />
                  <Typography color="text.secondary">
                    Aucune sous-catégorie avec budget
                  </Typography>
                </Box>
              ) : (
                <List sx={{ bgcolor: '#F9FAFB', borderRadius: 2 }}>
                  {selectedParentCategory?.subcategories.map((subcat, index) => {
                    const spentPercent = subcat.total_available > 0
                      ? (subcat.spent_amount / subcat.total_available) * 100
                      : 0;
                    const isOverBudget = subcat.spent_amount > subcat.total_available;

                    return (
                      <Box key={subcat.id}>
                        {index > 0 && <Divider />}
                        <ListItem
                          onClick={() => handleSubcategoryClick(subcat)}
                          sx={{
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                            '&:hover': { bgcolor: '#F3F4F6' },
                            py: 2,
                          }}
                        >
                          <ListItemIcon>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: subcat.category?.color || '#6B7280',
                              }}
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography sx={{ fontWeight: 600 }}>
                                  {subcat.category?.name}
                                </Typography>
                                <Chip
                                  label={`${subcat.percentage}%`}
                                  size="small"
                                  sx={{
                                    bgcolor: (subcat.category?.color || '#6B7280') + '20',
                                    color: subcat.category?.color || '#6B7280',
                                    fontWeight: 600,
                                    fontSize: '0.7rem',
                                  }}
                                />
                                {subcat.carried_over !== 0 && (
                                  <Chip
                                    label={`Report: ${subcat.carried_over >= 0 ? '+' : ''}${formatAmount(subcat.carried_over)}`}
                                    size="small"
                                    sx={{
                                      bgcolor: subcat.carried_over >= 0 ? '#3B82F620' : '#EF444420',
                                      color: subcat.carried_over >= 0 ? '#3B82F6' : '#EF4444',
                                      fontWeight: 600,
                                      fontSize: '0.65rem',
                                    }}
                                  />
                                )}
                              </Box>
                            }
                            secondary={
                              <Box sx={{ mt: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(spentPercent, 100)}
                                  sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    bgcolor: '#E5E7EB',
                                    mb: 0.5,
                                    '& .MuiLinearProgress-bar': {
                                      bgcolor: isOverBudget ? '#EF4444' : subcat.category?.color || '#6B7280',
                                      borderRadius: 3,
                                    },
                                  }}
                                />
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {formatAmount(subcat.spent_amount)} / {formatAmount(subcat.total_available)}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontWeight: 600,
                                      color: isOverBudget ? '#EF4444' : '#10B981',
                                    }}
                                  >
                                    {formatAmount(subcat.remaining_amount)} restant
                                  </Typography>
                                </Box>
                              </Box>
                            }
                          />
                          <ChevronRightIcon sx={{ color: '#9CA3AF' }} />
                        </ListItem>
                      </Box>
                    );
                  })}
                </List>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de détail des dépenses pour une catégorie (depuis la liste de droite) */}
      <Dialog
        open={detailDialogOpen}
        onClose={handleCloseDetailDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, minHeight: '50vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: adaptColorForTheme(selectedDetailCategory?.category?.color || '#6B7280'),
              }}
            />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {selectedDetailCategory?.category?.name}
            </Typography>
            <Chip
              label={`${selectedDetailCategory?.percentage || 0}%`}
              size="small"
              sx={{
                bgcolor: adaptColorForTheme(selectedDetailCategory?.category?.color || '#6B7280') + '20',
                color: adaptColorForTheme(selectedDetailCategory?.category?.color || '#6B7280'),
                fontWeight: 600,
              }}
            />
          </Box>
          <IconButton onClick={handleCloseDetailDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {/* Résumé budget avec report */}
          {selectedDetailCategory && (
            <Box sx={{ mb: 3 }}>
              {/* Budget du mois et Report */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : '#F9FAFB', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Budget du mois
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: adaptColorForTheme(selectedDetailCategory.category?.color || '#6B7280') }}>
                      {formatAmount(selectedDetailCategory.allocated_amount)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{
                    textAlign: 'center',
                    p: 2,
                    bgcolor: selectedDetailCategory.carried_over >= 0 ? '#3B82F610' : '#EF444410',
                    borderRadius: 2
                  }}>
                    <Typography variant="body2" color="text.secondary">
                      Report mois précédent
                    </Typography>
                    <Typography variant="h5" sx={{
                      fontWeight: 700,
                      color: selectedDetailCategory.carried_over >= 0 ? '#3B82F6' : '#EF4444'
                    }}>
                      {selectedDetailCategory.carried_over >= 0 ? '+' : ''}{formatAmount(selectedDetailCategory.carried_over)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Total disponible, Dépensé, Restant */}
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#8B5CF610', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total disponible
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#8B5CF6' }}>
                      {formatAmount(selectedDetailCategory.total_available)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#EF444410', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Dépensé
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#EF4444' }}>
                      {formatAmount(selectedDetailCategory.spent_amount)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box sx={{
                    textAlign: 'center',
                    p: 2,
                    bgcolor: selectedDetailCategory.remaining_amount >= 0 ? '#10B98110' : '#EF444410',
                    borderRadius: 2
                  }}>
                    <Typography variant="body2" color="text.secondary">
                      Restant
                    </Typography>
                    <Typography variant="h5" sx={{
                      fontWeight: 700,
                      color: selectedDetailCategory.remaining_amount >= 0 ? '#10B981' : '#EF4444'
                    }}>
                      {formatAmount(selectedDetailCategory.remaining_amount)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Barre de progression basée sur total disponible */}
              <Box sx={{ mt: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={selectedDetailCategory.total_available > 0
                    ? Math.min((selectedDetailCategory.spent_amount / selectedDetailCategory.total_available) * 100, 100)
                    : 0
                  }
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    bgcolor: theme.palette.mode === 'dark' ? '#374151' : '#E5E7EB',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: selectedDetailCategory.spent_amount > selectedDetailCategory.total_available
                        ? '#EF4444'
                        : adaptColorForTheme(selectedDetailCategory.category?.color || '#6B7280'),
                      borderRadius: 5,
                    },
                  }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {selectedDetailCategory.total_available > 0
                      ? ((selectedDetailCategory.spent_amount / selectedDetailCategory.total_available) * 100).toFixed(1)
                      : 0
                    }% du total disponible utilisé
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {format(currentDate, 'MMMM yyyy', { locale: fr })}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}

          {/* Liste des transactions */}
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Détail des dépenses
          </Typography>

          {loadingTransactions ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : detailTransactions.length > 0 ? (
            <TableContainer component={Paper} sx={{ borderRadius: 2, bgcolor: theme.palette.background.paper }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : '#F9FAFB' }}>
                    <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Catégorie</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }} align="right">Montant</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailTransactions.map((tx) => (
                    <TableRow key={tx.id} hover>
                      <TableCell sx={{ color: theme.palette.text.primary }}>
                        {format(new Date(tx.transaction_date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 250, color: theme.palette.text.primary }}>
                          {tx.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: adaptColorForTheme(tx.category?.color || '#6B7280'),
                            }}
                          />
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                            {tx.category?.name || '-'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 600,
                          color: tx.type === 'revenue' ? '#10B981' : '#EF4444',
                        }}
                      >
                        {tx.type === 'revenue' ? '+' : '-'}{formatAmount(tx.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <ReceiptIcon sx={{ fontSize: 48, color: theme.palette.text.disabled, mb: 1 }} />
              <Typography color="text.secondary">
                Aucune dépense pour ce mois
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, maxWidth: 300, mx: 'auto' }}>
                Importez vos relevés bancaires (PDF ou CSV) pour voir vos transactions ici
              </Typography>
              <Box
                component="button"
                onClick={() => {
                  handleCloseDetailDialog();
                  router.push('/dashboard/banque');
                }}
                sx={{
                  mt: 2,
                  px: 3,
                  py: 1,
                  bgcolor: adaptColorForTheme(selectedDetailCategory?.category?.color || '#3B82F6'),
                  color: 'white',
                  border: 'none',
                  borderRadius: 2,
                  cursor: 'pointer',
                  fontWeight: 600,
                  '&:hover': { opacity: 0.9 },
                }}
              >
                Importer des transactions
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog popup pour le drill-down (quand on reclique sur une slice sélectionnée) */}
      <Dialog
        open={drillDownDialogOpen}
        onClose={handleCloseDrillDownDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: alpha(theme.palette.background.paper, 0.98),
            backdropFilter: 'blur(10px)',
            maxHeight: '85vh',
          },
        }}
        BackdropProps={{
          sx: {
            bgcolor: alpha(theme.palette.common.black, 0.5),
            backdropFilter: 'blur(4px)',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                bgcolor: selectedCategoryData ? adaptColorForTheme(selectedCategoryData.color) : '#6B7280',
              }}
            />
            <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
              Transactions - {selectedCategoryData?.name}
            </Typography>
          </Box>
          <IconButton onClick={handleCloseDrillDownDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          {selectedCategoryData && (
            <>
              {/* Résumé rapide */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Chip
                  label={`${categoryTransactions.length} transaction(s)`}
                  size="small"
                  sx={{
                    bgcolor: alpha(adaptColorForTheme(selectedCategoryData.color), 0.1),
                    color: adaptColorForTheme(selectedCategoryData.color),
                  }}
                />
                <Chip
                  label={`Total: ${formatAmount(categoryTransactions.reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : 0), 0))}`}
                  size="small"
                  sx={{ bgcolor: alpha('#EF4444', 0.1), color: '#EF4444' }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                  {format(currentDate, 'MMMM yyyy', { locale: fr })}
                </Typography>
              </Box>

              {/* Liste des transactions */}
              {loadingCategoryTransactions ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={40} sx={{ color: adaptColorForTheme(selectedCategoryData.color) }} />
                </Box>
              ) : categoryTransactions.length > 0 ? (
                <TableContainer component={Paper} sx={{ borderRadius: 2, bgcolor: theme.palette.background.default }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: alpha(theme.palette.grey[500], 0.1) }}>
                        <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Description</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Catégorie</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }} align="right">Montant</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {categoryTransactions.map((tx) => (
                        <TableRow key={tx.id} hover>
                          <TableCell sx={{ color: theme.palette.text.primary }}>
                            {format(new Date(tx.transaction_date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 300, color: theme.palette.text.primary }}>
                              {tx.description}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  bgcolor: adaptColorForTheme(tx.category?.color || '#6B7280'),
                                }}
                              />
                              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                                {tx.category?.name || '-'}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontWeight: 600,
                              color: tx.type === 'revenue' ? '#10B981' : '#EF4444',
                            }}
                          >
                            {tx.type === 'revenue' ? '+' : '-'}{formatAmount(tx.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <ReceiptIcon sx={{ fontSize: 56, color: theme.palette.text.disabled, mb: 2 }} />
                  <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                    Aucune transaction pour cette catégorie ce mois-ci
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, maxWidth: 300, mx: 'auto' }}>
                    Importez vos relevés bancaires (PDF ou CSV) pour voir vos transactions ici
                  </Typography>
                  <Box
                    component="button"
                    onClick={() => {
                      handleCloseDrillDownDialog();
                      router.push('/dashboard/banque');
                    }}
                    sx={{
                      mt: 2,
                      px: 3,
                      py: 1,
                      bgcolor: adaptColorForTheme(selectedCategoryData?.color || '#3B82F6'),
                      color: 'white',
                      border: 'none',
                      borderRadius: 2,
                      cursor: 'pointer',
                      fontWeight: 600,
                      '&:hover': { opacity: 0.9 },
                    }}
                  >
                    Importer des transactions
                  </Box>
                </Box>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
