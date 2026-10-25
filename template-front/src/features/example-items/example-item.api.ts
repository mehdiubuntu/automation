import { api } from '@/lib/api/client'
import type { Paginated } from '@/lib/api/types'
import type {
  CreateExampleItemInput,
  ExampleItem,
  GetExampleItemsQuery,
  UpdateExampleItemInput,
} from './example-item.types'

export const exampleItemsApi = {
  list(query: GetExampleItemsQuery) {
    return api.get<Paginated<ExampleItem>>('/example-item/get-example-items', { params: query })
  },
  get(id: string) {
    return api.get<ExampleItem>(`/example-item/get-example-item/${id}`)
  },
  create(input: CreateExampleItemInput) {
    return api.post<ExampleItem>('/example-item/create-example-item', input)
  },
  update(id: string, input: UpdateExampleItemInput) {
    return api.put<ExampleItem>(`/example-item/update-example-item/${id}`, input)
  },
  remove(id: string) {
    return api.delete<ExampleItem>(`/example-item/delete-example-item/${id}`)
  },
}
