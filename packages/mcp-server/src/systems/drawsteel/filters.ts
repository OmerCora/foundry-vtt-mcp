/**
 * Draw Steel Filter Schemas
 *
 * Filter definitions for the Draw Steel game system.
 * Supports filtering by level, encounter value, role, organization, keywords, and size.
 */

import { z } from 'zod';

/**
 * Draw Steel monster roles
 */
export const DrawSteelMonsterRoles = [
  'ambusher',
  'artillery',
  'brute',
  'controller',
  'defender',
  'harrier',
  'hexer',
  'mount',
  'support'
] as const;

export type DrawSteelMonsterRole = typeof DrawSteelMonsterRoles[number];

/**
 * Draw Steel monster organizations
 */
export const DrawSteelMonsterOrganizations = [
  'minion',
  'horde',
  'platoon',
  'elite',
  'leader',
  'solo'
] as const;

export type DrawSteelMonsterOrganization = typeof DrawSteelMonsterOrganizations[number];

/**
 * Draw Steel creature sizes
 */
export const DrawSteelSizes = ['T', 'S', 'M', 'L', 'H', 'G'] as const;
export type DrawSteelSize = typeof DrawSteelSizes[number];

/**
 * Draw Steel filter schema
 */
export const DrawSteelFiltersSchema = z.object({
  level: z.union([
    z.number(),
    z.object({
      min: z.number().optional(),
      max: z.number().optional()
    })
  ]).optional(),
  ev: z.union([
    z.number(),
    z.object({
      min: z.number().optional(),
      max: z.number().optional()
    })
  ]).optional(),
  role: z.enum(DrawSteelMonsterRoles).optional(),
  organization: z.enum(DrawSteelMonsterOrganizations).optional(),
  size: z.enum(DrawSteelSizes).optional(),
  keyword: z.string().optional()
});

export type DrawSteelFilters = z.infer<typeof DrawSteelFiltersSchema>;

/**
 * Check if a creature matches Draw Steel filters
 */
export function matchesDrawSteelFilters(creature: any, filters: DrawSteelFilters): boolean {
  // Level filter
  if (filters.level !== undefined) {
    const level = creature.systemData?.level;
    if (level === undefined) return false;

    if (typeof filters.level === 'number') {
      if (level !== filters.level) return false;
    } else {
      const min = filters.level.min ?? 1;
      const max = filters.level.max ?? 20;
      if (level < min || level > max) return false;
    }
  }

  // Encounter Value filter
  if (filters.ev !== undefined) {
    const ev = creature.systemData?.ev;
    if (ev === undefined) return false;

    if (typeof filters.ev === 'number') {
      if (ev !== filters.ev) return false;
    } else {
      const min = filters.ev.min ?? 0;
      const max = filters.ev.max ?? 100;
      if (ev < min || ev > max) return false;
    }
  }

  // Role filter
  if (filters.role) {
    const role = creature.systemData?.role;
    if (!role || role.toLowerCase() !== filters.role.toLowerCase()) {
      return false;
    }
  }

  // Organization filter
  if (filters.organization) {
    const organization = creature.systemData?.organization;
    if (!organization || organization.toLowerCase() !== filters.organization.toLowerCase()) {
      return false;
    }
  }

  // Size filter
  if (filters.size) {
    const size = creature.systemData?.size;
    if (!size || size.toUpperCase() !== filters.size.toUpperCase()) {
      return false;
    }
  }

  // Keyword filter (partial match against keywords array)
  if (filters.keyword) {
    const keywords: string[] = creature.systemData?.keywords ?? [];
    const search = filters.keyword.toLowerCase();
    if (!keywords.some((k: string) => k.toLowerCase().includes(search))) {
      return false;
    }
  }

  return true;
}

/**
 * Generate human-readable description of Draw Steel filters
 */
export function describeDrawSteelFilters(filters: DrawSteelFilters): string {
  const parts: string[] = [];

  if (filters.level !== undefined) {
    if (typeof filters.level === 'number') {
      parts.push(`Level ${filters.level}`);
    } else {
      const min = filters.level.min ?? 1;
      const max = filters.level.max ?? 20;
      parts.push(`Level ${min}-${max}`);
    }
  }

  if (filters.ev !== undefined) {
    if (typeof filters.ev === 'number') {
      parts.push(`EV ${filters.ev}`);
    } else {
      const min = filters.ev.min ?? 0;
      const max = filters.ev.max ?? 100;
      parts.push(`EV ${min}-${max}`);
    }
  }

  if (filters.role) parts.push(filters.role);
  if (filters.organization) parts.push(filters.organization);
  if (filters.size) parts.push(`Size ${filters.size}`);
  if (filters.keyword) parts.push(`keyword: ${filters.keyword}`);

  return parts.length > 0 ? parts.join(', ') : 'no filters';
}
