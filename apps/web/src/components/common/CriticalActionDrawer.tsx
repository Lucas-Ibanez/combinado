import type { ReactNode } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import SlideToConfirm from './SlideToConfirm'

interface CriticalActionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  disabled?: boolean
  tone?: 'danger' | 'brand'
  children?: ReactNode
}

export default function CriticalActionDrawer({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  disabled = false,
  tone = 'danger',
  children,
}: CriticalActionDrawerProps) {
  function handleConfirm() {
    onConfirm()
    setTimeout(() => onOpenChange(false), 600)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>

        {children && <div className="px-4 pb-3">{children}</div>}

        <DrawerFooter>
          <SlideToConfirm
            label={confirmLabel}
            onConfirm={handleConfirm}
            disabled={disabled}
            tone={tone}
          />

          <DrawerClose asChild>
            <button
              type="button"
              className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-surface-elevated transition-colors"
            >
              Cancelar
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
