import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Eye, EyeOff, Pencil, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import {
  changeMyPassword,
  deleteMyAvatar,
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
} from '../../api/profile'
import { getMyProgress } from '../../api/me'
import { PageHeader } from '../../components/layout/PageHeader'
import { StateWrapper } from '../../components/shared/StateWrapper'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { useAuth } from '../auth/useAuth'
import { useChildSelection } from '../student/useChildSelection'
import type { SubjectProgress } from '../../types/progress'
import type { Profile } from '../../types/profile'
import { getAverageFromGrades } from '../../lib/progressAverage'
import { getApiErrorMessage } from '../../lib/errors'
import { ROLE_HOME } from '../../lib/roleHome'
import { useHeaderBack } from '../../contexts/useHeaderBack'
import { AvatarUploadDialog } from './AvatarUploadDialog'
import { ChildSelector } from '../student/ChildSelector'
import {
  formatDateTime,
  formatProfileDate,
  getCurrentSemester,
  getCurrentYearStart,
  getProfileValue,
  ROLE_LABELS,
} from './profileUtils'

export function MyProfilePage() {
  const { user, updateUser, logout } = useAuth()
  const { childId, children, isChildrenLoading } = useChildSelection()
  const navigate = useNavigate()
  const headerBack = useHeaderBack()
  const queryClient = useQueryClient()

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editBirthDate, setEditBirthDate] = useState('')
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['me', 'profile'],
    queryFn: getMyProfile,
  })

  const isStudentOrParent = user?.role === 'student' || user?.role === 'parent'
  const progressChildId = user?.role === 'parent' ? childId : undefined
  const yearStart = useMemo(() => getCurrentYearStart(), [])
  const semester = useMemo(() => getCurrentSemester(), [])

  const progressEnabled =
    isStudentOrParent &&
    (user?.role === 'student' ||
      (user?.role === 'parent' && Boolean(childId) && children.length > 0))

  const {
    data: progressData = [],
    isLoading: isProgressLoading,
    isError: isProgressError,
    refetch: refetchProgress,
  } = useQuery<SubjectProgress[]>({
    queryKey: ['me', 'profile', 'average', progressChildId, yearStart, semester],
    queryFn: () => getMyProgress(progressChildId, yearStart, semester),
    enabled: progressEnabled,
  })

  const overallAverage = useMemo(() => {
    if (!isStudentOrParent || !progressData.length) return null
    const allGrades = progressData.flatMap((item) => item.grades)
    return getAverageFromGrades(allGrades)
  }, [progressData, isStudentOrParent])

  const applyProfileUpdate = useCallback(
    (updated: Profile) => {
      updateUser({ name: updated.name })
      queryClient.setQueryData(['me', 'profile'], updated)
    },
    [queryClient, updateUser],
  )

  const updateMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (updated) => {
      applyProfileUpdate(updated)
      setIsEditing(false)
      toast.success('Профиль сохранён')
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Не удалось сохранить профиль'))
    },
  })

  const avatarUploadMutation = useMutation({
    mutationFn: uploadMyAvatar,
    onSuccess: (updated) => {
      applyProfileUpdate(updated)
      toast.success('Фото профиля обновлено')
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Не удалось загрузить фото'))
    },
  })

  const avatarDeleteMutation = useMutation({
    mutationFn: deleteMyAvatar,
    onSuccess: (updated) => {
      applyProfileUpdate(updated)
      toast.success('Фото профиля удалено')
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Не удалось удалить фото'))
    },
  })

  const passwordMutation = useMutation({
    mutationFn: changeMyPassword,
    onSuccess: async () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Пароль изменён. Все сессии завершены — войдите снова.')
      await logout()
      navigate('/auth/login', { replace: true })
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'Не удалось изменить пароль'))
    },
  })

  const handleBack = useCallback(() => {
    if (window.history.length > 2) {
      navigate(-1)
      return
    }
    const role = user?.role
    if (role) {
      navigate(ROLE_HOME[role], { replace: true })
      return
    }
    navigate('/', { replace: true })
  }, [navigate, user])

  useEffect(() => {
    if (!headerBack) return
    headerBack.setBack(handleBack)
    return () => {
      headerBack.clearBack()
    }
  }, [headerBack, handleBack])

  const averageDisplay = !isStudentOrParent
    ? '—'
    : user?.role === 'parent' && isChildrenLoading
      ? '…'
      : user?.role === 'parent' && children.length === 0
        ? 'Нет привязанных детей'
        : user?.role === 'parent' && !childId
          ? 'Выберите ребёнка ниже'
          : overallAverage !== null
            ? overallAverage.toString()
            : 'Нет данных'

  const displayName = profile?.name ?? user?.name ?? 'Не указано'
  const roleLabel = profile?.role ? ROLE_LABELS[profile.role] ?? profile.role : ''

  const startEdit = () => {
    if (!profile) return
    setEditName(profile.name)
    setEditPhone(profile.phone ?? '')
    setEditBirthDate(profile.birthDate ?? '')
    setIsEditing(true)
  }

  const cancelEdit = () => {
    if (profile) {
      setEditName(profile.name)
      setEditPhone(profile.phone ?? '')
      setEditBirthDate(profile.birthDate ?? '')
    }
    setIsEditing(false)
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    const name = editName.trim()
    if (!name) {
      toast.error('Укажите имя')
      return
    }
    updateMutation.mutate({
      name,
      phone: editPhone.trim(),
      birthDate: editBirthDate.trim() || null,
    })
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error('Новый пароль должен быть не короче 8 символов')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают')
      return
    }
    passwordMutation.mutate({ currentPassword, newPassword })
  }

  const avatarBusy = avatarUploadMutation.isPending || avatarDeleteMutation.isPending

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <PageHeader title="Мой профиль" subtitle={roleLabel || undefined} />

      <StateWrapper
        isLoading={isProfileLoading}
        isError={isProfileError}
        isEmpty={false}
        onRetry={refetchProfile}
      >
        {profile ? (
          <>
            <ProfileHero
              name={displayName}
              roleLabel={roleLabel}
              avatarUrl={profile.avatarUrl}
              onAvatarClick={() => setAvatarDialogOpen(true)}
            />

            {user?.role === 'parent' ? (
              <ChildSelector title="Ребёнок для просмотра успеваемости" />
            ) : null}

            {isStudentOrParent ? (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Средний балл
                </h2>
                <StateWrapper
                  isLoading={isProgressLoading && progressEnabled}
                  isError={isProgressError}
                  isEmpty={false}
                  onRetry={refetchProgress}
                >
                  <div className="rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
                    <div className="text-4xl font-semibold text-foreground">{averageDisplay}</div>
                    {user?.role === 'parent' && childId ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        За текущий семестр выбранного ребёнка
                      </p>
                    ) : null}
                  </div>
                </StateWrapper>
              </section>
            ) : null}

            <RoleSpecificSection profile={profile} />

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Личные данные
                </h2>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={startEdit}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    Изменить
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground hover:bg-accent"
                  >
                    <X className="h-4 w-4" aria-hidden />
                    Отмена
                  </button>
                )}
              </div>

              {isEditing ? (
                <form
                  onSubmit={handleSaveProfile}
                  className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <Field label="ФИО">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground"
                      disabled={updateMutation.isPending}
                    />
                  </Field>
                  <Field label="Телефон">
                    <input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      type="tel"
                      inputMode="tel"
                      placeholder="+7..."
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground"
                      disabled={updateMutation.isPending}
                    />
                  </Field>
                  <Field label="Дата рождения">
                    <input
                      value={editBirthDate}
                      onChange={(e) => setEditBirthDate(e.target.value)}
                      type="date"
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground"
                      disabled={updateMutation.isPending}
                    />
                  </Field>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Сохранение…' : 'Сохранить'}
                  </button>
                </form>
              ) : (
                <div className="space-y-1 rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <ProfileRow label="Email" value={getProfileValue(profile.email)} />
                  <ProfileRow label="Телефон" value={getProfileValue(profile.phone)} />
                  <ProfileRow
                    label="Дата рождения"
                    value={formatProfileDate(profile.birthDate)}
                  />
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Безопасность
              </h2>
              <form
                onSubmit={handleChangePassword}
                className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <p className="text-sm text-muted-foreground">
                  После смены пароля все активные сессии на всех устройствах будут завершены.
                </p>
                <Field label="Текущий пароль">
                  <PasswordInput
                    value={currentPassword}
                    onChange={setCurrentPassword}
                    show={showCurrentPassword}
                    onToggle={() => setShowCurrentPassword((v) => !v)}
                    autoComplete="current-password"
                    disabled={passwordMutation.isPending}
                  />
                </Field>
                <Field label="Новый пароль">
                  <PasswordInput
                    value={newPassword}
                    onChange={setNewPassword}
                    show={showNewPassword}
                    onToggle={() => setShowNewPassword((v) => !v)}
                    autoComplete="new-password"
                    disabled={passwordMutation.isPending}
                  />
                </Field>
                <Field label="Подтверждение пароля">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground"
                    disabled={passwordMutation.isPending}
                  />
                </Field>
                <button
                  type="submit"
                  disabled={
                    passwordMutation.isPending ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                  className="h-11 w-full rounded-lg border border-border bg-background text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50"
                >
                  {passwordMutation.isPending ? 'Сохранение…' : 'Изменить пароль'}
                </button>
              </form>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Аккаунт
              </h2>
              <div className="space-y-1 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <ProfileRow
                  label="Дата регистрации"
                  value={formatDateTime(profile.createdAt)}
                />
                <ProfileRow
                  label="Последний вход"
                  value={formatDateTime(profile.lastLoginAt)}
                />
              </div>
            </section>

            <AvatarUploadDialog
              open={avatarDialogOpen}
              onClose={() => setAvatarDialogOpen(false)}
              hasAvatar={Boolean(profile.avatarUrl)}
              isBusy={avatarBusy}
              onUpload={async (file) => {
                const updated = await avatarUploadMutation.mutateAsync(file)
                applyProfileUpdate(updated)
              }}
              onDelete={
                profile.avatarUrl
                  ? async () => {
                      const updated = await avatarDeleteMutation.mutateAsync()
                      applyProfileUpdate(updated)
                    }
                  : undefined
              }
            />
          </>
        ) : null}
      </StateWrapper>
    </div>
  )
}

