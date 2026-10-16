import * as React from 'react'
import { cn } from '@/lib/utils'

export type EmotionalMode = 'normal' | 'incident'

interface EmotionalModeFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  mode: EmotionalMode
}

export default function EmotionalModeFrame({
  mode,
  className,
  ...props
}: EmotionalModeFrameProps) {
  return (
    <div
      data-emotional-mode={mode}
      className={cn(
        'emotional-mode',
        mode === 'incident'
          ? 'emotional-mode-incident'
          : 'emotional-mode-normal',
        className,
      )}
      {...props}
    />
  )
}
