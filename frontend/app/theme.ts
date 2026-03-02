'use client';

import { createTheme } from '@mui/material/styles';

// Thème Light inspiré de la référence DafGram
export const dafgramTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#F5C518', // Jaune/Or DafGram
      light: '#FFD54F',
      dark: '#C9A000',
      contrastText: '#1A1A1A',
    },
    secondary: {
      main: '#1A1A1A', // Noir pour contraste
      light: '#424242',
      dark: '#000000',
    },
    success: {
      main: '#22C55E', // Vert
      light: '#4ADE80',
      dark: '#16A34A',
    },
    warning: {
      main: '#F59E0B', // Orange
      light: '#FBBF24',
      dark: '#D97706',
    },
    error: {
      main: '#EF4444', // Rouge
      light: '#F87171',
      dark: '#DC2626',
    },
    info: {
      main: '#3B82F6', // Bleu
      light: '#60A5FA',
      dark: '#2563EB',
    },
    background: {
      default: '#F5F5F7', // Gris très clair
      paper: '#FFFFFF', // Blanc pur pour les cartes
    },
    text: {
      primary: '#1A1A1A', // Noir
      secondary: '#6B7280', // Gris moyen
    },
    divider: '#E5E7EB', // Gris clair
  },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      fontSize: '1.75rem',
      letterSpacing: '-0.02em',
      color: '#1A1A1A',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: '0.875rem',
      color: '#6B7280',
    },
    subtitle2: {
      fontWeight: 500,
      fontSize: '0.75rem',
      color: '#9CA3AF',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
    body1: {
      fontSize: '0.95rem',
    },
    body2: {
      fontSize: '0.875rem',
      color: '#6B7280',
    },
  },
  shape: {
    borderRadius: 16,
  },
  shadows: [
    'none',
    '0px 1px 3px rgba(0, 0, 0, 0.04)',
    '0px 2px 6px rgba(0, 0, 0, 0.04)',
    '0px 4px 12px rgba(0, 0, 0, 0.05)',
    '0px 8px 24px rgba(0, 0, 0, 0.06)',
    '0px 12px 32px rgba(0, 0, 0, 0.08)',
    '0px 16px 40px rgba(0, 0, 0, 0.1)',
    '0px 20px 48px rgba(0, 0, 0, 0.12)',
    '0px 24px 56px rgba(0, 0, 0, 0.14)',
    '0px 28px 64px rgba(0, 0, 0, 0.16)',
    '0px 32px 72px rgba(0, 0, 0, 0.18)',
    '0px 36px 80px rgba(0, 0, 0, 0.2)',
    '0px 40px 88px rgba(0, 0, 0, 0.22)',
    '0px 44px 96px rgba(0, 0, 0, 0.24)',
    '0px 48px 104px rgba(0, 0, 0, 0.26)',
    '0px 52px 112px rgba(0, 0, 0, 0.28)',
    '0px 56px 120px rgba(0, 0, 0, 0.3)',
    '0px 60px 128px rgba(0, 0, 0, 0.32)',
    '0px 64px 136px rgba(0, 0, 0, 0.34)',
    '0px 68px 144px rgba(0, 0, 0, 0.36)',
    '0px 72px 152px rgba(0, 0, 0, 0.38)',
    '0px 76px 160px rgba(0, 0, 0, 0.4)',
    '0px 80px 168px rgba(0, 0, 0, 0.42)',
    '0px 84px 176px rgba(0, 0, 0, 0.44)',
    '0px 88px 184px rgba(0, 0, 0, 0.46)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#F5F5F7',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#FFFFFF',
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
          border: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#FFFFFF',
          boxShadow: 'none',
          borderBottom: '1px solid #E5E7EB',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #E5E7EB',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '8px 20px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(245, 197, 24, 0.3)',
          },
        },
        containedPrimary: {
          backgroundColor: '#F5C518',
          color: '#1A1A1A',
          '&:hover': {
            backgroundColor: '#E0B000',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 8,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          height: 8,
          backgroundColor: '#E5E7EB',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            color: '#1A1A1A',
            '& fieldset': {
              borderColor: '#E5E7EB',
            },
            '&:hover fieldset': {
              borderColor: '#D1D5DB',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#F5C518',
            },
          },
          '& .MuiInputBase-input': {
            color: '#1A1A1A',
            '&::placeholder': {
              color: '#9CA3AF',
              opacity: 1,
            },
          },
          '& .MuiInputLabel-root': {
            color: '#6B7280',
            '&.Mui-focused': {
              color: '#F5C518',
            },
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: '#F9FAFB',
            fontWeight: 600,
            color: '#6B7280',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #F3F4F6',
          padding: '16px',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          margin: '2px 8px',
          '&.Mui-selected': {
            backgroundColor: '#FEF9E7',
            '&:hover': {
              backgroundColor: '#FEF3C7',
            },
          },
          '&:hover': {
            backgroundColor: '#F9FAFB',
          },
        },
      },
    },
  },
});

