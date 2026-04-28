import { Clock, Moon, Sun, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function Header({ lastUpdated, darkMode, onToggleDark }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const time = lastUpdated
    ? lastUpdated.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <header className="bg-[#0890f1] shadow-md sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
            <span className="text-white font-black text-sm leading-none">GL</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-black text-white text-base sm:text-lg leading-none tracking-tight">
                getlavado
              </span>
              <span className="bg-white/25 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                B2B
              </span>
            </div>
            <div className="text-white/60 text-[9px] sm:text-[10px] font-medium tracking-widest uppercase leading-none mt-0.5">
              Control de Guías
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {time && (
            <div className="hidden sm:flex items-center gap-1.5 bg-white/15 text-white/90 text-xs font-medium px-3 py-1.5 rounded-full">
              <Clock size={11} />
              Actualizado {time}
            </div>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={onToggleDark}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 text-white/90 hover:bg-white/30 transition-all"
            aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Mobile menu button */}
          <button
            className="sm:hidden text-white/80 hover:text-white p-1"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menú"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {time && (
        <div className="sm:hidden px-4 pb-2 flex items-center gap-1.5 text-white/60 text-[10px]">
          <Clock size={10} />
          Actualizado {time}
        </div>
      )}
    </header>
  )
}
