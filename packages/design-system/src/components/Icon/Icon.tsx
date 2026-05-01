import React from 'react';
import { ICON_PATHS, type IconName } from './icons';
import { StyledIcon } from './Icon.styles';

export type { IconName };

export interface IconProps {
  /** Icon to render — must be a key of the icon registry */
  name: IconName;
  /**
   * Size of the icon. Accepts any CSS length value or a number (treated as px).
   * Defaults to `'1em'` so the icon scales with the surrounding text.
   */
  size?: number | string;
  /** Stroke color. Defaults to `'currentColor'` to inherit from parent. */
  color?: string;
  /**
   * Accessible title for the icon. When provided, the icon is treated as an
   * image (`role="img"`) with a visible label. When omitted, the icon is
   * decorative (`aria-hidden="true"`).
   */
  title?: string;
  /** Additional CSS class */
  className?: string;
}

export function Icon({
  name,
  size = '1em',
  color = 'currentColor',
  title,
  className,
}: IconProps) {
  const titleId = React.useId();
  const paths = ICON_PATHS[name];
  const sizeValue = typeof size === 'number' ? `${size}px` : size;

  const accessibilityProps = title
    ? { role: 'img' as const, 'aria-labelledby': titleId }
    : { 'aria-hidden': true as const };

  return (
    <StyledIcon
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={sizeValue}
      height={sizeValue}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...accessibilityProps}
    >
      {title && <title id={titleId}>{title}</title>}
      {paths.map((d, i) => <path key={i} d={d} />)}
    </StyledIcon>
  );
}