function ProfileHero({
  name,
  roleLabel,
  avatarUrl,
  onAvatarClick,
}: {
  name: string
  roleLabel: string
  avatarUrl?: string
  onAvatarClick: () => void
}) {
  return (
    <section className="flex items-center gap-4">
      <button
        type="button"
        onClick={onAvatarClick}
        className="group relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Изменить фото профиля"
      >
        <UserAvatar name={name} avatarUrl={avatarUrl} size="lg" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="h-6 w-6 text-white" aria-hidden />
        </span>
      </button>
      <div className="min-w-0">
        <div className="truncate text-xl font-semibold text-foreground">{name}</div>
        {roleLabel ? (
          <div className="mt-0.5 text-sm text-muted-foreground">{roleLabel}</div>
        ) : null}
      </div>
    </section>
  )
}

function RoleSpecificSection({ profile }: { profile: Profile }) {
  if (profile.role === 'student') {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Учёба
        </h2>
        <div className="space-y-1 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <ProfileRow label="Класс" value={getProfileValue(profile.className)} />
          <ProfileRow
            label="Родители"
            value={
              profile.parentNames?.length
                ? profile.parentNames.join(', ')
                : 'Не указано'
            }
          />
        </div>
      </section>
    )
  }

  if (profile.role === 'teacher') {
    const assignments = profile.assignments ?? []
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Нагрузка
        </h2>
        {assignments.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Нет назначенных классов и предметов. Обратитесь к администратору.
          </div>
        ) : (
          <ul className="space-y-2">
            {assignments.map((item, index) => (
              <li
                key={`${item.className}-${item.subjectName}-${index}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
              >
                <span className="font-medium text-foreground">{item.subjectName}</span>
                <span className="text-sm text-muted-foreground">{item.className}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  }

  if (profile.role === 'admin') {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Администрирование
        </h2>
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Вы управляете пользователями, классами, предметами, расписанием и журналом через
          соответствующие разделы приложения.
        </div>
      </section>
    )
  }

  return null
}

type ProfileRowProps = {
  label: string
  value: string
}

function ProfileRow({ label, value }: ProfileRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="flex-1 text-right text-base font-medium text-foreground">{value}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function PasswordInput({
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  autoComplete: string
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        className="h-11 w-full rounded-lg border border-input bg-background px-3 pr-10 text-base text-foreground"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}
