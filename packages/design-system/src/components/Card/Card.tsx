import React from 'react';
import {
  StyledBody,
  StyledCard,
  StyledDescription,
  StyledImage,
  StyledImageWrapper,
  StyledTags,
  StyledTitle,
} from './Card.styles';

export interface CardProps {
  /** Image source URL */
  image?: string;
  /** Alt text for the image */
  imageAlt?: string;
  /** Card title */
  title: string;
  /** Supporting description text */
  description?: string;
  /** Tags shown below the description */
  tags?: string[];
  /** Additional CSS class applied to the root element */
  className?: string;
}

export function Card({ image, imageAlt = '', title, description, tags, className }: CardProps) {
  return (
    <StyledCard className={className}>
      {image && (
        <StyledImageWrapper>
          <StyledImage src={image} alt={imageAlt} />
        </StyledImageWrapper>
      )}
      <StyledBody>
        <StyledTitle>{title}</StyledTitle>
        {description && <StyledDescription>{description}</StyledDescription>}
        {tags && tags.length > 0 && (
          <StyledTags>{tags.join(' · ')}</StyledTags>
        )}
      </StyledBody>
    </StyledCard>
  );
}
