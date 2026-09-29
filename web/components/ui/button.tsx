import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Every button is outlined like the login page's (owner, 2026-09-29). The default keeps a
        // gold border at rest so it still reads as the main action, and so a chosen option (RSVP,
        // In/Out, the drinks question: `default` when picked, `outline` when not) stays visible.
        default:
          "border border-primary/60 bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/30 dark:hover:text-foreground dark:hover:border-primary dark:hover:shadow-[inset_0_0_12px_color-mix(in_oklch,var(--primary)_25%,transparent)]",
        destructive:
          "border border-destructive/60 bg-background text-destructive shadow-xs hover:bg-destructive/10 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-input/30 dark:hover:bg-input/30 dark:hover:border-destructive dark:hover:shadow-[inset_0_0_12px_color-mix(in_oklch,var(--destructive)_25%,transparent)]",
        // Dark keeps the text on hover: accent-foreground is near-black, and the dark hover
        // background never turns gold, so the label vanished. A gold border and inner glow instead.
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/30 dark:hover:text-foreground dark:hover:border-primary/60 dark:hover:shadow-[inset_0_0_12px_color-mix(in_oklch,var(--primary)_25%,transparent)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        // No fill on hover (owner, 2026-09-29): the muted label brightens to full foreground.
        ghost:
          "hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
