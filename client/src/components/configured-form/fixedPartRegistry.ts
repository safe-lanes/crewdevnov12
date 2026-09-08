import type { ReactNode } from "react";

export type FixedPartPreviewContext = {
  readOnly: true;
};

export type FixedPartFactory = (
  context: FixedPartPreviewContext,
) => Record<string, ReactNode>;

const fixedPartFactories = new Map<string, FixedPartFactory>();

const normalizeCategory = (category: string): string =>
  category.trim().toLowerCase();

export function registerFixedParts(
  category: string,
  factory: FixedPartFactory,
): void {
  fixedPartFactories.set(normalizeCategory(category), factory);
}

export function getFixedParts(
  category: string | null | undefined,
  context: FixedPartPreviewContext,
): Record<string, ReactNode> | undefined {
  if (!category) return undefined;
  return fixedPartFactories.get(normalizeCategory(category))?.(context);
}