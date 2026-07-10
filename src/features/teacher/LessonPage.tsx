import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { getLessonStudents, getTeacherLessons, submitGrades } from '../../api/teacher'
import { PageHeader } from '../../components/layout/PageHeader'
import { StudentRow } from '../../components/shared/StudentRow'
import type { Attendance, Grade, Lesson, LessonStudent } from '../../types/lesson'

function LessonEditor({
  lesson,
  lessonId,
  students,
}: {
  lesson: Lesson
  lessonId: string
  students: LessonStudent[]
}) {
  const queryClient = useQueryClient()
  const [topic, setTopic] = useState(() => lesson.topic ?? '')
  const [homework, setHomework] = useState(() => lesson.homeworkText ?? '')
  const [drafts, setDrafts] = useState(() => students)
  const [saved, setSaved] = useState(() => ({
    topic: lesson.topic ?? '',
    homework: lesson.homeworkText ?? '',
    students,
  }))

  const isDirty = useMemo(() => {
    const entriesDirty = drafts.some((draft, index) => {
      const previous = saved.students[index]
      return (
        !previous ||
        previous.studentId !== draft.studentId ||
        previous.attendance !== draft.attendance ||
        previous.grade !== draft.grade
      )
    })
    return (
      topic !== saved.topic ||
      homework !== saved.homework ||
      drafts.length !== saved.students.length ||
      entriesDirty
    )
  }, [drafts, homework, saved, topic])

  const saveMutation = useMutation({
    mutationFn: submitGrades,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'lessons'] })
      queryClient.invalidateQueries({ queryKey: ['teacher', 'lesson-students', lessonId] })
      setSaved({
        topic,
        homework,
        students: drafts.map((student) => ({ ...student })),
      })
      toast.success('Сохранено')
    },
    onError: () => {
      toast.error('Ошибка сохранения')
    },
  })

  const handleSave = () => {
    saveMutation.mutate({
      lessonId,
      entries: drafts,
      topic: topic.trim() || null,
      homeworkText: homework.trim() || null,
    })
  }

  const updateStudent = (
    studentId: string,
    patch: { attendance?: Attendance; grade?: Grade },
  ) => {
    setDrafts((current) =>
      current.map((student) =>
        student.studentId === studentId ? { ...student, ...patch } : student,
      ),
    )
  }

  return (
    <>
      <div className="grid gap-3">
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Тема урока (опционально)"
          aria-label="Тема урока"
          className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground"
        />
        <input
          value={homework}
          onChange={(event) => setHomework(event.target.value)}
          placeholder="Домашнее задание (опционально)"
          aria-label="Домашнее задание"
          className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground"
        />
      </div>

      <section className="grid gap-3" aria-labelledby="lesson-students-title">
        <h2 id="lesson-students-title" className="text-lg font-semibold text-foreground">
          Ученики
        </h2>
        {drafts.length ? (
          drafts.map((student) => (
            <StudentRow
              key={student.studentId}
              name={student.name}
              attendance={student.attendance}
              grade={student.grade}
              onAttendanceChange={(attendance) =>
                updateStudent(student.studentId, { attendance })
              }
              onGradeChange={(grade) => updateStudent(student.studentId, { grade })}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">В классе нет учеников.</p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending || !isDirty}
            className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-50"
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
  const { refetch, isError, isLoading, data: lessons } = lessonsQuery

  const lesson = useMemo(
    () => lessons?.find((item) => item.id === lessonId),
    [lessons, lessonId],
  )
  const studentsQuery = useQuery({
    queryKey: ['teacher', 'lesson-students', lessonId],
    queryFn: () => getLessonStudents(lessonId ?? ''),
    enabled: Boolean(lessonId && lesson),
  })

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
        <div className="h-8 w-2/3 max-w-xs animate-pulse rounded-lg bg-slate-200" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="h-12 w-full animate-pulse rounded-lg bg-slate-100" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6">
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Не удалось загрузить уроки. Проверьте соединение и попробуйте снова.
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="h-11 rounded-lg bg-slate-900 text-sm font-semibold text-white"
        >
          Повторить
        </button>
        <Link to="/teacher/today" className="text-sm font-medium text-slate-600 underline">
          К сегодняшним урокам
        </Link>
      </div>
    )
  }

  if (!lessonId || !lesson) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6 text-sm text-slate-700">
        <p>Урок не найден в выбранном дне. Возможно, расписание изменилось или ссылка устарела.</p>
        <Link to="/teacher/today" className="font-medium text-slate-900 underline">
          К сегодняшним урокам
        </Link>
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

      {studentsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка учеников...</p>
      ) : studentsQuery.isError ? (
        <div className="grid gap-3">
          <p className="text-sm text-destructive">Не удалось загрузить список учеников.</p>
          <button
            type="button"
            onClick={() => void studentsQuery.refetch()}
            className="h-11 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
          >
            Повторить
          </button>
        </div>
      ) : (
        <LessonEditor
          key={lesson.id}
          lesson={lesson}
          lessonId={lessonId}
          students={studentsQuery.data ?? []}
        />
      )}
    </div>
  )
}
