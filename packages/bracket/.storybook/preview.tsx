import React from 'react';
import type { Preview } from '@storybook/react';
import '@lockin/tokens/css/themes/arena';
import '@lockin/react/styles.css';

const preview: Preview = {
  globalTypes: {
    colorMode: {
      description: 'Lock In color mode',
      toolbar: {
        title: 'Color mode',
        icon: 'mirror',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    colorMode: 'light',
  },
  decorators: [
    (Story, context) => {
      const mode = context.parameters.colorMode ?? context.globals.colorMode;
      return (
        <div
          data-theme={mode}
          style={{
            background: 'var(--ds-color-background-default)',
            color: 'var(--ds-color-text-primary)',
            font: 'var(--ds-typography-body-md)',
            padding: 'var(--ds-space-md)',
          }}
        >
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
