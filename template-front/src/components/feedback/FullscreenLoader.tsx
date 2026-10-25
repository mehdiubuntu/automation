import { OrbitLoader } from '@/components/motion/OrbitLoader'

export function FullscreenLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50">
      <OrbitLoader size="md" label={label} />
    </div>
  )
}
