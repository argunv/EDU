import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { getTeacherLessons, submitGrades } from '../../api/teacher'
import { PageHeader } from '../../components/layout/PageHeader'
import type { Lesson } from '../../types/lesson'

function LessonEditor({
  lesson,
  lessonId,
}: {
  lesson: Lesson
  lessonId: string
}) {
  const queryClient = useQueryClient()
  const [topic, setTopic] = useState(() => lesson.topic ?? '')
  const [homework, setHomework] = useState(() => lesson.homeworkText ?? '')

  const isDirty = useMemo(() => {
    const topicDirty = topic !== (lesson.topic ?? '')
    const homeworkDirty = homework !== (lesson.homeworkText ?? '')
    return topicDirty || homeworkDirty
  }, [topic, homework, lesson.topic, lesson.homeworkText])

  const saveMutation = useMutation({
    mutationFn: submitGrades,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'lessons'] })
      toast.success('Сохранено')
    },
    onError: () => {
      toast.error('Ошибка сохранения')
    },
  })

  const handleSave = () => {
    saveMutation.mutate({
      lessonId,
      entries: [],
      topic: topic.trim() || null,
      homeworkText: homework.trim() || null,
    })
  }

  return (
    <>
      <div className="grid gap-3">
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Тема урока (опционально)"
          className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base"
        />
        <input
          value={homework}
          onChange={(event) => setHomework(event.target.value)}
          placeholder="Домашнее задание (опционально)"
          className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base"
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto w-full max-w-2xl">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending || !isDirty}
            className="h-12 w-full rounded-lg bg-slate-900 text-base font-semibold text-white disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Сохранение…' : isDirty ? 'Сохранить' : 'Сохранено'}
          </button>
        </div>
      </div>
    </>
  )
}

export function LessonPage() {
  const { lessonId } = useParams()
  const [searchParams] = useSearchParams()

  const dayIndexParam = searchParams.get('dayIndex')
  const weekOffsetParam = searchParams.get('weekOffset')
  const parsedDayIndex = dayIndexParam ? Number(dayIndexParam) : 0
  const parsedWeekOffset = weekOffsetParam ? Number(weekOffsetParam) : 0
  const dayIndex = parsedDayIndex >= 0 && parsedDayIndex <= 6 ? parsedDayIndex : 0
  const weekOffset =
    parsedWeekOffset === -1 || parsedWeekOffset === 1 ? parsedWeekOffset : 0

  const lessonsQuery = useQuery({
    queryKey: ['teacher', 'lessons', weekOffset, dayIndex],
    queryFn: () => getTeacherLessons({ weekOffset, dayIndex }),
  })

  const lesson = useMemo(
    () => lessonsQuery.data?.find((item) => item.id === lessonId),
    [lessonsQuery.data, lessonId],
  )

  if (lessonsQuery.isLoading) {
    return <div className="p-5 text-sm text-slate-600">Загрузка урока…</div>
  }

  if (lessonsQuery.isError || !lesson || !lessonId) {
    return (
      <div className="p-5 text-sm text-rose-700">
        Не удалось открыть урок. Попробуйте позже.
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-24 pt-6">
      <PageHeader
        title={lesson.subject}
        subtitle={`Класс ${lesson.className} • ${lesson.time}`}
        backTo="/teacher/today"
      />

      <LessonEditor key={lesson.id} lesson={lesson} lessonId={lessonId} />
    </div>
  )
}
