# Mises à jour du Design - DafGram

## Vue d'ensemble

Le design de DafGram a été mis à jour pour correspondre au style visuel des dashboards modernes avec une palette sombre et des couleurs vives.

## Inspiration

Le design s'inspire des références visuelles fournies qui présentent :
- **Fond sombre** : Navy/Dark blue (#0F172A, #1E293B)
- **Couleurs vives** : Violet, Cyan, Vert, Rose, Orange
- **Contraste élevé** : Excellent lisibilité sur fond sombre
- **Densité d'information** : Compacte mais aérée
- **Composants modernes** : Cartes KPI, barres de progression avec dégradés, graphiques

## Modifications principales

### 1. Thème Material-UI personnalisé (`frontend/app/theme.ts`)

**Palette de couleurs :**
- Primary (Violet) : `#7C3AED`
- Secondary (Cyan) : `#06B6D4`
- Success (Vert) : `#10B981`
- Warning (Orange) : `#F59E0B`
- Error (Rouge) : `#EF4444`
- Info (Bleu) : `#3B82F6`
- Background Default : `#0F172A` (Slate 900)
- Background Paper : `#1E293B` (Slate 800)
- Text Primary : `#F1F5F9` (Slate 100)
- Text Secondary : `#94A3B8` (Slate 400)

**Composants :**
- Bordures arrondies : 12px
- Suppression des ombres portées (shadow)
- Borders subtiles avec `#334155`
- Typography optimisée pour la lisibilité

### 2. Composant MetricCard (`frontend/components/MetricCard.tsx`)

Nouveau composant réutilisable pour afficher des KPIs :
- **Fond** : Dégradé subtil avec la couleur de la métrique
- **Bordure** : Couleur personnalisée avec opacité
- **Ligne d'accent** : Barre colorée en bas de la carte
- **Support** : Icônes, trends, sous-titres

Utilisation :
```tsx
<MetricCard
  title="Revenus totaux"
  value="€1,234.56"
  subtitle="Ce mois"
  icon={<TrendingUpIcon />}
  color="#10B981"
  trend={{ value: "+12%", isPositive: true }}
/>
```

### 3. Page Dashboard (`frontend/app/dashboard/page.tsx`)

- **Cartes KPI** : 4 métriques principales avec données dynamiques
  - Revenus totaux (vert)
  - Dépenses totales (rouge)
  - Solde net (cyan/orange selon positif/négatif)
  - Employés actifs (violet)
- **Section d'accueil** : Fond avec dégradé violet/cyan
- **Données dynamiques** : Fetch des stats réelles depuis l'API

### 4. Page Login (`frontend/app/login/page.tsx`)

- **Fond animé** : Dégradé sombre avec bulles de couleur floues
- **Carte centrale** : Fond #1E293B avec bordure subtile
- **Logo** : Texte avec dégradé violet → cyan
- **Bouton** : Dégradé violet → cyan avec effet hover
- **Décorations** : Cercles flous en arrière-plan (violet et cyan)

### 5. Layout Navigation (`frontend/components/DashboardLayout.tsx`)

- **Sidebar** : Fond #1E293B avec bordure
- **Logo** : Texte avec dégradé violet → cyan
- **Menu items** :
  - Hover avec fond violet
  - Icônes et texte deviennent blancs au hover
  - Bordures arrondies (8px)
- **Bouton déconnexion** : Hover avec fond rouge

### 6. Page Employés (`frontend/app/dashboard/employees/page.tsx`)

- **Barres de progression** :
  - Dégradés colorés selon le pourcentage
  - 100%+ : Vert (#10B981 → #34D399)
  - 75-99% : Violet (#7C3AED → #A78BFA)
  - 50-74% : Orange (#F59E0B → #FBBF24)
  - <50% : Rouge (#EF4444 → #F87171)
- **Fond de barre** : #334155 (slate-700)
- **Animation** : Transition smooth (0.3s)

## Principes de design appliqués

### Hiérarchie visuelle
1. **Titre de page** : H4, bold (700), couleur text.primary
2. **Sous-titre** : Body1, couleur text.secondary
3. **Métriques** : Chiffres grands (2rem), couleur primaire selon contexte
4. **Labels** : Petits (0.75rem), uppercase, espacement lettres

### Contraste et lisibilité
- Texte principal : `#F1F5F9` sur fond `#0F172A` (ratio > 14:1)
- Texte secondaire : `#94A3B8` sur fond `#0F172A` (ratio > 7:1)
- Couleurs vives pour les accents et points d'attention

### Espacement
- Entre sections : 3-4 (24-32px)
- Entre cartes : 3 (24px)
- Padding cartes : 3-4 (24-32px)
- Marges internes : 2-3 (16-24px)

### Bordures et arrondis
- Cartes principales : 12px
- Boutons : 8px
- Barres de progression : 8px
- Inputs : 4px (par défaut MUI)

## Composants à mettre à jour (TODO)

Les pages suivantes utilisent encore l'ancien style et nécessitent une mise à jour :

- [ ] Page Budgets (`frontend/app/dashboard/budgets/page.tsx`)
  - Mettre à jour le camembert avec de meilleures couleurs
  - Améliorer les barres de progression
  - Ajouter des cartes KPI pour les totaux

- [ ] Page Comptabilité (`frontend/app/dashboard/comptabilite/page.tsx`)
  - Cartes KPI pour revenus/dépenses/solde
  - Tableau avec meilleur contraste
  - Chips colorés pour les types de transaction

- [ ] Page Documents (`frontend/app/dashboard/documents/page.tsx`)
  - Zone d'upload plus attractive
  - Tableau avec meilleur style
  - Chips colorés pour les statuts

## Palette de couleurs de référence

```
Violet Primary:    #7C3AED
Violet Light:      #A78BFA
Violet Dark:       #5B21B6

Cyan Secondary:    #06B6D4
Cyan Light:        #22D3EE
Cyan Dark:         #0891B2

Vert Success:      #10B981
Vert Light:        #34D399
Vert Dark:         #059669

Orange Warning:    #F59E0B
Orange Light:      #FBBF24
Orange Dark:       #D97706

Rouge Error:       #EF4444
Rouge Light:       #F87171
Rouge Dark:        #DC2626

Bleu Info:         #3B82F6
Bleu Light:        #60A5FA
Bleu Dark:         #2563EB

Fond Principal:    #0F172A (Slate 900)
Fond Cartes:       #1E293B (Slate 800)
Bordures:          #334155 (Slate 700)
Text Primary:      #F1F5F9 (Slate 100)
Text Secondary:    #94A3B8 (Slate 400)
```

## Instructions pour les futures modifications

1. **Toujours utiliser le thème** : Importer et utiliser les couleurs du thème plutôt que des valeurs hardcodées
2. **Cohérence des dégradés** : Utiliser `linear-gradient(135deg, color1, color2)` pour tous les dégradés
3. **Bordures** : Toujours utiliser `border: '1px solid #334155'` ou `borderColor: 'divider'`
4. **Espacement** : Utiliser le système de spacing MUI (multiples de 8px)
5. **Accessibilité** : Maintenir un ratio de contraste minimum de 7:1 pour le texte secondaire

## Ressources

- Material-UI Theme: https://mui.com/material-ui/customization/theming/
- Tailwind Colors Reference: https://tailwindcss.com/docs/customizing-colors
- Images de référence: `design/reference/`
