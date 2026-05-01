import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  * {
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 100%;
    -webkit-text-size-adjust: 100%;
    tab-size: 4;
    overflow-x: hidden;
  }

  body {
    overflow-x: hidden;
    font-family: ${({ theme }) => theme.typography.fontFamily.sans};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    line-height: ${({ theme }) => theme.typography.lineHeight.normal};
    color: ${({ theme }) => theme.color.neutral[900]};
    background-color: ${({ theme }) => theme.color.neutral[0]};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  *:focus {
    outline: none;
  }

  *:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.brand.primary};
    outline-offset: 2px;
  }

  img,
  picture,
  video,
  canvas,
  svg {
    display: block;
    max-width: 100%;
  }

  input,
  button,
  textarea,
  select {
    font: inherit;
  }

  ul[role='list'],
  ol[role='list'] {
    list-style: none;
  }

  h1, h2, h3, h4, h5, h6 {
    overflow-wrap: break-word;
  }

  :root {
    --color-brand-primary: ${({ theme }) => theme.color.brand.primary};
    --color-brand-secondary: ${({ theme }) => theme.color.brand.secondary};
    --color-neutral-0: ${({ theme }) => theme.color.neutral[0]};
    --color-neutral-100: ${({ theme }) => theme.color.neutral[100]};
    --color-neutral-200: ${({ theme }) => theme.color.neutral[200]};
    --color-neutral-300: ${({ theme }) => theme.color.neutral[300]};
    --color-neutral-500: ${({ theme }) => theme.color.neutral[500]};
    --color-neutral-700: ${({ theme }) => theme.color.neutral[700]};
    --color-neutral-900: ${({ theme }) => theme.color.neutral[900]};
    --color-semantic-error: ${({ theme }) => theme.color.semantic.error};
    --color-semantic-success: ${({ theme }) => theme.color.semantic.success};
    --color-semantic-warning: ${({ theme }) => theme.color.semantic.warning};
    --color-semantic-info: ${({ theme }) => theme.color.semantic.info};
  }
`;
