'use client'

import styled from 'styled-components'
import Link from 'next/link'
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import { Button, Icon } from '@design-system/components'

// ── Nav ────────────────────────────────────────────────────────────────────────

const Nav = styled.nav`
  position: sticky;
  top: 0;
  z-index: ${({ theme }) => theme.zIndex.sticky};
  background: ${({ theme }) => theme.color.neutral[0]};
  border-bottom: 1px solid ${({ theme }) => theme.color.neutral[200]};
  padding: 0 ${({ theme }) => theme.spacing[8]};
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const Logo = styled(Link)`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.color.brand.primary};
  text-decoration: none;
  letter-spacing: -0.02em;
`

const NavActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
`

// ── Hero ───────────────────────────────────────────────────────────────────────

const HeroSection = styled.section`
  background: linear-gradient(
    160deg,
    ${({ theme }) => theme.color.neutral[0]} 30%,
    ${({ theme }) => theme.color.blue[0]} 100%
  );
  padding: ${({ theme }) => theme.spacing[16]} ${({ theme }) => theme.spacing[8]};
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[6]};
`

const HeroBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[3]};
  background: ${({ theme }) => theme.color.blue[100]};
  color: ${({ theme }) => theme.color.brand.primary};
  border-radius: ${({ theme }) => theme.border.radius.full};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
`

const HeroTitle = styled.h1`
  font-size: 3.5rem;
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.color.neutral[900]};
  line-height: 1.1;
  letter-spacing: -0.03em;
  max-width: 720px;

  @media (max-width: 640px) {
    font-size: 2.25rem;
  }
`

const Accent = styled.span`
  color: ${({ theme }) => theme.color.brand.primary};
`

const HeroSubtitle = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  color: ${({ theme }) => theme.color.neutral[500]};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  max-width: 480px;
`

const HeroActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  flex-wrap: wrap;
  justify-content: center;
  margin-top: ${({ theme }) => theme.spacing[2]};
`

// ── Features ───────────────────────────────────────────────────────────────────

const FeaturesWrapper = styled.div`
  background: ${({ theme }) => theme.color.neutral[100]};
`

const FeaturesSection = styled.section`
  max-width: 1100px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing[16]} ${({ theme }) => theme.spacing[8]};
`

const SectionTag = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.color.brand.primary};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing[2]};
`

const SectionTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.color.neutral[900]};
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing[3]};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
`

const SectionSubtitle = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  color: ${({ theme }) => theme.color.neutral[500]};
  text-align: center;
  max-width: 480px;
  margin: 0 auto ${({ theme }) => theme.spacing[10]};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
`

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.spacing[6]};

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    max-width: 480px;
    margin: 0 auto;
  }
`

const FeatureCard = styled.div`
  background: ${({ theme }) => theme.color.neutral[0]};
  border: 1px solid ${({ theme }) => theme.color.neutral[200]};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  padding: ${({ theme }) => theme.spacing[6]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
  transition: box-shadow ${({ theme }) => theme.transition.duration.normal}
    ${({ theme }) => theme.transition.easing.default};

  &:hover {
    box-shadow: ${({ theme }) => theme.shadow.md};
  }
`

const FeatureIconWrap = styled.div`
  width: 44px;
  height: 44px;
  border-radius: ${({ theme }) => theme.border.radius.lg};
  background: ${({ theme }) => theme.color.blue[100]};
  color: ${({ theme }) => theme.color.brand.primary};
  display: flex;
  align-items: center;
  justify-content: center;
`

const FeatureName = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.color.neutral[900]};
`

const FeatureDesc = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.color.neutral[500]};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
`

// ── CTA ────────────────────────────────────────────────────────────────────────

const CTASection = styled.section`
  background: ${({ theme }) => theme.color.neutral[900]};
  padding: ${({ theme }) => theme.spacing[16]} ${({ theme }) => theme.spacing[8]};
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[6]};
`

const CTATitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: #ffffff;
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  max-width: 520px;
  letter-spacing: -0.02em;
`

