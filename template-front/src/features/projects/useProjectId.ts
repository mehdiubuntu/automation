import { useParams } from 'react-router-dom'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The `:id` of the surrounding `/projects/:id/...` route (a UUID),
 * or `null` if it is malformed. Every project-scoped page reads its projectId here.
 */
export function useProjectId(): string | null {
  const { id } = useParams()
  return id && UUID.test(id) ? id : null
}
