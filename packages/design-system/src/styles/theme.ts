// Default theme — mirrors src/tokens/base.json.
// Update both files when tokens change, or add a style-dictionary JS platform to generate this.
import './theme.types';
import type { DefaultTheme } from 'styled-components';

const sharedTokens = {
  color: {
    brand: {
      primary: '#0066FF',
      secondary: '#6B21A8',
    },
    red: {
      0: '#FFF5F5', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5',
      400: '#F87171', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C', 800: '#991B1B', 900: '#7F1D1D',
    },
    blue: {
      0: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
      400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8', 800: '#1E40AF', 900: '#1E3A8A',
    },
    green: {
      0: '#F0FFF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC',
      400: '#4ADE80', 500: '#22C55E', 600: '#16A34A', 700: '#15803D', 800: '#166534', 900: '#14532D',
    },
    orange: {
      0: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74',
      400: '#FB923C', 500: '#F97316', 600: '#EA580C', 700: '#C2410C', 800: '#9A3412', 900: '#7C2D12',
    },
    yellow: {
      0: '#FEFCE8', 100: '#FEF9C3', 200: '#FEF08A', 300: '#FDE047',
      400: '#FACC15', 500: '#EAB308', 600: '#CA8A04', 700: '#A16207', 800: '#854D0E', 900: '#713F12',
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

export const defaultTheme: DefaultTheme = {
  mode: 'light',
  ...sharedTokens,
  color: {
    ...sharedTokens.color,
    neutral: {
      0: '#FFFFFF',
      100: '#F5F5F5',
      200: '#E5E5E5',
      300: '#D4D4D4',
      400: '#A3A3A3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#0A0A0A',
    },
  },
};

export const darkTheme: DefaultTheme = {
  mode: 'dark',
  ...sharedTokens,
  color: {
    ...sharedTokens.color,
    neutral: {
      0: '#0A0A0A',
      100: '#171717',
      200: '#262626',
      300: '#404040',
      400: '#525252',
      500: '#737373',
      600: '#A3A3A3',
      700: '#D4D4D4',
      800: '#E5E5E5',
      900: '#F5F5F5',
    },
  },
};
