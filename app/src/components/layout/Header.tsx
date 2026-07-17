import { useStore } from '@/store/useStore'

interface HeaderProps {
  title: string
  subtitle?: string
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { profile } = useStore()

  return (
    <header className="sticky top-0 z-20 bg-neu-100 px-6 py-3 flex items-center justify-between shadow-[0_4px_10px_-4px_rgba(163,177,198,0.6)]">
      <div>
        <h1 className="text-lg font-semibold text-clinic-600">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-300/50">
          <div className="w-8 h-8 rounded-full bg-clinic-600 flex items-center justify-center text-white text-sm font-semibold shadow-neu-sm">
            {profile?.nombres?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-700 leading-tight">
              {profile?.nombres ?? 'Usuario'}
            </p>
            <p className="text-xs text-slate-400">{profile?.perfiles?.perfil ?? ''}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
