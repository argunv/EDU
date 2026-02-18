import { Navigate, createBrowserRouter } from 'react-router-dom'

import { AppShell } from '../components/layout/AppShell'
import { AuthLayout } from '../features/auth/AuthLayout'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { PendingGuard } from '../features/auth/PendingGuard'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { AdminLayout } from '../features/admin/AdminLayout'
import { AdminUsersPage } from '../features/admin/AdminUsersPage'
import { AdminSubjectsPage } from '../features/admin/AdminSubjectsPage'
import { ClassesPage } from '../features/admin/ClassesPage'
import { AdminSchedulePage } from '../features/admin/AdminSchedulePage'
import { JournalPage } from '../features/admin/JournalPage'
import { HomeworkPage } from '../features/student/HomeworkPage'
import { ProgressPage } from '../features/student/ProgressPage'
import { SchedulePage } from '../features/student/SchedulePage'
import { LessonPage } from '../features/teacher/LessonPage'
import { TeacherJournalPage } from '../features/teacher/TeacherJournalPage'
import { TodayPage } from '../features/teacher/TodayPage'
import { MyProfilePage } from '../features/profile/MyProfilePage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/auth/login" replace /> },
      { path: 'login', element: <Navigate to="/auth/login" replace /> },
      { path: 'pending', element: <PendingGuard /> },
      {
        path: 'auth',
        element: <AuthLayout />,
        children: [
          { index: true, element: <Navigate to="/auth/login" replace /> },
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['teacher']} />,
        children: [
          {
            path: 'teacher/today',
            element: <TodayPage />,
          },
          {
            path: 'teacher/lesson/:lessonId',
            element: <LessonPage />,
          },
          {
            path: 'teacher/journal',
            element: <TeacherJournalPage />,
          },
          {
            path: 'teacher/journal/:classId',
            element: <TeacherJournalPage />,
          },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['student', 'parent']} />,
        children: [
          {
            path: 'me/schedule',
            element: <SchedulePage />,
          },
          {
            path: 'me/homework',
            element: <HomeworkPage />,
          },
          {
            path: 'me/progress',
            element: <ProgressPage />,
          },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['teacher', 'student', 'parent', 'admin']} />,
        children: [
          {
            path: 'profile',
            element: <MyProfilePage />,
          },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['admin']} />,
        children: [
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="/admin/classes" replace />,
              },
              {
                path: 'classes',
                element: <ClassesPage />,
              },
              {
                path: 'subjects',
                element: <AdminSubjectsPage />,
              },
              {
                path: 'users',
                element: <AdminUsersPage />,
              },
              {
                path: 'schedule',
                element: <AdminSchedulePage />,
              },
              {
                path: 'journal/:classId/:subjectId',
                element: <JournalPage />,
              },
              {
                path: 'journal/:classId',
                element: <JournalPage />,
              },
            ],
          },
        ],
      },
    ],
  },
])
