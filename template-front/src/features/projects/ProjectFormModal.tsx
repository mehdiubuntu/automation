import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { useCreateProject, useUpdateProject } from './project.hooks'
import type { Project } from './project.types'

/**
 * Create/edit modal (SUPERADMIN only; the page decides who can open it). Seeded
 * from `project` on mount, so the page re-keys it on every open. `code` can be
 * chosen on create but is immutable afterwards.
 */
export function ProjectFormModal({
  open,
  onClose,
  project,
}: {
  open: boolean
  onClose: () => void
  project?: Project
}) {
  const isEdit = Boolean(project)
  const create = useCreateProject()
  const update = useUpdateProject(project?.id ?? '')

  const [name, setName] = useState(project?.name ?? '')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState(project?.description ?? '')
  const [active, setActive] = useState(project?.isActive ?? true)

  const pending = create.isPending || update.isPending

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending) return
    try {
      if (isEdit) {
        await update.mutateAsync({ name: name.trim(), description: description.trim(), isActive: active })
      } else {
        // Drop empty optionals so we never send "" to the validators.
        await create.mutateAsync({
          name: name.trim(),
          ...(code.trim() ? { code: code.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
        })
      }
      onClose()
    } catch {
      // The hook's onError already toasted; keep the modal open for another try.
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit project' : 'New project'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="project-name" required>
          <Input id="project-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {isEdit ? (
          <Field label="Code" htmlFor="project-code">
            <Input id="project-code" value={project?.code ?? ''} disabled readOnly />
          </Field>
        ) : (
          <Field label="Code (optional)" htmlFor="project-code">
            <Input
              id="project-code"
              placeholder="Generated if left empty"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
        )}
        <Field label="Description" htmlFor="project-description">
          <Input id="project-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {isEdit && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Active</span>
            <Switch checked={active} onChange={setActive} ariaLabel="Active" />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
