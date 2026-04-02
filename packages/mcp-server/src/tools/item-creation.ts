import { z } from 'zod';
import { FoundryClient } from '../foundry-client.js';
import { Logger } from '../logger.js';
import { ErrorHandler } from '../utils/error-handler.js';

export interface ItemCreationToolsOptions {
  foundryClient: FoundryClient;
  logger: Logger;
}

export class ItemCreationTools {
  private foundryClient: FoundryClient;
  private logger: Logger;
  private errorHandler: ErrorHandler;

  constructor({ foundryClient, logger }: ItemCreationToolsOptions) {
    this.foundryClient = foundryClient;
    this.logger = logger.child({ component: 'ItemCreationTools' });
    this.errorHandler = new ErrorHandler(this.logger);
  }

  getToolDefinitions() {
    return [
      {
        name: 'create-item',
        description: `Create a new item and optionally add it to an actor. Supports all Draw Steel item types including abilities, equipment (treasure), features, kits, and more. For abilities, provide power roll effects with tier1/tier2/tier3 damage and effects. For equipment/treasure, provide kind, category, echelon, and keywords. Use get-character or search-character-items first to understand the actor's existing items before adding new ones.`,
        inputSchema: {
          type: 'object',
          properties: {
            actorIdentifier: {
              type: 'string',
              description: 'Name or ID of the actor to add the item to. If omitted, creates a world-level item.',
            },
            name: {
              type: 'string',
              description: 'Name of the item to create',
            },
            type: {
              type: 'string',
              description: 'Item type. Draw Steel types: ability, treasure, kit, class, subclass, career, ancestry, culture, ancestryTrait, feature, complication, perk, title, follower, project',
            },
            img: {
              type: 'string',
              description: 'Optional icon path (e.g. "icons/svg/sword.svg")',
            },
            system: {
              type: 'object',
              description: `System-specific data object. Structure depends on item type. 
              
For Draw Steel abilities:
- keywords: string[] (e.g. ["melee", "strike", "weapon"])
- type: "main"|"maneuver"|"triggered"|"freeTriggered"|"freeManeuver"|"none"
- category: "signature"|"heroic"|"epic"
- resource: number|null (heroic resource or malice cost)
- trigger: string (for triggered abilities)
- distance: { type: "self"|"melee"|"ranged"|"meleeRanged"|"line"|"cube"|"wall"|"special", primary: string, secondary: string }
- target: { type: "self"|"creatureObject"|"special", value: number }
- power: { roll: { formula: string, characteristics: string[] }, effects: [{ damage: { type: string, tier1: string, tier2: string, tier3: string }, applied: [{ name: string, tier1: bool, tier2: bool, tier3: bool }], forced: { type: string, tier1: string, tier2: string, tier3: string }, other: { tier1: string, tier2: string, tier3: string } }] }
- effect: { before: string, after: string }
- spend: { value: number, text: string }

For Draw Steel treasure (equipment):
- kind: string (weapon, armor, implement)
- category: string
- echelon: number
- keywords: string[]
- quantity: number
- description: { value: string }

For Draw Steel features/perks/titles:
- description: { value: string }
- prerequisites: { value: string }`,
            },
          },
          required: ['name', 'type'],
        },
      },
      {
        name: 'create-items-batch',
        description: 'Create multiple items at once on an actor. Useful for building out a monster or NPC with all their abilities, equipment, and features in one call. Each item in the array follows the same format as create-item.',
        inputSchema: {
          type: 'object',
          properties: {
            actorIdentifier: {
              type: 'string',
              description: 'Name or ID of the actor to add items to. Required for batch creation.',
            },
            items: {
              type: 'array',
              description: 'Array of items to create',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Item name' },
                  type: { type: 'string', description: 'Item type (ability, treasure, feature, etc.)' },
                  img: { type: 'string', description: 'Optional icon path' },
                  system: { type: 'object', description: 'System-specific data (see create-item for details)' },
                },
                required: ['name', 'type'],
              },
              minItems: 1,
              maxItems: 50,
            },
          },
          required: ['actorIdentifier', 'items'],
        },
      },
      {
        name: 'update-item',
        description: 'Update an existing item on an actor. Provide the fields to change — unspecified fields are left unchanged. Use search-character-items first to find item IDs.',
        inputSchema: {
          type: 'object',
          properties: {
            actorIdentifier: {
              type: 'string',
              description: 'Name or ID of the actor that owns the item',
            },
            itemIdentifier: {
              type: 'string',
              description: 'Name or ID of the item to update',
            },
            updates: {
              type: 'object',
              description: 'Fields to update. Can include name, img, and/or system data.',
              properties: {
                name: { type: 'string', description: 'New item name' },
                img: { type: 'string', description: 'New icon path' },
                system: { type: 'object', description: 'System data fields to update (merged with existing)' },
              },
            },
          },
          required: ['actorIdentifier', 'itemIdentifier', 'updates'],
        },
      },
      {
        name: 'delete-item',
        description: 'Delete an item from an actor. Use search-character-items first to find the item.',
        inputSchema: {
          type: 'object',
          properties: {
            actorIdentifier: {
              type: 'string',
              description: 'Name or ID of the actor that owns the item',
            },
            itemIdentifier: {
              type: 'string',
              description: 'Name or ID of the item to delete',
            },
          },
          required: ['actorIdentifier', 'itemIdentifier'],
        },
      },
    ];
  }

  async handleCreateItem(args: any): Promise<any> {
    const schema = z.object({
      actorIdentifier: z.string().optional(),
      name: z.string().min(1),
      type: z.string().min(1),
      img: z.string().optional(),
      system: z.record(z.any()).optional(),
    });

    const validated = schema.parse(args);

    try {
      this.logger.info('Creating item', { name: validated.name, type: validated.type, actor: validated.actorIdentifier });

      const result = await this.foundryClient.query('foundry-mcp-bridge.createItem', validated);

      if (result.error) {
        return `Failed to create item: ${result.error}`;
      }

      const location = validated.actorIdentifier
        ? `on actor "${result.actorName || validated.actorIdentifier}"`
        : 'in the world';

      return `Created ${validated.type} "${result.name}" (ID: ${result.id}) ${location}.`;
    } catch (error) {
      return this.errorHandler.handleToolError(error, 'create-item', 'item creation');
    }
  }

  async handleCreateItemsBatch(args: any): Promise<any> {
    const schema = z.object({
      actorIdentifier: z.string().min(1),
      items: z.array(z.object({
        name: z.string().min(1),
        type: z.string().min(1),
        img: z.string().optional(),
        system: z.record(z.any()).optional(),
      })).min(1).max(50),
    });

    const validated = schema.parse(args);

    try {
      this.logger.info('Batch creating items', { count: validated.items.length, actor: validated.actorIdentifier });

      const result = await this.foundryClient.query('foundry-mcp-bridge.createItemsBatch', {
        actorIdentifier: validated.actorIdentifier,
        items: validated.items,
      });

      if (result.error) {
        return `Failed to batch create items: ${result.error}`;
      }

      const summary = result.created.map((item: any) => `  - ${item.type}: "${item.name}" (ID: ${item.id})`).join('\n');
      return `Created ${result.created.length} items on "${result.actorName}":\n${summary}`;
    } catch (error) {
      return this.errorHandler.handleToolError(error, 'create-items-batch', 'batch item creation');
    }
  }

  async handleUpdateItem(args: any): Promise<any> {
    const schema = z.object({
      actorIdentifier: z.string().min(1),
      itemIdentifier: z.string().min(1),
      updates: z.object({
        name: z.string().optional(),
        img: z.string().optional(),
        system: z.record(z.any()).optional(),
      }),
    });

    const validated = schema.parse(args);

    try {
      this.logger.info('Updating item', { item: validated.itemIdentifier, actor: validated.actorIdentifier });

      const result = await this.foundryClient.query('foundry-mcp-bridge.updateItem', validated);

      if (result.error) {
        return `Failed to update item: ${result.error}`;
      }

      return `Updated item "${result.name}" (ID: ${result.id}) on actor "${result.actorName}".`;
    } catch (error) {
      return this.errorHandler.handleToolError(error, 'update-item', 'item update');
    }
  }

  async handleDeleteItem(args: any): Promise<any> {
    const schema = z.object({
      actorIdentifier: z.string().min(1),
      itemIdentifier: z.string().min(1),
    });

    const validated = schema.parse(args);

    try {
      this.logger.info('Deleting item', { item: validated.itemIdentifier, actor: validated.actorIdentifier });

      const result = await this.foundryClient.query('foundry-mcp-bridge.deleteItem', validated);

      if (result.error) {
        return `Failed to delete item: ${result.error}`;
      }

      return `Deleted item "${result.name}" from actor "${result.actorName}".`;
    } catch (error) {
      return this.errorHandler.handleToolError(error, 'delete-item', 'item deletion');
    }
  }
}
