import { Link } from 'react-router-dom'

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-gray-50 text-center">
      <h1 className="text-4xl font-bold text-gray-900">403</h1>
      <p className="text-gray-500">Your role does not have access to this page.</p>
      <Link to="/" className="text-brand-600 hover:underline">
        Go home
      </Link>
    </div>
  )
}
