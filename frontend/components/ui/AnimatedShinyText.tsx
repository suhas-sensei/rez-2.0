"use client"

import { ComponentPropsWithoutRef, CSSProperties } from "react"
import { cn } from "@/lib/utils"

interface AnimatedShinyTextProps extends ComponentPropsWithoutRef<"span"> {
  shimmerWidth?: number
}

export default function AnimatedShinyText({
  children,
  className,
  shimmerWidth = 100,
  ...props
}: AnimatedShinyTextProps) {
  return (
    <span
      className={cn(
        "shiny-text inline-block [background-size:var(--shiny-width)_100%] bg-clip-text [background-position:0_0] bg-gradient-to-r from-transparent via-black/80 via-50% to-transparent dark:via-white/80",
        className
      )}
      style={
        {
          "--shiny-width": `${shimmerWidth}px`,
        } as CSSProperties
      }
      {...props}
    >
      {children}
    </span>
  )
}
