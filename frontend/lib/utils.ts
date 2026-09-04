import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, letting later Tailwind utilities win over earlier conflicting ones.
 *
 * The standard shadcn helper. `clsx` handles conditionals and arrays; `tailwind-merge` resolves
 * conflicts, so a caller passing `px-8` overrides a component's default `px-6` instead of both
 * landing in the class list and letting stylesheet order decide.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