const CTASubtitle = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  color: ${({ theme }) => theme.color.neutral[500]};
  max-width: 380px;
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
`

// ── Footer ─────────────────────────────────────────────────────────────────────

const Footer = styled.footer`
  background: ${({ theme }) => theme.color.neutral[900]};
  border-top: 1px solid ${({ theme }) => theme.color.neutral[800]};
  padding: ${({ theme }) => theme.spacing[6]} ${({ theme }) => theme.spacing[8]};
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const FooterBrand = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.color.brand.primary};
  letter-spacing: -0.01em;
`

const FooterText = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.color.neutral[500]};
`

// ── Data ───────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: 'plus' as const,
    name: 'Instant Brackets',
    desc: 'Generate single or double elimination brackets for up to 32 teams in seconds. No setup required.',
  },
  {
    icon: 'clock' as const,
    name: 'Live Score Tracking',
    desc: 'Update match scores in real time and watch the bracket populate automatically as matches finish.',
  },
  {
    icon: 'settings' as const,
    name: 'Flexible Formats',
    desc: 'Single or double elimination, best of 3 or best of 5 — choose the format that fits your competition.',
  },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <Nav>
        <Logo href="/">Volley</Logo>
        <NavActions>
          <Show when="signed-in">
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm">Dashboard</Button>
            </Link>
            <UserButton />
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">Sign In</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm">Get Started</Button>
            </SignUpButton>
          </Show>
        </NavActions>
      </Nav>

      <HeroSection>
        <HeroBadge>
          <Icon name="check" size={14} />
          Tournament Management Platform
        </HeroBadge>
        <HeroTitle>
          Run your tournaments,<br />
          not <Accent>spreadsheets.</Accent>
        </HeroTitle>
        <HeroSubtitle>
          Create brackets, track live scores, and manage teams — all in one place.
        </HeroSubtitle>
        <HeroActions>
          <Show when="signed-out">
            <SignUpButton mode="modal">
              <Button size="lg" iconRight={<Icon name="arrow-right" size={18} />}>
                Get Started Free
              </Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <Button size="lg" iconRight={<Icon name="arrow-right" size={18} />}>
                Go to Dashboard
              </Button>
            </Link>
          </Show>
          <Link href="/create" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="lg">Try a Demo</Button>
          </Link>
        </HeroActions>
      </HeroSection>

      <FeaturesWrapper>
        <FeaturesSection>
          <SectionTag>Features</SectionTag>
          <SectionTitle>Everything you need to run a great tournament</SectionTitle>
          <SectionSubtitle>
            From seeding to final score, Volley handles the logistics so you can focus on the competition.
          </SectionSubtitle>
          <FeaturesGrid>
            {FEATURES.map(f => (
              <FeatureCard key={f.name}>
                <FeatureIconWrap>
                  <Icon name={f.icon} size={22} />
                </FeatureIconWrap>
                <FeatureName>{f.name}</FeatureName>
                <FeatureDesc>{f.desc}</FeatureDesc>
              </FeatureCard>
            ))}
          </FeaturesGrid>
        </FeaturesSection>
      </FeaturesWrapper>

      <CTASection>
        <CTATitle>Ready to run your first tournament?</CTATitle>
        <CTASubtitle>
          Get started in minutes. No spreadsheets, no manual seeding.
        </CTASubtitle>
        <Show when="signed-out">
          <SignUpButton mode="modal">
            <Button size="lg" iconRight={<Icon name="arrow-right" size={18} />}>
              Create Tournament
            </Button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <Button size="lg" iconRight={<Icon name="arrow-right" size={18} />}>
              Go to Dashboard
            </Button>
          </Link>
        </Show>
      </CTASection>

      <Footer>
        <FooterBrand>Volley</FooterBrand>
        <FooterText>© 2026 Volley. Built for competitors.</FooterText>
      </Footer>
    </>
  )
}
