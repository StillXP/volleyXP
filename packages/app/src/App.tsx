'use client'

import React, { useState, useCallback, useRef } from 'react'
import styled from 'styled-components'
import { Button, TextField, Dropdown, Bracket } from '@design-system/components'
import type { BracketTeam, BracketMatchData, DropdownOption } from '@design-system/components'
import { useThemeMode } from './lib/ThemeContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'team-count' | 'team-names' | 'elim-format' | 'match-format' | 'bracket'

// ─── Options ──────────────────────────────────────────────────────────────────

const ELIM_FORMAT_OPTIONS: DropdownOption<string>[] = [
  { value: 'single', label: 'Single Elimination' },
  { value: 'double', label: 'Double Elimination' },
]

const MATCH_FORMAT_OPTIONS: DropdownOption<number>[] = [
  { value: 3, label: 'Best of 3' },
  { value: 5, label: 'Best of 5' },
]

// ─── Shared wizard layout ─────────────────────────────────────────────────────

const WizardPage = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.color.neutral[100]};
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing[10]} ${({ theme }) => theme.spacing[4]};
`

const WizardCard = styled.div`
  background: ${({ theme }) => theme.color.neutral[0]};
  border: 1px solid ${({ theme }) => theme.color.neutral[200]};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  box-shadow: ${({ theme }) => theme.shadow.md};
  padding: ${({ theme }) => theme.spacing[8]};
  width: 100%;
  max-width: 540px;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[6]};
`

const StepHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`

const StepLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.color.brand.primary};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`

const StepTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.color.neutral[900]};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
`

const StepSubtitle = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.color.neutral[500]};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  margin-top: ${({ theme }) => theme.spacing[1]};
`

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[3]};
  justify-content: flex-end;
`

// ─── Step 1: Team count ───────────────────────────────────────────────────────

interface StepTeamCountProps {
  value: number
  onChange: (v: number) => void
  onNext: () => void
}

function StepTeamCount({ value, onChange, onNext }: StepTeamCountProps) {
  const [raw, setRaw] = React.useState(String(value))
  const parsed = parseInt(raw, 10)
  const isValid = !isNaN(parsed) && parsed >= 2 && parsed <= 64

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRaw(e.target.value)
    const n = parseInt(e.target.value, 10)
    if (!isNaN(n) && n >= 2 && n <= 64) onChange(n)
  }

  return (
    <WizardCard>
      <StepHeader>
        <StepLabel>Step 1 of 4</StepLabel>
        <StepTitle>How many teams?</StepTitle>
        <StepSubtitle>Enter a number between 2 and 64.</StepSubtitle>
      </StepHeader>
      <TextField
        label="Number of teams"
        type="number"
        min={2}
        max={64}
        value={raw}
        onChange={handleChange}
        errorText={raw !== '' && !isValid ? 'Must be between 2 and 64' : undefined}
      />
      <Actions>
        <Button onClick={onNext} disabled={!isValid}>Next</Button>
      </Actions>
    </WizardCard>
  )
}

// ─── Step 2: Team names ───────────────────────────────────────────────────────

const NamesGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing[3]};
  max-height: 380px;
  overflow-y: auto;
  padding-right: ${({ theme }) => theme.spacing[1]};

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => theme.color.neutral[300]} transparent;
  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.color.neutral[300]};
    border-radius: ${({ theme }) => theme.border.radius.full};
  }
