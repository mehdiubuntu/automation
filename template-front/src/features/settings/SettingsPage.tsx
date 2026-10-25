import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { useThemeStore, type ThemePreference } from './theme.store'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

/** Browser-local preferences only. Password and sessions live on the Account page. */
export default function SettingsPage() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <div className="p-8">
      <PageHeader title="Settings" subtitle="Site preferences for this browser." />

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-gray-900">Appearance</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Theme is saved in this browser. “System” follows your OS setting.
            </p>
            <div className="mt-4 flex gap-2">
              {THEME_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={theme === opt.value ? 'primary' : 'secondary'}
                  onClick={() => setTheme(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
