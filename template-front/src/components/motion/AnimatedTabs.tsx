import { useId } from 'react'
import { AnimatePresence, LayoutGroup, m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { fadeVariants } from '@/lib/motion/variants'
import { spring } from '@/lib/motion/tokens'

export interface TabItem {
  value: string
  label: React.ReactNode
  /** Optional trailing count/badge. */
  badge?: React.ReactNode
}

/**
 * Tab bar whose active underline is a single shared element that slides between
 * tabs (`layoutId`) rather than one indicator per tab fading in and out — the
 * detail that makes tab switching read as one continuous motion.
 *
 * `LayoutGroup` scopes the shared id so two tab bars on one page can't adopt
 * each other's indicator.
 */
export function AnimatedTabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const groupId = useId()

  return (
    <LayoutGroup id={groupId}>
      <div role="tablist" className={cn('flex gap-1 border-b border-gray-200', className)}>
        {tabs.map((tab) => {
          const active = tab.value === value
          return (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={cn(
                'relative px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'text-brand-600' : 'text-gray-500 hover:text-gray-800',
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                {tab.label}
                {tab.badge}
              </span>
              {active && (
                <m.span
                  layoutId="tab-indicator"
                  transition={spring.smooth}
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600"
                />
              )}
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}

/**
 * Panel body for the active tab. Cross-fades on change and animates its own
 * height so panels of differing lengths don't cause the page to jump.
 */
export function AnimatedTabPanel({
  value,
  children,
  className,
}: {
  /** The active tab's value — used as the presence key. */
  value: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <m.div layout className={cn('overflow-hidden', className)} transition={spring.smooth}>
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={value} variants={fadeVariants} initial="hidden" animate="visible" exit="exit">
          {children}
        </m.div>
      </AnimatePresence>
    </m.div>
  )
}
