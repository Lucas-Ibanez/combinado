import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Painel' },
  { to: '/incidents', label: 'Incidentes' },
  { to: '/simulations', label: 'Simulações' },
  { to: '/settings', label: 'Config' },
]

export default function AppLayout() {
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
