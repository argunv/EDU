export type ApprovedRole = 'teacher' | 'student' | 'parent' | 'admin'

export type Role = ApprovedRole | 'pending' | 'rejected'

export type User = {
  id: string
  name: string
  role: Role
  email?: string
  /** Название класса для ученика (например "1A") */
  className?: string
  /** ФИО привязанных родителей для ученика */
  parentNames?: string[]
}

/** Расширенная модель для админ-списка: дата регистрации, привязки (класс/дети). */
export type AdminUser = User & {
  createdAt: string
  classId?: string
  childIds?: string[]
  classIds?: string[]
  subjectIds?: string[]
}
