/**
 * Draw Steel Index Builder
 *
 * Builds enhanced creature index from Foundry compendiums for the Draw Steel system.
 * This code runs in Foundry's browser context, not Node.js.
 */

import type { IndexBuilder } from '../types.js';
import type { DrawSteelCreatureIndex } from '../types.js';

// Foundry browser globals (unavailable in Node.js TypeScript compilation)
declare const ui: any;

/**
 * Draw Steel implementation of IndexBuilder
 */
export class DrawSteelIndexBuilder implements IndexBuilder {
  private moduleId: string;

  constructor(moduleId: string = 'foundry-mcp-bridge') {
    this.moduleId = moduleId;
  }

  getSystemId() {
    return 'drawsteel' as const;
  }

  /**
   * Build enhanced creature index from compendium packs
   */
  async buildIndex(packs: any[], force = false): Promise<DrawSteelCreatureIndex[]> {
    const startTime = Date.now();
    let progressNotification: any = null;
    let totalErrors = 0;

    try {
      const actorPacks = packs.filter(pack => pack.metadata.type === 'Actor');
      const creatures: DrawSteelCreatureIndex[] = [];

      console.log(`[${this.moduleId}] Starting Draw Steel creature index build from ${actorPacks.length} packs...`);
      if (typeof ui !== 'undefined' && ui.notifications) {
        ui.notifications.info(`Starting Draw Steel creature index build from ${actorPacks.length} packs...`);
      }

      for (let i = 0; i < actorPacks.length; i++) {
        const pack = actorPacks[i];
        const progressPercent = Math.round((i / actorPacks.length) * 100);

        if (i % 3 === 0) {
          if (progressNotification && typeof ui !== 'undefined') {
            progressNotification.remove();
          }
          if (typeof ui !== 'undefined' && ui.notifications) {
            progressNotification = ui.notifications.info(
              `Building creature index... ${progressPercent}% (${i + 1}/${actorPacks.length}) Processing: ${pack.metadata.label}`
            );
          }
        }

        try {
          if (!pack.indexed) {
            await pack.getIndex({});
          }

          const packResult = await this.extractDataFromPack(pack);
          creatures.push(...packResult.creatures);
          totalErrors += packResult.errors;

        } catch (error) {
          console.warn(`[${this.moduleId}] Failed to process pack ${pack.metadata.label}:`, error);
          if (typeof ui !== 'undefined' && ui.notifications) {
            ui.notifications.warn(`Warning: Failed to index pack "${pack.metadata.label}" - continuing with other packs`);
          }
        }
      }

      if (progressNotification && typeof ui !== 'undefined') {
        progressNotification.remove();
      }

      const buildTimeSeconds = Math.round((Date.now() - startTime) / 1000);
      const errorText = totalErrors > 0 ? ` (${totalErrors} extraction errors)` : '';
      const successMessage = `Draw Steel creature index complete! ${creatures.length} creatures indexed from ${actorPacks.length} packs in ${buildTimeSeconds}s${errorText}`;

      console.log(`[${this.moduleId}] ${successMessage}`);
      if (typeof ui !== 'undefined' && ui.notifications) {
        ui.notifications.info(successMessage);
      }

      return creatures;

    } catch (error) {
      if (progressNotification && typeof ui !== 'undefined') {
        progressNotification.remove();
      }

      const errorMessage = `Failed to build Draw Steel creature index: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[${this.moduleId}] ${errorMessage}`);
      if (typeof ui !== 'undefined' && ui.notifications) {
        ui.notifications.error(errorMessage);
      }

      throw error;
    }
  }

  /**
   * Extract creature data from a single compendium pack
   */
  async extractDataFromPack(pack: any): Promise<{ creatures: DrawSteelCreatureIndex[]; errors: number }> {
    const creatures: DrawSteelCreatureIndex[] = [];
    let errors = 0;

    try {
      const documents = await pack.getDocuments();

      for (const doc of documents) {
        try {
          // Draw Steel uses "npc" for all monsters/NPCs
          if (doc.type !== 'npc') {
            continue;
          }

          const result = this.extractCreatureData(doc, pack);
          if (result) {
            creatures.push(result.creature);
            errors += result.errors;
          }

        } catch (error) {
          console.warn(`[${this.moduleId}] Failed to extract data from ${doc.name} in ${pack.metadata.label}:`, error);
          errors++;
        }
      }

    } catch (error) {
      console.warn(`[${this.moduleId}] Failed to load documents from ${pack.metadata.label}:`, error);
      errors++;
    }

    return { creatures, errors };
  }

  /**
   * Extract Draw Steel creature data from a single document
   */
  extractCreatureData(doc: any, pack: any): { creature: DrawSteelCreatureIndex; errors: number } | null {
    try {
      const system = doc.system || {};
      const monster = system.monster || {};

      // Level: NPC-specific field or top-level
      const level = monster.level ?? system.level ?? 0;

      // Encounter Value
      const ev = system.ev ?? 0;

      // Role and Organization
      const role = monster.role ?? 'unknown';
      const organization = monster.organization ?? 'unknown';

      // Keywords
      const keywords: string[] = Array.isArray(monster.keywords) ? monster.keywords : [];

      // Size
      const sizeValue = system.combat?.size?.value ?? 1;
      const sizeLetter = system.combat?.size?.letter ?? this.sizeNumberToLetter(sizeValue);

      // Stamina
      const stamina = system.stamina?.max ?? system.stamina?.value ?? 0;

      // Stability
      const stability = system.combat?.stability ?? 0;

      // Free strike damage
      const freeStrike = monster.freeStrike ?? 0;

      // Speed
      const speed = system.movement?.value ?? 0;

      // Characteristics
      const characteristics: Record<string, number> = {};
      if (system.characteristics) {
        for (const key of ['might', 'agility', 'reason', 'intuition', 'presence']) {
          characteristics[key] = system.characteristics[key]?.value ?? 0;
        }
      }

      return {
        creature: {
          id: doc._id,
          name: doc.name,
          type: doc.type,
          packName: pack.metadata.id,
          packLabel: pack.metadata.label,
          img: doc.img || '',
          system: 'drawsteel',
          systemData: {
            level: Number(level),
            ev: Number(ev),
            role,
            organization,
            keywords,
            size: sizeLetter,
            stamina: Number(stamina),
            stability: Number(stability),
            freeStrike: Number(freeStrike),
            speed: Number(speed),
            characteristics
          }
        },
        errors: 0
      };
    } catch (error) {
      console.warn(`[${this.moduleId}] Failed to extract data from ${doc.name}:`, error);
      return {
        creature: {
          id: doc._id,
          name: doc.name,
          type: doc.type,
          packName: pack.metadata.id,
          packLabel: pack.metadata.label,
          img: doc.img || '',
          system: 'drawsteel',
          systemData: {
            level: 0,
            ev: 0,
            role: 'unknown',
            organization: 'unknown',
            keywords: [],
            size: 'M',
            stamina: 0,
            stability: 0,
            freeStrike: 0,
            speed: 0,
            characteristics: {}
          }
        },
        errors: 1
      };
    }
  }

  /**
   * Convert numeric size to letter code
   */
  private sizeNumberToLetter(size: number): string {
    switch (size) {
      case 0: return 'T';
      case 1: return 'M';
      case 2: return 'L';
      case 3: return 'H';
      case 4: return 'G';
      default: return 'M';
    }
  }
}
