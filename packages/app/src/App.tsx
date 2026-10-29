'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import styled from 'styled-components'
import { Button, InputField, RadioGroup } from '@lockin/react'
import type { RadioOption } from '@lockin/react'
import { cssVars } from '@lockin/tokens'
import { Bracket } from '@volley/bracket'
import type { BracketTeam, BracketMatchData } from '@volley/bracket'
import { useDocumentTitle } from './lib/useDocumentTitle'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'team-count' | 'elim-format' | 'match-format' | 'bracket'

// ─── Options ──────────────────────────────────────────────────────────────────

const ELIM_FORMAT_OPTIONS: RadioOption[] = [
  { value: 'single', label: 'Single Elimination', description: 'One loss ends your run.' },
  { value: 'double', label: 'Double Elimination', description: 'A second chance through the losers bracket.' },
]

const MATCH_FORMAT_OPTIONS: RadioOption[] = [
  { value: '3', label: 'Best of 3' },
  { value: '5', label: 'Best of 5' },
]

// ─── Shared wizard layout ─────────────────────────────────────────────────────

const WizardPage = styled.div`
  min-height: 100vh;
  background: ${cssVars.color.background.subtle};
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: ${cssVars.space['2xl']} ${cssVars.space.md};
`

const WizardCard = styled.div`
  background: ${cssVars.color.surface.default};
  border: ${cssVars.border.width.thin} solid ${cssVars.color.border.subtle};
  border-radius: ${cssVars.radius.xl};
  box-shadow: ${cssVars.shadow.md};
  padding: ${cssVars.space.xl};
  width: 100%;
  max-width: 540px;
  display: flex;
  flex-direction: column;
  gap: ${cssVars.space.lg};
`

const StepHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${cssVars.space.xs};
`

const StepLabel = styled.span`
  font: ${cssVars.typography.overline};
  letter-spacing: var(--ds-typography-overline-letter-spacing);
  color: ${cssVars.color.text.brand};
  text-transform: uppercase;
`

const StepTitle = styled.h1`
  font: ${cssVars.typography.heading.md};
  letter-spacing: var(--ds-typography-heading-md-letter-spacing);
  color: ${cssVars.color.text.primary};
`

const StepSubtitle = styled.p`
  font: ${cssVars.typography.body.sm};
  color: ${cssVars.color.text.secondary};
  margin-top: ${cssVars.space['2xs']};
`

const Actions = styled.div`
  display: flex;
  gap: ${cssVars.space.sm};
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
  const [showError, setShowError] = React.useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const parsed = parseInt(raw, 10)
  const isValid = !isNaN(parsed) && parsed >= 2 && parsed <= 64

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRaw(e.target.value)
    const n = parseInt(e.target.value, 10)
    if (!isNaN(n) && n >= 2 && n <= 64) onChange(n)
  }

  // Validate on blur / submit rather than every keystroke, and keep Next enabled
  // so the error explains what to fix (Lock In form guidance).
  function handleNext() {
    if (isValid) {
      onNext()
    } else {
      setShowError(true)
      inputRef.current?.focus()
    }
  }

  return (
    <WizardCard>
      <StepHeader>
        <StepLabel>Step 1 of 3</StepLabel>
        <StepTitle>How many teams?</StepTitle>
      </StepHeader>
      <InputField
        ref={inputRef}
        label="Number of teams"
        hint="Enter a number between 2 and 64."
        type="number"
        inputMode="numeric"
        min={2}
        max={64}
        required
        value={raw}
        onChange={handleChange}
        onBlur={() => setShowError(true)}
        error={showError && !isValid ? 'Enter a number from 2 to 64' : undefined}
      />
      <Actions>
        <Button onClick={handleNext}>Next</Button>
      </Actions>
    </WizardCard>
  )
}

