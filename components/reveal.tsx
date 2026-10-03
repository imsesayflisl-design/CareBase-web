"use client";

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export type RevealVariant = "up" | "down" | "left" | "right" | "fade" | "zoom";

type RevealProps = {
  children: ReactNode;
  /** Element to render (e.g. "div", "section", "article", "li"). */
  as?: ElementType;
  /** Direction the element travels from while revealing. */
  variant?: RevealVariant;
  /** Delay before the transition starts, in milliseconds. */
  delay?: number;
  /** Override the transition duration, in milliseconds. */
  duration?: number;
  /** Keep the element visible after it has been revealed (default true). */
  once?: boolean;
  /** Fraction of the element that must be visible before revealing (0-1). */
  amount?: number;
  className?: string;
  style?: CSSProperties;
  id?: string;
};

/**
 * Lightweight scroll-reveal wrapper.
 *
 * The element is hidden by CSS only once JS is available (see the
 * `reveal-ready` flag added in the root layout), so content stays visible when
 * JavaScript is disabled and users who prefer reduced motion are never hidden.
 */
export function Reveal({
  children,
  as = "div",
  variant = "up",
  delay = 0,
  duration,
  once = true,
  amount = 0.18,
  className,
  style,
  id,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold: amount, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [amount, once]);

  const revealStyle = {
    "--reveal-delay": `${delay}ms`,
    ...(duration ? { "--reveal-duration": `${duration}ms` } : null),
    ...style,
  } as CSSProperties;

  return createElement(
    as,
    {
      ref,
      id,
      "data-reveal": variant,
      className: cn(visible && "is-visible", className),
      style: revealStyle,
    },
    children,
  );
}