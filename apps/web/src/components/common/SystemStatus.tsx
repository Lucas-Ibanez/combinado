import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SystemStatusTone = 'normal' | 'attention' | 'incident' | 'neutral'

const TONE_STYLES: Record<
  SystemStatusTone,
  { badge: string; notice: string; icon: string; action: string }
> = {
  normal: {
    badge: 'border-brand/30 bg-brand-surface text-brand-dark',
    notice: 'border-brand/30 bg-brand-surface text-brand-dark',
    icon: 'border-brand/25 bg-surface text-brand',
    action: 'border-brand/40 bg-surface text-brand hover:bg-brand-surface',
  },
  attention: {
    badge: 'border-attention/50 bg-attention-surface text-attention-dark',
    notice: 'border-attention/50 bg-attention-surface text-attention-dark',
    icon: 'border-attention/40 bg-surface text-attention-dark',
    action: 'border-attention/60 bg-surface text-attention-dark hover:bg-attention-surface',
  },
  incident: {
    badge: 'border-danger/50 bg-danger-surface text-danger-dark',
    notice: 'border-danger/50 bg-danger-surface text-danger-dark',
    icon: 'border-danger/40 bg-surface text-danger-dark',
    action: 'border-danger/60 bg-surface text-danger-dark hover:bg-danger-surface',
  },
  neutral: {
    badge: 'border-border bg-surface-elevated text-text-muted',
    notice: 'border-border bg-surface-muted text-text',
    icon: 'border-border bg-surface text-text-muted',
    action: 'border-border bg-surface text-text hover:bg-surface-elevated',
  },
}

interface SystemStatusBadgeProps {
  icon: LucideIcon
  label: string
  tone?: SystemStatusTone
  className?: string
}

export function SystemStatusBadge({
  icon: Icon,
  label,
  tone = 'neutral',
  className,
}: SystemStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none',
        TONE_STYLES[tone].badge,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

interface SystemStateNoticeProps {
  icon: LucideIcon
  title: string
  description?: string
  tone?: SystemStatusTone
  actionLabel?: string
  onAction?: () => void
  className?: string
  live?: 'off' | 'polite' | 'assertive'
}

export function SystemStateNotice({
  icon: Icon,
  title,
  description,
  tone = 'neutral',
  actionLabel,
  onAction,
  className,
  live = 'polite',
}: SystemStateNoticeProps) {
  const styles = TONE_STYLES[tone]

  return (
    <div
      className={cn('rounded-xl border p-3.5', styles.notice, className)}
      role={tone === 'incident' || live === 'assertive' ? 'alert' : 'status'}
      aria-live={live}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
            styles.icon,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          {description && <p className="mt-0.5 text-xs leading-relaxed">{description}</p>}
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className={cn(
                'mt-3 inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-semibold transition-colors',
                styles.action,
              )}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
