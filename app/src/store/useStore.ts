import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, Filtros } from '@/types'

interface AppState {
  profile: Profile | null
  setProfile: (p: Profile | null) => void

  filtros: Filtros
  setFiltros: (f: Partial<Filtros>) => void
  resetFiltros: () => void

  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

const defaultFiltros: Filtros = {
  corte: null,
  sexo: [],
  anio: null,
  mes: null,
  aseguradora: [],
  sede: [],
  especialidad: [],
  profesional: [],
  estado: [],
  largaEstancia: null,
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (p) => set({ profile: p }),

      filtros: defaultFiltros,
      setFiltros: (f) =>
        set((s) => ({ filtros: { ...s.filtros, ...f } })),
      resetFiltros: () => set({ filtros: defaultFiltros }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'bigc-store',
      partialize: (s) => ({ filtros: s.filtros, sidebarCollapsed: s.sidebarCollapsed }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<AppState>),
        filtros: { ...defaultFiltros, ...((persisted as AppState)?.filtros ?? {}) },
      }),
    }
  )
)
