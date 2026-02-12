import { useAuth } from '../auth/useAuth'
import { useChildSelection } from './useChildSelection'

export function ChildSelector() {
  const { user } = useAuth()
  const { childId, setChildId, children } = useChildSelection()

  if (!user || user.role !== 'parent') {
    return null
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-sm font-semibold text-slate-700">Ребёнок</div>
      <div className="mt-2 flex flex-col gap-2">
        {children.map((child) => {
          const isActive = childId === child.id
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => setChildId(child.id)}
              className={`flex h-11 items-center justify-between rounded-lg border px-3 text-sm font-semibold ${
                isActive
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            >
              <span>{child.name}</span>
              <span className={isActive ? 'text-white/80' : 'text-slate-500'}>
                {child.className}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
