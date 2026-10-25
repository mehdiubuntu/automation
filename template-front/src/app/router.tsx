import { lazy } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { RedirectIfAuthenticated, RequireAuth, RequireRole } from '@/features/auth/guards'
import { PanelLayout } from './layouts/PanelLayout'

// Route-level code splitting: every page is a separate chunk, so the initial
// bundle only carries the shell + login.
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const VerifyEmailPage = lazy(() => import('@/features/auth/VerifyEmailPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const AccountPage = lazy(() => import('@/features/account/AccountPage'))
const UsersPage = lazy(() => import('@/features/users/UsersPage'))
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage'))
const ProjectDetailPage = lazy(() => import('@/features/projects/ProjectDetailPage'))
const ExampleItemsPage = lazy(() => import('@/features/example-items/ExampleItemsPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const ForbiddenPage = lazy(() => import('./pages/ForbiddenPage'))

export const router = createBrowserRouter([
  // Public. Login/register bounce a signed-in user to the app; the OTP and
  // password-reset screens stay reachable either way.
  {
    element: <RedirectIfAuthenticated />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },

  // Everything else requires a session.
  {
    element: <RequireAuth />,
    children: [
      {
        element: <PanelLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'account', element: <AccountPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'projects', element: <ProjectsPage /> },
          {
            path: 'projects/:id',
            element: <ProjectDetailPage />,
            children: [
              { index: true, element: <Navigate to="items" replace /> },
              { path: 'items', element: <ExampleItemsPage /> },
            ],
          },
          {
            path: 'users',
            element: (
              <RequireRole roles={['SUPERADMIN']}>
                <UsersPage />
              </RequireRole>
            ),
          },
        ],
      },
    ],
  },
  { path: '/403', element: <ForbiddenPage /> },
  { path: '*', element: <NotFoundPage /> },
])
