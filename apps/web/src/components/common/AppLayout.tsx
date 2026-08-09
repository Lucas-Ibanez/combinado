import { NavLink, Outlet } from 'react-router-dom'
import { useIncidentsRealtime } from '@/features/incidents/hooks/useIncidentsRealtime'

const navItems = [
  { to: '/', label: 'Início' },
  { to: '/alerts', label: 'Alertas' },
  { to: '/protection', label: 'Proteção' },
  { to: '/chat', label: 'Chat' },
]

export default function AppLayout() {
  useIncidentsRealtime()

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <main className="flex-1">
        <Outlet />
      </main>

      <nav className="border-t border-border bg-surface sticky bottom-0">
        <div className="flex justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 text-center py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-brand border-t-2 border-brand'
                    : 'text-text-muted'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
