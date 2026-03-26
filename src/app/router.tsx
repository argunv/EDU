import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'

import { AppShell } from '../components/layout/AppShell'
import { NotFoundPage } from '../components/shared/NotFoundPage'
import { RouteErrorBoundary } from '../components/shared/RouteErrorBoundary'
import { PendingGuard } from '../features/auth/PendingGuard'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'

const AuthLayout = lazy(() => import('../features/auth/AuthLayout').then((m) => ({ default: m.AuthLayout })))
const ForgotPasswordPage = lazy(() =>
  import('../features/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
)
const LoginPage = lazy(() => import('../features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() =>
  import('../features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)
const ResetPasswordPage = lazy(() =>
  import('../features/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
)
const AdminLayout = lazy(() => import('../features/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const AdminUsersPage = lazy(() =>
  import('../features/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
)
const AdminSubjectsPage = lazy(() =>
  import('../features/admin/AdminSubjectsPage').then((m) => ({ default: m.AdminSubjectsPage })),
)
const ClassesPage = lazy(() => import('../features/admin/ClassesPage').then((m) => ({ default: m.ClassesPage })))
const AdminSchedulePage = lazy(() =>
  import('../features/admin/AdminSchedulePage').then((m) => ({ default: m.AdminSchedulePage })),
)
const JournalPage = lazy(() => import('../features/admin/JournalPage').then((m) => ({ default: m.JournalPage })))
const HomeworkPage = lazy(() => import('../features/student/HomeworkPage').then((m) => ({ default: m.HomeworkPage })))
const ProgressPage = lazy(() => import('../features/student/ProgressPage').then((m) => ({ default: m.ProgressPage })))
const SchedulePage = lazy(() => import('../features/student/SchedulePage').then((m) => ({ default: m.SchedulePage })))
const LessonPage = lazy(() => import('../features/teacher/LessonPage').then((m) => ({ default: m.LessonPage })))
const TeacherJournalPage = lazy(() =>
  import('../features/teacher/TeacherJournalPage').then((m) => ({ default: m.TeacherJournalPage })),
)
const TodayPage = lazy(() => import('../features/teacher/TodayPage').then((m) => ({ default: m.TodayPage })))
const MyProfilePage = lazy(() => import('../features/profile/MyProfilePage').then((m) => ({ default: m.MyProfilePage })))

function withSuspense(element: ReactNode) {
  return (
    <Suspense fallback={<div className="px-4 py-6 text-sm text-slate-600">Загрузка страницы...</div>}>
      {element}
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/auth/login" replace /> },
      { path: 'login', element: <Navigate to="/auth/login" replace /> },
      { path: 'pending', element: <PendingGuard /> },
      {
        path: 'auth',
        element: withSuspense(<AuthLayout />),
        children: [
          { index: true, element: <Navigate to="/auth/login" replace /> },
          { path: 'login', element: withSuspense(<LoginPage />) },
          { path: 'register', element: withSuspense(<RegisterPage />) },
          { path: 'forgot-password', element: withSuspense(<ForgotPasswordPage />) },
          { path: 'reset-password', element: withSuspense(<ResetPasswordPage />) },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['teacher']} />,
        children: [
          {
            path: 'teacher/today',
            element: withSuspense(<TodayPage />),
          },
          {
            path: 'teacher/lesson/:lessonId',
            element: withSuspense(<LessonPage />),
          },
          {
            path: 'teacher/journal',
            element: withSuspense(<TeacherJournalPage />),
          },
          {
            path: 'teacher/journal/:classId',
            element: withSuspense(<TeacherJournalPage />),
          },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['student', 'parent']} />,
        children: [
          {
            path: 'me/schedule',
            element: withSuspense(<SchedulePage />),
          },
          {
            path: 'me/homework',
            element: withSuspense(<HomeworkPage />),
          },
          {
            path: 'me/progress',
            element: withSuspense(<ProgressPage />),
          },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['teacher', 'student', 'parent', 'admin']} />,
        children: [
          {
            path: 'profile',
            element: withSuspense(<MyProfilePage />),
          },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['admin']} />,
        children: [
          {
            path: 'admin',
            element: withSuspense(<AdminLayout />),
            children: [
              {
                index: true,
                element: <Navigate to="/admin/classes" replace />,
              },
              {
                path: 'classes',
                element: withSuspense(<ClassesPage />),
              },
              {
                path: 'subjects',
                element: withSuspense(<AdminSubjectsPage />),
              },
              {
                path: 'users',
                element: withSuspense(<AdminUsersPage />),
              },
              {
                path: 'schedule',
                element: withSuspense(<AdminSchedulePage />),
              },
              {
                path: 'journal/:classId/:subjectId',
                element: withSuspense(<JournalPage />),
              },
              {
                path: 'journal/:classId',
                element: withSuspense(<JournalPage />),
              },
            ],
          },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])
