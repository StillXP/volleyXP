'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
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

const ZOOM_MIN = 0.25
const ZOOM_MAX = 2
const ZOOM_STEP = 0.25

function getDefaultZoom(): number {
  if (typeof window === 'undefined') return 1
  if (window.innerWidth < 480) return 0.5
  if (window.innerWidth < 768) return 0.65
  return 1
}

const ZoomOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
    <line x1="7" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="16.5" y1="16.5" x2="22" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const ZoomInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
    <line x1="7" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="11" y1="7" x2="11" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="16.5" y1="16.5" x2="22" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const ZoomControls = styled.div`
  position: fixed;
  bottom: ${({ theme }) => theme.spacing[6]};
  right: ${({ theme }) => theme.spacing[6]};
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
  align-items: center;
  z-index: 10;
`

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
  touch-action: pan-x pan-y;

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
  const [zoom, setZoom] = useState(1)

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

  const animZoomRafRef = useRef<number | null>(null)

  const smoothZoomTo = useCallback((targetZoom: number) => {
    if (animZoomRafRef.current !== null) cancelAnimationFrame(animZoomRafRef.current)
    const startZoom = zoomRef.current
    const start = performance.now()
    const DURATION = 180

    // Anchor zoom to the visible center of the scroll container
    const el = scrollRef.current
    const zoomEl = bracketZoomRef.current
    let contentX = 0, contentY = 0, localCx = 0, localCy = 0, padL = 0, padT = 0
    if (el) {
      ;({ padL, padT } = scrollPadRef.current)
      localCx = el.clientWidth / 2
      localCy = el.clientHeight / 2
      contentX = (el.scrollLeft + localCx - padL) / startZoom
      contentY = (el.scrollTop  + localCy - padT) / startZoom
    }

    const tick = (now: number) => {
      const t = Math.min((now - start) / DURATION, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const z = startZoom + (targetZoom - startZoom) * eased
      zoomRef.current = z
      if (zoomEl) zoomEl.style.zoom = String(z)
      if (el) {
        el.scrollLeft = padL + contentX * z - localCx
        el.scrollTop  = padT + contentY * z - localCy
      }
      if (t < 1) {
        animZoomRafRef.current = requestAnimationFrame(tick)
      } else {
        zoomRef.current = targetZoom
        if (zoomEl) zoomEl.style.zoom = String(targetZoom)
        setZoom(targetZoom)
        animZoomRafRef.current = null
      }
    }
    animZoomRafRef.current = requestAnimationFrame(tick)
  }, [])

  const handleZoomIn = useCallback(() => smoothZoomTo(Math.min(ZOOM_MAX, parseFloat((zoomRef.current + ZOOM_STEP).toFixed(2)))), [smoothZoomTo])
  const handleZoomOut = useCallback(() => smoothZoomTo(Math.max(ZOOM_MIN, parseFloat((zoomRef.current - ZOOM_STEP).toFixed(2)))), [smoothZoomTo])
  const handleZoomReset = useCallback(() => smoothZoomTo(getDefaultZoom()), [smoothZoomTo])

  const handleGenerateBracket = useCallback(() => {
    setZoom(getDefaultZoom())
    setStep('bracket')
  }, [])

  const bracketTeams = useMemo<BracketTeam[]>(
    () => teamNames.map((name, i) => ({
      id: `team-${i + 1}`,
      name: name.trim() || `Team${i + 1}`,
      seed: i + 1,
    })),
    [teamNames]
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollPadRef = useRef<{ padL: number; padT: number }>({ padL: 0, padT: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const dragOriginRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null)

  const zoomRef = useRef(zoom)
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  const bracketZoomRef = useRef<HTMLDivElement>(null)
  const pinchStartDistRef = useRef<number | null>(null)
  const pinchStartZoomRef = useRef<number>(1)

  useEffect(() => {
    if (step !== 'bracket') return
    const el = scrollRef.current
    if (!el) return

    const { paddingLeft, paddingTop } = getComputedStyle(el)
    const padL = parseFloat(paddingLeft)
    const padT = parseFloat(paddingTop)
    scrollPadRef.current = { padL, padT }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      if (animZoomRafRef.current !== null) { cancelAnimationFrame(animZoomRafRef.current); animZoomRafRef.current = null }
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy)
      pinchStartZoomRef.current = zoomRef.current
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || pinchStartDistRef.current === null) return
      e.preventDefault()

      const t0 = e.touches[0]
      const t1 = e.touches[1]

      const dx = t0.clientX - t1.clientX
      const dy = t0.clientY - t1.clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN,
        pinchStartZoomRef.current * (dist / pinchStartDistRef.current)
      ))

      // Pinch midpoint relative to the scroll container's top-left
      const rect = el.getBoundingClientRect()
      const localCx = (t0.clientX + t1.clientX) / 2 - rect.left
      const localCy = (t0.clientY + t1.clientY) / 2 - rect.top

      // Content coordinates under the pinch at the current zoom
      const contentX = (el.scrollLeft + localCx - padL) / zoomRef.current
      const contentY = (el.scrollTop  + localCy - padT) / zoomRef.current

      // Apply zoom then re-anchor scroll so the pinch point stays fixed
      zoomRef.current = newZoom
      if (bracketZoomRef.current) bracketZoomRef.current.style.zoom = String(newZoom)
      el.scrollLeft = padL + contentX * newZoom - localCx
      el.scrollTop  = padT + contentY * newZoom - localCy
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartDistRef.current = null
        const rounded = parseFloat(zoomRef.current.toFixed(2))
        zoomRef.current = rounded
        if (bracketZoomRef.current) bracketZoomRef.current.style.zoom = String(rounded)
        setZoom(rounded)
      }
    }

    let wheelCommitTimer: ReturnType<typeof setTimeout> | null = null

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      if (animZoomRafRef.current !== null) { cancelAnimationFrame(animZoomRafRef.current); animZoomRafRef.current = null }
      // Normalise deltaY to pixels across deltaMode values
      const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomRef.current * Math.pow(0.999, delta)))

      // Zoom toward the cursor position
      const rect = el.getBoundingClientRect()
      const localCx = e.clientX - rect.left
      const localCy = e.clientY - rect.top
      const contentX = (el.scrollLeft + localCx - padL) / zoomRef.current
      const contentY = (el.scrollTop  + localCy - padT) / zoomRef.current

      zoomRef.current = newZoom
      if (bracketZoomRef.current) bracketZoomRef.current.style.zoom = String(newZoom)
      el.scrollLeft = padL + contentX * newZoom - localCx
      el.scrollTop  = padT + contentY * newZoom - localCy

      // Commit to React state after the gesture settles
      if (wheelCommitTimer) clearTimeout(wheelCommitTimer)
      wheelCommitTimer = setTimeout(() => {
        const rounded = parseFloat(zoomRef.current.toFixed(2))
        zoomRef.current = rounded
        if (bracketZoomRef.current) bracketZoomRef.current.style.zoom = String(rounded)
        setZoom(rounded)
      }, 150)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('wheel', onWheel)
      if (wheelCommitTimer) clearTimeout(wheelCommitTimer)
    }
  }, [step])

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
          <Button variant="secondary" onClick={() => { setStep('team-count'); setMatchData([]); setZoom(getDefaultZoom()) }}>
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
          <div ref={bracketZoomRef} style={{ zoom }}>
            <Bracket teams={bracketTeams} eliminationFormat={elimFormat} matchData={matchData} />
          </div>
        </BracketScroll>
        <ZoomControls>
          <Button variant="secondary" size="sm" onClick={handleZoomIn} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in">
            <ZoomInIcon />
          </Button>
          <Button variant="secondary" size="sm" onClick={handleZoomOut} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out">
            <ZoomOutIcon />
          </Button>
          <Button variant="secondary" size="sm" onClick={handleZoomReset} disabled={zoom === 1}>
            Reset
          </Button>
        </ZoomControls>
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
          onGenerate={handleGenerateBracket}
        />
      )}
    </WizardPage>
  )
}
