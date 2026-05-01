// Default theme — mirrors src/tokens/base.json.
// Update both files when tokens change, or add a style-dictionary JS platform to generate this.
import './theme.types';
import type { DefaultTheme } from 'styled-components';

export const defaultTheme: DefaultTheme = {
  color: {
    brand: {
      primary: '#0066FF',
      secondary: '#6B21A8',
    },
    neutral: {
      0: '#FFFFFF',
      100: '#F5F5F5',
      200: '#E5E5E5',
      300: '#D4D4D4',
      500: '#737373',
      700: '#404040',
      900: '#0A0A0A',
    },
    red: {
      0: '#FFF5F5', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5',
      500: '#EF4444', 700: '#B91C1C', 900: '#7F1D1D',
    },
    blue: {
      0: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
      500: '#3B82F6', 700: '#1D4ED8', 900: '#1E3A8A',
    },
    green: {
      0: '#F0FFF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC',
      500: '#22C55E', 700: '#15803D', 900: '#14532D',
    },
    orange: {
      0: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74',
      500: '#F97316', 700: '#C2410C', 900: '#7C2D12',
    },
    yellow: {
      0: '#FEFCE8', 100: '#FEF9C3', 200: '#FEF08A', 300: '#FDE047',
      500: '#EAB308', 700: '#A16207', 900: '#713F12',
    },
    semantic: {
      error: '#DC2626',
      success: '#16A34A',
      warning: '#D97706',
      info: '#0284C7',
    },
  },
  typography: {
    fontFamily: {
      sans: "'Inter', system-ui, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '24px',
      '2xl': '32px',
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      loose: 1.75,
    },
  },
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },
  border: {
    radius: {
      sm: '4px',
      md: '6px',
      lg: '8px',
      xl: '12px',
      full: '9999px',
    },
    width: {
      default: '1px',
      thick: '2px',
    },
  },
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.05)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -2px rgba(0,0,0,0.05)',
  },
  transition: {
    duration: {
      fast: '100ms',
      normal: '200ms',
      slow: '300ms',
    },
    easing: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
    },
  },
  zIndex: {
    dropdown: 100,
    sticky: 120,
    modal: 200,
    tooltip: 300,
  },
};
