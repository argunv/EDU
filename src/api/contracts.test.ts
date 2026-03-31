import { describe, expect, it } from 'vitest'

import {
  mapAdminClass,
  mapAdminScheduleSlot,
  mapAdminSchoolSettings,
  mapAdminSubject,
} from './contracts'

describe('api contracts mappers', () => {
  it('Given raw admin class When mapped Then converts snake_case and nullables', () => {
    const mapped = mapAdminClass({
      id: 'c1',
      name: '5A',
      year_start: 2024,
      grade: 5,
      letter: 'А',
      shift: 'morning',
      shift_locked: true,
      max_lessons_per_week: null,
      archived: false,
    })

    expect(mapped.yearStart).toBe(2024)
    expect(mapped.shiftLocked).toBe(true)
    expect(mapped.maxLessonsPerWeek).toBeUndefined()
  })

  it('Given raw schedule slot When mapped Then preserves business fields', () => {
    const mapped = mapAdminScheduleSlot({
      id: 'slot-1',
      day_label: 'Понедельник',
      lesson_number: 2,
      time: '09:00',
      class_id: 'c1',
      class_name: '5A',
      shift: 'morning',
      subject_id: 's1',
      subject_name: 'Математика',
      teacher_id: null,
      teacher_name: 'Иванов',
      room: null,
      note: null,
      is_cancelled: null,
    })

    expect(mapped.dayLabel).toBe('Понедельник')
    expect(mapped.lessonNumber).toBe(2)
    expect(mapped.teacherId).toBeUndefined()
  })

  it('Given raw subject and school settings When mapped Then exposes frontend naming', () => {
    const subject = mapAdminSubject({
      id: 's1',
      name: 'Физика',
      teachers: [],
      teacher_id: null,
      teacher_name: null,
    })
    const settings = mapAdminSchoolSettings({
      is_two_shift: true,
      class_shift_rules: { c1: 'evening' },
    })

    expect(subject.teacherName).toBeNull()
    expect(settings.isTwoShift).toBe(true)
    expect(settings.classShiftRules?.c1).toBe('evening')
  })
})
