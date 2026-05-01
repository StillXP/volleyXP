import styled from 'styled-components';

// ─── Root ─────────────────────────────────────────────────────────────────────

export const StyledCard = styled.div`
  display: flex;
  flex-direction: column;
  width: 524px;
  border-radius: 16px;
  overflow: hidden;
  background-color: rgb(237, 235, 230);
`;

// ─── Image ────────────────────────────────────────────────────────────────────

export const StyledImageWrapper = styled.div`
  width: 100%;
  height: 261px;
  flex-shrink: 0;
`;

export const StyledImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

// ─── Body ─────────────────────────────────────────────────────────────────────

export const StyledBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[1]};
  padding: ${({ theme }) => theme.spacing[2]};
  background-color: rgb(242, 242, 242);
`;

export const StyledTitle = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  color: ${({ theme }) => theme.color.neutral[900]};
`;

export const StyledDescription = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.regular};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  color: ${({ theme }) => theme.color.neutral[700]};
`;

export const StyledTags = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.regular};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  color: ${({ theme }) => theme.color.neutral[500]};
`;
