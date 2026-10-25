import { PASSWORD_RULES } from './password-policy'

/** Live checklist of the password policy, ticking off rules as the user types. */
export function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password)
        return (
          <li key={rule.label} className={ok ? 'text-green-700' : 'text-[#6b7280]'}>
            <span aria-hidden="true">{ok ? '✓' : '○'}</span> {rule.label}
            <span className="sr-only">{ok ? ' (met)' : ' (not met)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