`

interface StepTeamNamesProps {
  names: string[]
  onChange: (index: number, name: string) => void
  onBack: () => void
  onNext: () => void
}

function StepTeamNames({ names, onChange, onBack, onNext }: StepTeamNamesProps) {
  return (
    <WizardCard>
      <StepHeader>
        <StepLabel>Step 2 of 4</StepLabel>
        <StepTitle>Name your teams</StepTitle>
        <StepSubtitle>Defaults are pre-filled — change any you like or leave them as-is.</StepSubtitle>
      </StepHeader>
      <NamesGrid>
        {names.map((name, i) => (
          <TextField
            key={i}
            label={`Team ${i + 1}`}
            value={name}
            onChange={e => onChange(i, e.target.value)}
          />
        ))}
      </NamesGrid>
      <Actions>
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Next</Button>
      </Actions>
    </WizardCard>
  )
}

// ─── Step 3: Elimination format ───────────────────────────────────────────────

interface StepElimFormatProps {
  value: 'single' | 'double'
  onChange: (v: 'single' | 'double') => void
  onBack: () => void
  onNext: () => void
}

function StepElimFormat({ value, onChange, onBack, onNext }: StepElimFormatProps) {
  return (
    <WizardCard>
      <StepHeader>
        <StepLabel>Step 3 of 4</StepLabel>
        <StepTitle>Elimination format</StepTitle>
        <StepSubtitle>
          Single elimination: one loss ends your run. Double elimination: you get a second chance through the losers bracket.
        </StepSubtitle>
      </StepHeader>
      <Dropdown<string>
        label="Elimination format"
        options={ELIM_FORMAT_OPTIONS}
        value={value}
        onChange={v => onChange(v as 'single' | 'double')}
      />
      <Actions>
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Next</Button>
      </Actions>
    </WizardCard>
  )
}

// ─── Step 4: Match format ─────────────────────────────────────────────────────

interface StepMatchFormatProps {
  value: 3 | 5
  onChange: (v: 3 | 5) => void
  onBack: () => void
  onGenerate: () => void
}

function StepMatchFormat({ value, onChange, onBack, onGenerate }: StepMatchFormatProps) {
  return (
    <WizardCard>
      <StepHeader>
        <StepLabel>Step 4 of 4</StepLabel>
        <StepTitle>Match format</StepTitle>
        <StepSubtitle>Choose how many sets each match will be played to determine a winner.</StepSubtitle>
      </StepHeader>
      <Dropdown<number>
        label="Sets per match"
        options={MATCH_FORMAT_OPTIONS}
        value={value}
        onChange={v => onChange(v as 3 | 5)}
      />
      <Actions>
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button onClick={onGenerate}>Generate Bracket</Button>
      </Actions>
    </WizardCard>
  )
}

// ─── Bracket view ─────────────────────────────────────────────────────────────

const BracketPage = styled.div`
  height: 100vh;
  overflow: hidden;
  background: ${({ theme }) => theme.color.neutral[100]};
  display: flex;
  flex-direction: column;
`

const BracketPageHeader = styled.header`
  background: ${({ theme }) => theme.color.neutral[0]};
  border-bottom: 1px solid ${({ theme }) => theme.color.neutral[200]};
  padding: ${({ theme }) => theme.spacing[5]} ${({ theme }) => theme.spacing[8]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[4]};
  flex-shrink: 0;
`

const BracketPageTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.color.neutral[900]};
`

const BracketPageMeta = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.color.neutral[500]};
  margin-top: ${({ theme }) => theme.spacing[1]};
`

const ThemeToggle = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.color.neutral[300]};
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
  cursor: pointer;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  line-height: 1;
  color: ${({ theme }) => theme.color.neutral[700]};
  &:hover {
    border-color: ${({ theme }) => theme.color.neutral[500]};
  }
`

