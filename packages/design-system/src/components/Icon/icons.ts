/**
 * SVG path registry — paths sourced from Heroicons (MIT license)
 * https://heroicons.com
 *
 * All icons use a 24x24 viewBox with stroke-based paths.
 * Add new icons here and the type system will enforce valid names everywhere.
 */

export type IconName =
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-left'
  | 'chevron-right'
  | 'external-link'
  | 'check'
  | 'close'
  | 'search'
  | 'eye'
  | 'eye-off'
  | 'alert-circle'
  | 'info'
  | 'warning'
  | 'plus'
  | 'minus'
  | 'edit'
  | 'trash'
  | 'copy'
  | 'download'
  | 'upload'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up'
  | 'arrow-down'
  | 'more-horiz'
  | 'more-vert'
  | 'home'
  | 'user'
  | 'settings'
  | 'menu'
  | 'loading'
  | 'clock'
  | 'map-pin'
  | 'share';

/** Each entry is one or more `d` attributes for SVG `<path>` elements */
export const ICON_PATHS: Record<IconName, string[]> = {
  'chevron-down': ['M19 9l-7 7-7-7'],
  'chevron-up': ['M5 15l7-7 7 7'],
  'chevron-left': ['M15 18l-6-6 6-6'],
  'chevron-right': ['M9 18l6-6-6-6'],
  'external-link': [
    'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6m0 0v6m0-6L10 14',
  ],
  check: ['M20 6L9 17l-5-5'],
  close: ['M18 6L6 18M6 6l12 12'],
  search: ['M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'],
  eye: [
    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z',
    'M12 9a3 3 0 100 6 3 3 0 000-6z',
  ],
  'eye-off': [
    'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22',
  ],
  'alert-circle': ['M12 8v4m0 4h.01M22 12A10 10 0 1112 2a10 10 0 0110 10z'],
  info: ['M12 16v-4m0-4h.01M22 12A10 10 0 1112 2a10 10 0 0110 10z'],
  warning: [
    'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
    'M12 9v4m0 4h.01',
  ],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  edit: [
    'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7',
    'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  trash: [
    'M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6',
    'M10 11v6M14 11v6',
  ],
  copy: [
    'M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866',
    'M11.143 7.07h8c1.105 0 2 .91 2 2.036v10.857C21.143 21.09 20.248 22 19.143 22h-8c-1.105 0-2-.911-2-2.036V9.107c0-1.124.895-2.036 2-2.036z',
  ],
  download: ['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3'],
  upload: ['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12'],
  'arrow-left': ['M19 12H5M12 19l-7-7 7-7'],
  'arrow-right': ['M5 12h14M12 5l7 7-7 7'],
  'arrow-up': ['M12 19V5M5 12l7-7 7 7'],
  'arrow-down': ['M12 5v14M19 12l-7 7-7-7'],
  'more-horiz': ['M5 12h.01M12 12h.01M19 12h.01'],
  'more-vert': ['M12 5h.01M12 12h.01M12 19h.01'],
  home: [
    'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z',
    'M9 22V12h6v10',
  ],
  user: [
    'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2',
    'M12 11a4 4 0 100-8 4 4 0 000 8z',
  ],
  settings: [
    'M12 15a3 3 0 100-6 3 3 0 000 6z',
    'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  ],
  menu: ['M3 12h18M3 6h18M3 18h18'],
  loading: [
    'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
  ],
  clock: ['M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'],
  'map-pin': [
    'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z',
    'M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  ],
  share: [
    'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
  ],
};
