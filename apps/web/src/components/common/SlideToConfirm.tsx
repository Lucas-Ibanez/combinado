import { useRef, useState, useCallback, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SlideToConfirmProps {
  onConfirm: () => void
  label: string
  icon?: ReactNode
  disabled?: boolean
  tone?: 'danger' | 'brand'
  className?: string
}

const THRESHOLD = 0.85

export default function SlideToConfirm({
  onConfirm,
  label,
  icon,
  disabled = false,
  tone = 'danger',
  className,
}: SlideToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const startX = useRef(0)
  const trackWidth = useRef(0)

  const thumbSize = 52

  const begin = useCallback(
    (clientX: number) => {
      if (disabled || confirmed) return
      const track = trackRef.current
      if (!track) return
      trackWidth.current = track.getBoundingClientRect().width - thumbSize
      startX.current = clientX
      setDragging(true)
    },
    [disabled, confirmed],
  )

  const move = useCallback(
    (clientX: number) => {
      if (!dragging) return
      const delta = clientX - startX.current
      const pct = Math.min(Math.max(delta / trackWidth.current, 0), 1)
      setProgress(pct)
    },
    [dragging],
  )

  const end = useCallback(() => {
    if (!dragging) return
    setDragging(false)
    if (progress >= THRESHOLD) {
      setConfirmed(true)
      setProgress(1)
      onConfirm()
    } else {
      setProgress(0)
    }
  }, [dragging, progress, onConfirm])

  const toneClasses = {
    danger: {
      track: 'bg-danger/10 border-danger/30',
      thumb: 'bg-danger text-danger-foreground',
      label: 'text-danger-dark',
      fill: 'bg-danger/20',
    },
    brand: {
      track: 'bg-brand-surface border-brand/30',
      thumb: 'bg-brand text-brand-foreground',
      label: 'text-brand-dark',
      fill: 'bg-brand/20',
    },
  }

  const t = toneClasses[tone]

  return (
    <div
      ref={trackRef}
      className={cn(
        'relative h-14 rounded-xl border select-none overflow-hidden',
        t.track,
        disabled && 'opacity-50 pointer-events-none',
        className,
      )}
      onMouseDown={(e) => begin(e.clientX)}
      onMouseMove={(e) => move(e.clientX)}
      onMouseUp={end}
      onMouseLeave={() => { if (dragging) end() }}
      onTouchStart={(e) => begin(e.touches[0]!.clientX)}
      onTouchMove={(e) => move(e.touches[0]!.clientX)}
      onTouchEnd={end}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (!disabled && !confirmed) {
            setConfirmed(true)
            setProgress(1)
            onConfirm()
          }
        }
      }}
    >
      <div
        className={cn('absolute inset-y-0 left-0 transition-all rounded-xl', t.fill)}
        style={{
          width: `${progress * 100}%`,
          transition: dragging ? 'none' : 'width 0.3s ease-out',
        }}
      />

      <div className={cn(
        'absolute inset-0 flex items-center justify-center text-sm font-medium pointer-events-none',
        t.label,
      )}>
        {confirmed ? 'Confirmado!' : label}
      </div>

      <div
        className={cn(
          'absolute top-1 bottom-1 left-1 flex items-center justify-center rounded-lg shadow-md',
          t.thumb,
        )}
        style={{
          width: thumbSize - 8,
          transform: `translateX(${progress * trackWidth.current}px)`,
          transition: dragging ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {icon ?? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  )
}
