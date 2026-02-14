import { LessonRow } from './LessonRow'
import { type ScheduleItem } from '../../../types/schedule'

type DaySectionProps = {
  title: string
  items: ScheduleItem[]
}

export function DaySection({ title, items }: DaySectionProps) {
  return (
    <div className="py-2">
      <div className="text-base font-semibold text-foreground">{title}</div>
      <div className="mt-2 border-t border-border">
        {items.length === 0 ? (
          <div className="py-3 text-sm text-muted-foreground">Уроков нет</div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <LessonRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