// ─── Step 2: Elimination format ───────────────────────────────────────────────

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
        <StepLabel>Step 2 of 3</StepLabel>
        <StepTitle>Elimination format</StepTitle>
      </StepHeader>
      <RadioGroup
        legend="Elimination format"
        hideLegend
        options={ELIM_FORMAT_OPTIONS}
        value={value}
        onValueChange={v => onChange(v as 'single' | 'double')}
      />
      <Actions>
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Next</Button>
      </Actions>
    </WizardCard>
  )
}

// ─── Step 3: Match format ─────────────────────────────────────────────────────

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
        <StepLabel>Step 3 of 3</StepLabel>
        <StepTitle>Match format</StepTitle>
        <StepSubtitle>Choose how many sets each match will be played to determine a winner.</StepSubtitle>
      </StepHeader>
      <RadioGroup
        legend="Sets per match"
        hideLegend
        options={MATCH_FORMAT_OPTIONS}
        value={String(value)}
        onValueChange={v => onChange(Number(v) as 3 | 5)}
      />
      <Actions>
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button onClick={onGenerate}>Generate bracket</Button>
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

const ZoomControls = styled.div`
  position: fixed;
  bottom: ${cssVars.space.lg};
  right: ${cssVars.space.lg};
  display: flex;
  gap: ${cssVars.space.xs};
  align-items: center;
  z-index: 10;
`

const BracketPage = styled.div`
  height: 100vh;
  overflow: hidden;
  background: ${cssVars.color.background.subtle};
  display: flex;
  flex-direction: column;
`

const BracketPageHeader = styled.header`
  background: ${cssVars.color.surface.default};
  border-bottom: ${cssVars.border.width.thin} solid ${cssVars.color.border.subtle};
  padding: ${cssVars.space.md} ${cssVars.space.xl};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${cssVars.space.md};
  flex-shrink: 0;
`

const BracketPageTitle = styled.h1`
  font: ${cssVars.typography.heading.xs};
  color: ${cssVars.color.text.primary};
`

const BracketPageMeta = styled.p`
  font: ${cssVars.typography.body.sm};
  color: ${cssVars.color.text.secondary};
  margin-top: ${cssVars.space['2xs']};
`

const HeaderActions = styled.div`
  display: flex;
  gap: ${cssVars.space.xs};
  flex-shrink: 0;
`

const BracketScroll = styled.div<{ $isDragging: boolean }>`
  flex: 1;
  overflow: auto;
  padding: ${cssVars.space.xl};
  cursor: ${({ $isDragging }) => ($isDragging ? 'grabbing' : 'grab')};
  user-select: none;
  touch-action: pan-x pan-y;

  & > * {
    pointer-events: ${({ $isDragging }) => ($isDragging ? 'none' : 'auto')};
  }
`

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [step, setStep] = useState<Step>('team-count')
  useDocumentTitle('Bracket generator')
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
          <HeaderActions>
            <Button variant="secondary" onClick={handleLoadExample} loading={isLoadingExample} loadingLabel="Loading example data">
              Load example data
            </Button>
            <Button variant="secondary" onClick={() => { setStep('team-count'); setMatchData([]); setZoom(getDefaultZoom()) }}>
              Start over
            </Button>
          </HeaderActions>
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
          <Button variant="secondary" size="sm" iconOnly iconStart="plus" onClick={handleZoomIn} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in" />
          <Button variant="secondary" size="sm" iconOnly iconStart="minus" onClick={handleZoomOut} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out" />
          <Button variant="secondary" size="sm" onClick={handleZoomReset} disabled={zoom === 1}>
            Reset
          </Button>
        </ZoomControls>
      </BracketPage>
    )
  }

  return (
    <WizardPage>
      {step === 'team-count' && (
        <StepTeamCount
          value={teamCount}
          onChange={handleTeamCountChange}
          onNext={() => setStep('elim-format')}
        />
      )}
      {step === 'elim-format' && (
        <StepElimFormat
          value={elimFormat}
          onChange={setElimFormat}
          onBack={() => setStep('team-count')}
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
