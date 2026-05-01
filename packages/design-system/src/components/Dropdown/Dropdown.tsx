import React from 'react';
import {
  StyledCheckmark,
  StyledChevron,
  StyledContainer,
  StyledErrorText,
  StyledLabel,
  StyledList,
  StyledOption,
  StyledTrigger,
  StyledTriggerLabel,
  StyledWrapper,
} from './Dropdown.styles';

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export type DropdownSize = 'sm' | 'md' | 'lg';

export interface DropdownProps<T = string> {
  /** Available options */
  options: DropdownOption<T>[];
  /** Controlled selected value */
  value?: T;
  /** Uncontrolled default value */
  defaultValue?: T;
  /** Callback when the selection changes */
  onChange?: (value: T, option: DropdownOption<T>) => void;
  /** Placeholder shown when no value is selected */
  placeholder?: string;
  /** Disables the entire dropdown */
  disabled?: boolean;
  /** Label text — recommended for accessibility */
  label?: string | undefined;
  /** Error message */
  errorText?: string;
  /** Size of the trigger */
  size?: DropdownSize;
  /** Additional class applied to the root element */
  className?: string;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  open: boolean;
  highlightedIndex: number;
}

type Action =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'HIGHLIGHT_NEXT'; count: number }
  | { type: 'HIGHLIGHT_PREV'; count: number }
  | { type: 'HIGHLIGHT_INDEX'; index: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'OPEN':
      return { ...state, open: true };
    case 'CLOSE':
      return { ...state, open: false };
    case 'HIGHLIGHT_NEXT':
      return {
        ...state,
        highlightedIndex: (state.highlightedIndex + 1) % action.count,
      };
    case 'HIGHLIGHT_PREV':
      return {
        ...state,
        highlightedIndex:
          (state.highlightedIndex - 1 + action.count) % action.count,
      };
    case 'HIGHLIGHT_INDEX':
      return { ...state, highlightedIndex: action.index };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Dropdown<T = string>({
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  label,
  errorText,
  size = 'md',
  className,
}: DropdownProps<T>) {
  const [internalValue, setInternalValue] = React.useState<T | undefined>(
    defaultValue
  );

  const isControlled = controlledValue !== undefined;
  const selectedValue = isControlled ? controlledValue : internalValue;
  const selectedOption = options.find((o) => o.value === selectedValue);

  const [state, dispatch] = React.useReducer(reducer, {
    open: false,
    highlightedIndex: 0,
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const triggerId = React.useId();
  const listId = `${triggerId}-list`;
  const labelId = label ? `${triggerId}-label` : undefined;
  const errorId = errorText ? `${triggerId}-error` : undefined;

  // Close on outside click
  React.useEffect(() => {
    if (!state.open) return;

    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        dispatch({ type: 'CLOSE' });
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [state.open]);

  // Scroll highlighted option into view
  React.useEffect(() => {
    if (!state.open || !listRef.current) return;
    const highlighted = listRef.current.children[
      state.highlightedIndex
    ] as HTMLElement | undefined;
    highlighted?.scrollIntoView({ block: 'nearest' });
  }, [state.highlightedIndex, state.open]);

  function handleTriggerClick() {
    if (disabled) return;
    if (state.open) {
      dispatch({ type: 'CLOSE' });
    } else {
      const initialIndex = selectedOption ? options.indexOf(selectedOption) : 0;
      dispatch({ type: 'HIGHLIGHT_INDEX', index: Math.max(0, initialIndex) });
      dispatch({ type: 'OPEN' });
    }
  }

  function handleSelect(option: DropdownOption<T>) {
    if (option.disabled) return;
    if (!isControlled) setInternalValue(option.value);
    onChange?.(option.value, option);
    dispatch({ type: 'CLOSE' });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const enabledCount = options.filter((o) => !o.disabled).length;
    if (enabledCount === 0) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!state.open) {
          dispatch({ type: 'OPEN' });
        } else {
          const option = options[state.highlightedIndex];
          if (option) handleSelect(option);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!state.open) {
          dispatch({ type: 'OPEN' });
        } else {
          dispatch({ type: 'HIGHLIGHT_NEXT', count: options.length });
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        dispatch({ type: 'HIGHLIGHT_PREV', count: options.length });
        break;
      case 'Escape':
      case 'Tab':
        dispatch({ type: 'CLOSE' });
        break;
    }
  }

  return (
    <StyledWrapper className={className}>
      {label && (
        <StyledLabel id={labelId}>{label}</StyledLabel>
      )}

      <StyledContainer ref={containerRef}>
        <StyledTrigger
          id={triggerId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={state.open}
          aria-controls={listId}
          aria-labelledby={labelId}
          aria-describedby={errorId}
          aria-invalid={errorText ? true : undefined}
          disabled={disabled}
          $size={size}
          $open={state.open}
          $error={Boolean(errorText)}
          $placeholder={!selectedOption}
          onClick={handleTriggerClick}
          onKeyDown={handleKeyDown}
        >
          <StyledTriggerLabel $placeholder={!selectedOption}>
            {selectedOption ? selectedOption.label : placeholder}
          </StyledTriggerLabel>
          <StyledChevron $open={state.open} aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </StyledChevron>
        </StyledTrigger>

        {state.open && (
          <StyledList
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={labelId ?? triggerId}
          >
            {options.map((option, index) => (
              <StyledOption
                key={String(option.value)}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={option.value === selectedValue}
                aria-disabled={option.disabled}
                $selected={option.value === selectedValue}
                $highlighted={index === state.highlightedIndex}
                $disabled={Boolean(option.disabled)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option)}
                onMouseEnter={() =>
                  dispatch({ type: 'HIGHLIGHT_INDEX', index })
                }
              >
                {option.label}
                {option.value === selectedValue && (
                  <StyledCheckmark aria-hidden="true">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </StyledCheckmark>
                )}
              </StyledOption>
            ))}
          </StyledList>
        )}
      </StyledContainer>

      {errorText && (
        <StyledErrorText id={errorId} role="alert">
          {errorText}
        </StyledErrorText>
      )}
    </StyledWrapper>
  );
}
