import { m } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { cardVariants } from '@/lib/motion/variants'
import { spring } from '@/lib/motion/tokens'

type ClashingHandlers =
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onTransitionEnd'

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, ClashingHandlers> {
  /** Adds hover lift + press feedback. For cards that are themselves clickable. */
  interactive?: boolean
  /**
   * Set when the card is a child of a staggered container — it then inherits
   * the parent's `visible` trigger instead of animating on its own schedule.
   */
  inStagger?: boolean
}

export function Card({ className, interactive, inStagger, ...props }: CardProps) {
  return (
    <m.div
      variants={cardVariants}
      // A stagger parent drives `initial`/`animate` through context; declaring
      // them here would detach the card from the cascade.
      {...(inStagger ? {} : { initial: 'hidden', animate: 'visible' })}
      {...(interactive
        ? {
            // Transition is declared per-gesture rather than via the `transition`
            // prop: cardVariants.visible carries its own (spring.smooth) for the
            // entrance, and a blanket prop here would read as if it governed
            // that too when in fact a variant's own transition always wins.
            whileHover: { y: -2, scale: 1.004, transition: spring.snappy },
            whileTap: { scale: 0.997, transition: spring.snappy },
          }
        : {})}
      className={cn(
        'rounded-xl border border-gray-200 bg-white shadow-sm',
        // Depth is a CSS shadow transition, not an animated box-shadow —
        // animating shadow repaints every frame; transform stays composited.
        interactive && 'cursor-pointer transition-shadow duration-200 hover:shadow-md',
        className
      )}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}
