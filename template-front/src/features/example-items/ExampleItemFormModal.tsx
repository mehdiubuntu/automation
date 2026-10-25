import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { useCreateExampleItem, useUpdateExampleItem } from './example-item.hooks'
import type { ExampleItem } from './example-item.types'

/**
 * Create/edit modal. Form state is seeded from `item` on mount, so the parent
 * gives this component a fresh `key` every time it opens (see ExampleItemsPage).
 * `projectId` is passed down from the route and sent in the create body.
 */
export function ExampleItemFormModal({
  open,
  onClose,
  projectId,
  item,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  item?: ExampleItem
}) {
  const isEdit = Boolean(item)
  const create = useCreateExampleItem()
  const update = useUpdateExampleItem(item?.id ?? '')

  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [active, setActive] = useState(item?.isActive ?? true)

  const pending = create.isPending || update.isPending

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending) return
    // Drop empty optional strings so we don't send "" to validators.
    const input = { name: name.trim(), isActive: active, ...(description.trim() ? { description: description.trim() } : {}) }
    try {
      if (isEdit) {
        await update.mutateAsync(input)
      } else {
        await create.mutateAsync({ projectId, ...input })
      }
      onClose()
    } catch {
      // The hook's onError already toasted; keep the modal open for another try.
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit item' : 'New item'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="name" required>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="description">
          <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Active</span>
          <Switch checked={active} onChange={setActive} ariaLabel="Active" />
        </div>

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
