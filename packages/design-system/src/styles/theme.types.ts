import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    color: {
      brand: {
        primary: string;
        secondary: string;
      };
      neutral: {
        0: string;
        100: string;
        200: string;
        300: string;
        500: string;
        700: string;
        900: string;
      };
      red: {
        0: string; 100: string; 200: string; 300: string;
        500: string; 700: string; 900: string;
      };
      blue: {
        0: string; 100: string; 200: string; 300: string;
        500: string; 700: string; 900: string;
      };
      green: {
        0: string; 100: string; 200: string; 300: string;
        500: string; 700: string; 900: string;
      };
      orange: {
        0: string; 100: string; 200: string; 300: string;
        500: string; 700: string; 900: string;
      };
      yellow: {
        0: string; 100: string; 200: string; 300: string;
        500: string; 700: string; 900: string;
      };
      semantic: {
        error: string;
        success: string;
        warning: string;
        info: string;
      };
    };
    typography: {
      fontFamily: {
        sans: string;
        mono: string;
      };
      fontSize: {
        xs: string;
        sm: string;
        base: string;
        lg: string;
        xl: string;
        '2xl': string;
      };
      fontWeight: {
        regular: number;
        medium: number;
        semibold: number;
        bold: number;
      };
      lineHeight: {
        tight: number;
        normal: number;
        loose: number;
      };
    };
    spacing: {
      1: string;
      2: string;
      3: string;
      4: string;
      5: string;
      6: string;
      8: string;
      10: string;
      12: string;
      16: string;
    };
    border: {
      radius: {
        sm: string;
        md: string;
        lg: string;
        xl: string;
        full: string;
      };
      width: {
        default: string;
        thick: string;
      };
    };
    shadow: {
      sm: string;
      md: string;
      lg: string;
    };
    transition: {
      duration: {
        fast: string;
        normal: string;
        slow: string;
      };
      easing: {
        default: string;
        in: string;
        out: string;
      };
    };
    zIndex: {
      dropdown: number;
      sticky: number;
      modal: number;
      tooltip: number;
    };
  }
}
