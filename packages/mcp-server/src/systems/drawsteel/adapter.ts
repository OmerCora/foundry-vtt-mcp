/**
 * Draw Steel System Adapter
 *
 * Implements SystemAdapter interface for the Draw Steel RPG system.
 * Handles creature indexing, filtering, formatting, and character stat extraction.
 */

import type { SystemAdapter, SystemMetadata, SystemCreatureIndex, DrawSteelCreatureIndex } from '../types.js';
import { DrawSteelFiltersSchema, matchesDrawSteelFilters, describeDrawSteelFilters, type DrawSteelFilters } from './filters.js';

/**
 * Draw Steel system adapter
 */
export class DrawSteelAdapter implements SystemAdapter {
  getMetadata(): SystemMetadata {
    return {
      id: 'drawsteel',
      name: 'drawsteel',
      displayName: 'Draw Steel',
      version: '1.0.0',
      description: 'Support for Draw Steel with encounter values, monster roles, organizations, and keywords',
      supportedFeatures: {
        creatureIndex: true,
        characterStats: true,
        spellcasting: false,
        powerLevel: true // Uses Level/EV
      }
    };
  }

  canHandle(systemId: string): boolean {
    const id = systemId.toLowerCase();
    return id === 'drawsteel' || id === 'draw-steel';
  }

  extractCreatureData(doc: any, pack: any): { creature: SystemCreatureIndex; errors: number } | null {
    throw new Error('extractCreatureData should be called from DrawSteelIndexBuilder, not the adapter');
  }

  getFilterSchema() {
    return DrawSteelFiltersSchema;
  }

  matchesFilters(creature: SystemCreatureIndex, filters: Record<string, any>): boolean {
    const validated = DrawSteelFiltersSchema.safeParse(filters);
    if (!validated.success) {
      return false;
    }
    return matchesDrawSteelFilters(creature, validated.data as DrawSteelFilters);
  }

  getDataPaths(): Record<string, string | null> {
    return {
      // Draw Steel specific paths
      level: 'system.monster.level',
      ev: 'system.ev',
      role: 'system.monster.role',
      organization: 'system.monster.organization',
      keywords: 'system.monster.keywords',
      freeStrike: 'system.monster.freeStrike',
      stamina: 'system.stamina',
      stability: 'system.combat.stability',
      size: 'system.combat.size',
      speed: 'system.movement.value',
      characteristics: 'system.characteristics',
      recoveries: 'system.recoveries',
      // D&D/PF2e paths that don't exist in Draw Steel
      challengeRating: null,
      armorClass: null,
      hitPoints: null,
      alignment: null,
      spells: null,
      legendaryActions: null,
      perception: null,
      rarity: null
    };
  }

  formatCreatureForList(creature: SystemCreatureIndex): any {
    const dsCreature = creature as DrawSteelCreatureIndex;
    const formatted: any = {
      id: creature.id,
      name: creature.name,
      type: creature.type,
      pack: {
        id: creature.packName,
        label: creature.packLabel
      }
    };

    if (dsCreature.systemData) {
      const stats: any = {};

      if (dsCreature.systemData.level !== undefined) {
        stats.level = dsCreature.systemData.level;
      }

      if (dsCreature.systemData.ev !== undefined) {
        stats.ev = dsCreature.systemData.ev;
      }

      if (dsCreature.systemData.role && dsCreature.systemData.role !== 'unknown') {
        stats.role = dsCreature.systemData.role;
      }

      if (dsCreature.systemData.organization && dsCreature.systemData.organization !== 'unknown') {
        stats.organization = dsCreature.systemData.organization;
      }

      if (dsCreature.systemData.size) {
        stats.size = dsCreature.systemData.size;
      }

      if (dsCreature.systemData.stamina) {
        stats.stamina = dsCreature.systemData.stamina;
      }

      if (dsCreature.systemData.keywords && dsCreature.systemData.keywords.length > 0) {
        stats.keywords = dsCreature.systemData.keywords;
      }

      if (Object.keys(stats).length > 0) {
        formatted.stats = stats;
      }
    }

    if (creature.img) {
      formatted.hasImage = true;
    }

    return formatted;
  }

  formatCreatureForDetails(creature: SystemCreatureIndex): any {
    const dsCreature = creature as DrawSteelCreatureIndex;
    const formatted = this.formatCreatureForList(creature);

    if (dsCreature.systemData) {
      formatted.detailedStats = {
        level: dsCreature.systemData.level,
        ev: dsCreature.systemData.ev,
        role: dsCreature.systemData.role,
        organization: dsCreature.systemData.organization,
        keywords: dsCreature.systemData.keywords,
        size: dsCreature.systemData.size,
        stamina: dsCreature.systemData.stamina,
        stability: dsCreature.systemData.stability,
        freeStrike: dsCreature.systemData.freeStrike,
        speed: dsCreature.systemData.speed,
        characteristics: dsCreature.systemData.characteristics
      };
    }

    if (creature.img) {
      formatted.img = creature.img;
    }

    return formatted;
  }

