import React from 'react';
import {
  StyledButton,
  StyledContent,
  StyledIconSlot,
  StyledSpinner,
  StyledSpinnerIcon,
} from './Button.styles';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'submit';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style of the button */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Shows a loading spinner and disables interaction */
  loading?: boolean;
  /** Element rendered before button label */
  iconLeft?: React.ReactNode;
  /** Element rendered after button label */
  iconRight?: React.ReactNode;
  /** Stretches the button to fill its container */
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      iconLeft,
      iconRight,
      fullWidth = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <StyledButton
        ref={ref}
        $variant={variant}
        $size={size}
        $loading={loading}
        $fullWidth={fullWidth}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <StyledSpinner aria-hidden="true">
            <StyledSpinnerIcon
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="25 13"
              />
            </StyledSpinnerIcon>
          </StyledSpinner>
        )}
        <StyledContent>
          {iconLeft && <StyledIconSlot>{iconLeft}</StyledIconSlot>}
          {children}
          {iconRight && <StyledIconSlot>{iconRight}</StyledIconSlot>}
        </StyledContent>
      </StyledButton>
    );
  }
);

Button.displayName = 'Button';