// Thème Dark
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#F5C518', // Jaune/Or DafGram (même en dark)
      light: '#FFD54F',
      dark: '#C9A000',
      contrastText: '#1A1A1A',
    },
    secondary: {
      main: '#E5E7EB',
      light: '#F3F4F6',
      dark: '#9CA3AF',
    },
    success: {
      main: '#22C55E',
      light: '#4ADE80',
      dark: '#16A34A',
    },
    warning: {
      main: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
    info: {
      main: '#3B82F6',
      light: '#60A5FA',
      dark: '#2563EB',
    },
    background: {
      default: '#0F0F0F', // Fond très sombre
      paper: '#1A1A1A', // Cartes sombres
    },
    text: {
      primary: '#F5F5F7', // Texte clair
      secondary: '#9CA3AF', // Gris moyen
    },
    divider: '#2D2D2D', // Séparateurs sombres
  },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      fontSize: '1.75rem',
      letterSpacing: '-0.02em',
      color: '#F5F5F7',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: '0.875rem',
      color: '#9CA3AF',
    },
    subtitle2: {
      fontWeight: 500,
      fontSize: '0.75rem',
      color: '#6B7280',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
    body1: {
      fontSize: '0.95rem',
    },
    body2: {
      fontSize: '0.875rem',
      color: '#9CA3AF',
    },
  },
  shape: {
    borderRadius: 16,
  },
  shadows: [
    'none',
    '0px 1px 3px rgba(0, 0, 0, 0.2)',
    '0px 2px 6px rgba(0, 0, 0, 0.25)',
    '0px 4px 12px rgba(0, 0, 0, 0.3)',
    '0px 8px 24px rgba(0, 0, 0, 0.35)',
    '0px 12px 32px rgba(0, 0, 0, 0.4)',
    '0px 16px 40px rgba(0, 0, 0, 0.45)',
    '0px 20px 48px rgba(0, 0, 0, 0.5)',
    '0px 24px 56px rgba(0, 0, 0, 0.55)',
    '0px 28px 64px rgba(0, 0, 0, 0.6)',
    '0px 32px 72px rgba(0, 0, 0, 0.65)',
    '0px 36px 80px rgba(0, 0, 0, 0.7)',
    '0px 40px 88px rgba(0, 0, 0, 0.75)',
    '0px 44px 96px rgba(0, 0, 0, 0.8)',
    '0px 48px 104px rgba(0, 0, 0, 0.85)',
    '0px 52px 112px rgba(0, 0, 0, 0.9)',
    '0px 56px 120px rgba(0, 0, 0, 0.95)',
    '0px 60px 128px rgba(0, 0, 0, 1)',
    '0px 64px 136px rgba(0, 0, 0, 1)',
    '0px 68px 144px rgba(0, 0, 0, 1)',
    '0px 72px 152px rgba(0, 0, 0, 1)',
    '0px 76px 160px rgba(0, 0, 0, 1)',
    '0px 80px 168px rgba(0, 0, 0, 1)',
    '0px 84px 176px rgba(0, 0, 0, 1)',
    '0px 88px 184px rgba(0, 0, 0, 1)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0F0F0F',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1A1A1A',
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1A1A1A',
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.3)',
          border: '1px solid #2D2D2D',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1A1A1A',
          boxShadow: 'none',
          borderBottom: '1px solid #2D2D2D',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1A1A1A',
          borderRight: '1px solid #2D2D2D',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '8px 20px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(245, 197, 24, 0.3)',
          },
        },
        containedPrimary: {
          backgroundColor: '#F5C518',
          color: '#1A1A1A',
          '&:hover': {
            backgroundColor: '#E0B000',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 8,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          height: 8,
          backgroundColor: '#2D2D2D',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: '#1A1A1A',
            color: '#F5F5F7',
            '& fieldset': {
              borderColor: '#3D3D3D',
            },
            '&:hover fieldset': {
              borderColor: '#505050',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#F5C518',
            },
          },
          '& .MuiInputBase-input': {
            color: '#F5F5F7',
            '&::placeholder': {
              color: '#6B7280',
              opacity: 1,
            },
          },
          '& .MuiInputLabel-root': {
            color: '#9CA3AF',
            '&.Mui-focused': {
              color: '#F5C518',
            },
          },
          '& .MuiInputAdornment-root': {
            color: '#6B7280',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          color: '#F5F5F7',
        },
        icon: {
          color: '#9CA3AF',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: '#F5F5F7',
          '&:hover': {
            backgroundColor: '#252525',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(245, 197, 24, 0.15)',
            '&:hover': {
              backgroundColor: 'rgba(245, 197, 24, 0.25)',
            },
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#9CA3AF',
          '&.Mui-focused': {
            color: '#F5C518',
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          color: '#6B7280',
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          color: '#F5F5F7',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          '& .MuiAlert-message': {
            color: '#F5F5F7',
          },
        },
        standardError: {
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        },
        standardSuccess: {
          backgroundColor: 'rgba(34, 197, 94, 0.15)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
        },
        standardWarning: {
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        },
        standardInfo: {
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#2D2D2D',
          color: '#F5F5F7',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#2D2D2D',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: '#0F0F0F',
            fontWeight: 600,
            color: '#9CA3AF',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #2D2D2D',
          padding: '16px',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          margin: '2px 8px',
          '&.Mui-selected': {
            backgroundColor: 'rgba(245, 197, 24, 0.15)',
            '&:hover': {
              backgroundColor: 'rgba(245, 197, 24, 0.25)',
            },
          },
          '&:hover': {
            backgroundColor: '#252525',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1A1A1A',
          border: '1px solid #2D2D2D',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1A1A1A',
          border: '1px solid #2D2D2D',
        },
      },
    },
  },
});

// Export thème light comme alias
export const lightTheme = dafgramTheme;
