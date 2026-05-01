import React from 'react';
import {
  StyledAddon,
  StyledErrorText,
  StyledHelperText,
  StyledInput,
  StyledInputWrapper,
  StyledLabel,
  StyledWrapper,
} from './TextField.styles';

export type TextFieldSize = 'sm' | 'md' | 'lg';

export interface TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Label text — always required for accessibility */
  label: string;
  /** Helper text shown below the input */
  helperText?: string;
  /** Error message — when provided the input enters error state */
  errorText?: string;
  /** Element rendered inside the input on the left (e.g. an icon) */
  leadingAddon?: React.ReactNode;
  /** Element rendered inside the input on the right (e.g. a clear button) */
  trailingAddon?: React.ReactNode;
  /** Size of the input */
  size?: TextFieldSize;
  /** Visually hides the label while keeping it available to screen readers */
  hideLabel?: boolean;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      helperText,
      errorText,
      leadingAddon,
      trailingAddon,
      size = 'md',
      hideLabel = false,
      id: idProp,
      className,
      disabled,
      ...inputProps
    },
    ref
  ) => {
    const generatedId = React.useId();
    const id = idProp ?? generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const hasError = Boolean(errorText);

    const describedBy =
      [hasError ? errorId : null, helperText ? helperId : null]
        .filter(Boolean)
        .join(' ') || undefined;

    return (
      <StyledWrapper className={className}>
        <StyledLabel htmlFor={id} $hidden={hideLabel}>
          {label}
        </StyledLabel>

        <StyledInputWrapper $size={size} $error={hasError} $disabled={Boolean(disabled)}>
          {leadingAddon && (
            <StyledAddon aria-hidden="true">{leadingAddon}</StyledAddon>
          )}

          <StyledInput
            ref={ref}
            id={id}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            {...inputProps}
          />

          {trailingAddon && (
            <StyledAddon aria-hidden="true">{trailingAddon}</StyledAddon>
          )}
        </StyledInputWrapper>

        {helperText && !hasError && (
          <StyledHelperText id={helperId}>{helperText}</StyledHelperText>
        )}

        {hasError && (
          <StyledErrorText id={errorId} role="alert">
            {errorText}
          </StyledErrorText>
        )}
      </StyledWrapper>
    );
  }
);

TextField.displayName = 'TextField';