  describeFilters(filters: Record<string, any>): string {
    const validated = DrawSteelFiltersSchema.safeParse(filters);
    if (!validated.success) {
      return 'invalid filters';
    }
    return describeDrawSteelFilters(validated.data as DrawSteelFilters);
  }

  getPowerLevel(creature: SystemCreatureIndex): number | undefined {
    const dsCreature = creature as DrawSteelCreatureIndex;

    // Draw Steel uses level as the primary power metric
    if (dsCreature.systemData?.level !== undefined) {
      return dsCreature.systemData.level;
    }

    return undefined;
  }

  /**
   * Extract character statistics from actor data
   * Handles both heroes and NPCs
   */
  extractCharacterStats(actorData: any): any {
    const system = actorData.system || {};
    const stats: any = {};

    // Basic info
    stats.name = actorData.name;
    stats.type = actorData.type;

    // Level & Echelon
    const level = system.level ?? system.monster?.level;
    if (level !== undefined && level !== null) {
      stats.level = Number(level);
    }
    if (system.echelon !== undefined) {
      stats.echelon = system.echelon;
    }

    // Characteristics
    if (system.characteristics) {
      stats.characteristics = {};
      for (const key of ['might', 'agility', 'reason', 'intuition', 'presence']) {
        const chr = system.characteristics[key];
        if (chr) {
          stats.characteristics[key] = {
            value: chr.value ?? 0
          };
        }
      }
    }

    // Stamina
    const stamina = system.stamina;
    if (stamina) {
      stats.stamina = {
        current: stamina.value ?? 0,
        max: stamina.max ?? 0,
        temporary: stamina.temporary ?? 0,
        winded: stamina.winded ?? 0
      };
    }

    // Recoveries
    const recoveries = system.recoveries;
    if (recoveries) {
      stats.recoveries = {
        current: recoveries.value ?? 0,
        max: recoveries.max ?? 0,
        recoveryValue: recoveries.recoveryValue ?? 0
      };
    }

    // Combat stats
    if (system.combat) {
      stats.combat = {};

      if (system.combat.size) {
        stats.combat.size = system.combat.size.letter ?? 'M';
      }

      if (system.combat.stability !== undefined) {
        stats.combat.stability = system.combat.stability;
      }

      if (system.combat.turns !== undefined) {
        stats.combat.turns = system.combat.turns;
      }
    }

    // Movement
    if (system.movement) {
      stats.movement = {
        speed: system.movement.value ?? 0,
        types: system.movement.types ?? []
      };
      if (system.movement.teleport) {
        stats.movement.teleport = system.movement.teleport;
      }
    }

    // Skills
    if (system.skills?.value && Array.isArray(system.skills.value)) {
      stats.skills = system.skills.value;
    }

    // NPC-specific: Monster block
    if (actorData.type === 'npc') {
      const monster = system.monster || {};
      stats.monster = {};

      if (monster.role) stats.monster.role = monster.role;
      if (monster.organization) stats.monster.organization = monster.organization;
      if (monster.freeStrike !== undefined) stats.monster.freeStrike = monster.freeStrike;
      if (Array.isArray(monster.keywords) && monster.keywords.length > 0) {
        stats.monster.keywords = monster.keywords;
      }

      if (system.ev !== undefined) {
        stats.monster.ev = system.ev;
      }
    }

    // Hero-specific: Resources
    if (actorData.type === 'hero') {
      const hero = system.hero || {};
      stats.hero = {};

      if (hero.primary) {
        stats.hero.resource = {
          value: hero.primary.value ?? 0,
          label: hero.primary.label ?? ''
        };
      }
      if (hero.surges !== undefined) stats.hero.surges = hero.surges;
      if (hero.victories !== undefined) stats.hero.victories = hero.victories;
      if (hero.renown !== undefined) stats.hero.renown = hero.renown;
      if (hero.xp !== undefined) stats.hero.xp = hero.xp;
    }

    // Damage immunities & weaknesses
    if (system.damage) {
      if (system.damage.immunities) {
        const immunities: Record<string, number> = {};
        for (const [type, val] of Object.entries(system.damage.immunities)) {
          if (val && Number(val) > 0) immunities[type] = Number(val);
        }
        if (Object.keys(immunities).length > 0) stats.damageImmunities = immunities;
      }
      if (system.damage.weaknesses) {
        const weaknesses: Record<string, number> = {};
        for (const [type, val] of Object.entries(system.damage.weaknesses)) {
          if (val && Number(val) > 0) weaknesses[type] = Number(val);
        }
        if (Object.keys(weaknesses).length > 0) stats.damageWeaknesses = weaknesses;
      }
    }

    // Condition immunities
    if (system.statuses?.immunities && Array.isArray(system.statuses.immunities) && system.statuses.immunities.length > 0) {
      stats.conditionImmunities = system.statuses.immunities;
    }

    return stats;
  }
}
