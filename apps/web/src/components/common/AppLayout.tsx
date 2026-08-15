import { NavLink, Outlet } from 'react-router-dom'
import { useIncidentsRealtime } from '@/features/incidents/hooks/useIncidentsRealtime'
import EmotionalModeFrame from '@/components/common/EmotionalModeFrame'
import { Bell, Home, MessageCircle, ShieldCheck } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/alerts', label: 'Alertas', icon: Bell },
  { to: '/protection', label: 'Proteção', icon: ShieldCheck },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
]

export default function AppLayout() {
  useIncidentsRealtime()

  return (
    <EmotionalModeFrame mode="normal" className="min-h-screen flex flex-col">
      <main className="flex-1">
        <Outlet />
      </main>

      <nav className="sticky bottom-0 border-t border-border bg-surface" aria-label="Navegação principal">
        <div className="flex justify-around gap-1 px-1 py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-medium transition-colors ${
                    isActive
                      ? 'border-brand/30 bg-brand-surface text-brand-dark shadow-sm'
                      : 'border-transparent text-text-muted hover:bg-surface-elevated'
                  }`
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </EmotionalModeFrame>
  )
}