const BracketScroll = styled.div<{ $isDragging: boolean }>`
  flex: 1;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing[8]};
  cursor: ${({ $isDragging }) => ($isDragging ? 'grabbing' : 'grab')};
  user-select: none;

  & > * {
    pointer-events: ${({ $isDragging }) => ($isDragging ? 'none' : 'auto')};
  }
`

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { mode, toggle } = useThemeMode()
  const [step, setStep] = useState<Step>('team-count')
  const [teamCount, setTeamCount] = useState<number>(8)
  const [teamNames, setTeamNames] = useState<string[]>(() =>
    Array.from({ length: 8 }, (_, i) => `Team${i + 1}`)
  )
  const [elimFormat, setElimFormat] = useState<'single' | 'double'>('single')
  const [matchFormat, setMatchFormat] = useState<3 | 5>(3)
  const [matchData, setMatchData] = useState<BracketMatchData[]>([])
  const [isLoadingExample, setIsLoadingExample] = useState(false)

  const handleLoadExample = useCallback(async () => {
    setIsLoadingExample(true)
    try {
      const res = await fetch(
        `/api/example-tournament?teamCount=${teamCount}&elimFormat=${elimFormat}&matchFormat=${matchFormat}`
      )
      const data = await res.json() as { teams: BracketTeam[]; matchData: BracketMatchData[] }
      setTeamNames(data.teams.map(t => t.name))
      setMatchData(data.matchData)
    } finally {
      setIsLoadingExample(false)
    }
  }, [teamCount, elimFormat, matchFormat])

  const handleTeamCountChange = useCallback((count: number) => {
    setTeamCount(count)
    setTeamNames(Array.from({ length: count }, (_, i) => `Team${i + 1}`))
  }, [])

  const handleTeamNameChange = useCallback((index: number, name: string) => {
    setTeamNames(prev => {
      const next = [...prev]
      next[index] = name
      return next
    })
  }, [])

  const bracketTeams: BracketTeam[] = teamNames.map((name, i) => ({
    id: `team-${i + 1}`,
    name: name.trim() || `Team${i + 1}`,
    seed: i + 1,
  }))

  const scrollRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const dragOriginRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const el = scrollRef.current
    if (!el) return
    dragOriginRef.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const origin = dragOriginRef.current
    const el = scrollRef.current
    if (!origin || !el) return
    const dx = e.clientX - origin.x
    const dy = e.clientY - origin.y
    if (!isDraggingRef.current && Math.abs(dx) + Math.abs(dy) > 5) {
      isDraggingRef.current = true
      setIsDragging(true)
    }
    if (isDraggingRef.current) {
      el.scrollLeft = origin.scrollLeft - dx
      el.scrollTop = origin.scrollTop - dy
    }
  }, [])

  const stopDrag = useCallback(() => {
    dragOriginRef.current = null
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      setIsDragging(false)
    }
  }, [])

  if (step === 'bracket') {
    return (
      <BracketPage>
        <BracketPageHeader>
          <div>
            <BracketPageTitle>Tournament Bracket</BracketPageTitle>
            <BracketPageMeta>
              {teamCount} Teams · {elimFormat === 'double' ? 'Double' : 'Single'} Elimination · Best of {matchFormat}
            </BracketPageMeta>
          </div>
          <Button variant="secondary" onClick={handleLoadExample} disabled={isLoadingExample}>
            {isLoadingExample ? 'Loading…' : 'Load example data'}
          </Button>
          <Button variant="secondary" onClick={() => { setStep('team-count'); setMatchData([]) }}>
            Start Over
          </Button>
          <ThemeToggle onClick={toggle} aria-label="Toggle dark mode">
            {mode === 'dark' ? '☀️' : '🌙'}
          </ThemeToggle>
        </BracketPageHeader>
        <BracketScroll
          ref={scrollRef}
          $isDragging={isDragging}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
        >
          <Bracket teams={bracketTeams} eliminationFormat={elimFormat} matchData={matchData} />
        </BracketScroll>
      </BracketPage>
    )
  }

  return (
    <WizardPage style={{ position: 'relative' }}>
      <ThemeToggle
        onClick={toggle}
        aria-label="Toggle dark mode"
        style={{ position: 'absolute', top: '1rem', right: '1rem' }}
      >
        {mode === 'dark' ? '☀️' : '🌙'}
      </ThemeToggle>
      {step === 'team-count' && (
        <StepTeamCount
          value={teamCount}
          onChange={handleTeamCountChange}
          onNext={() => setStep('team-names')}
        />
      )}
      {step === 'team-names' && (
        <StepTeamNames
          names={teamNames}
          onChange={handleTeamNameChange}
          onBack={() => setStep('team-count')}
          onNext={() => setStep('elim-format')}
        />
      )}
      {step === 'elim-format' && (
        <StepElimFormat
          value={elimFormat}
          onChange={setElimFormat}
          onBack={() => setStep('team-names')}
          onNext={() => setStep('match-format')}
        />
      )}
      {step === 'match-format' && (
        <StepMatchFormat
          value={matchFormat}
          onChange={setMatchFormat}
          onBack={() => setStep('elim-format')}
          onGenerate={() => setStep('bracket')}
        />
      )}
    </WizardPage>
  )
}
