import { query, queryOne, withTransaction } from "../db/pool";
import { storageService } from "./storage.service";
import type {
  MenuCategory,
  MenuItem,
  Modifier,
  ModifierOption,
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateModifierDto,
} from "@qr-saas/shared";
import { QueryResultRow } from "pg";

// ── Row types ─────────────────────────────────────────────────

interface CategoryRow extends QueryResultRow {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  available_from: string | null;
  available_until: string | null;
  item_count?: string;
}

interface ItemRow extends QueryResultRow {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  category_name: string | null;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
  tags: string[];
  allergens: string[];
  calories: number | null;
  prep_time_min: number;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

interface ModifierRow extends QueryResultRow {
  id: string;
  restaurant_id: string;
  name: string;
  is_required: boolean;
  min_select: number;
  max_select: number;
}

interface ModifierOptionRow extends QueryResultRow {
  id: string;
  modifier_id: string;
  name: string;
  price_delta: string;
}

// ── Mappers ───────────────────────────────────────────────────

function mapCategory(row: CategoryRow): MenuCategory {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    availableFrom: row.available_from,
    availableUntil: row.available_until,
    itemCount: row.item_count ? parseInt(row.item_count, 10) : undefined,
  };
}

function mapItem(row: ItemRow): MenuItem {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    name: row.name,
    description: row.description,
    price: parseFloat(row.price),
    imageUrl: row.image_url,
    tags: row.tags ?? [],
    allergens: row.allergens ?? [],
    calories: row.calories,
    prepTimeMin: row.prep_time_min,
    isAvailable: row.is_available,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapModifier(row: ModifierRow, options: ModifierOption[]): Modifier {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    isRequired: row.is_required,
    minSelect: row.min_select,
    maxSelect: row.max_select,
    options,
  };
}

// ── Menu Service ──────────────────────────────────────────────

export class MenuService {

  // ── Categories ───────────────────────────────────────────────

  async listCategories(restaurantId: string): Promise<MenuCategory[]> {
    const rows = await query<CategoryRow>(
      `SELECT c.*,
              COUNT(i.id) FILTER (WHERE i.is_available = true) AS item_count
       FROM menu_categories c
       LEFT JOIN menu_items i ON i.category_id = c.id AND i.restaurant_id = c.restaurant_id
       WHERE c.restaurant_id = $1
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.name ASC`,
      [restaurantId]
    );
    return rows.map(mapCategory);
  }

  async getCategoryById(id: string, restaurantId: string): Promise<MenuCategory | null> {
    const row = await queryOne<CategoryRow>(
      "SELECT * FROM menu_categories WHERE id = $1 AND restaurant_id = $2",
      [id, restaurantId]
    );
    return row ? mapCategory(row) : null;
  }

  async createCategory(
    restaurantId: string,
    dto: CreateMenuCategoryDto
  ): Promise<MenuCategory> {
    const row = await queryOne<CategoryRow>(
      `INSERT INTO menu_categories
         (restaurant_id, name, description, sort_order, available_from, available_until)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        restaurantId,
        dto.name,
        dto.description ?? null,
        dto.sortOrder ?? 0,
        dto.availableFrom ?? null,
        dto.availableUntil ?? null,
      ]
    );
    return mapCategory(row!);
  }

  async updateCategory(
    id: string,
    restaurantId: string,
    dto: UpdateMenuCategoryDto
  ): Promise<MenuCategory> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (dto.name !== undefined)          { fields.push(`name = $${idx++}`);            values.push(dto.name); }
    if (dto.description !== undefined)   { fields.push(`description = $${idx++}`);     values.push(dto.description); }
    if (dto.sortOrder !== undefined)     { fields.push(`sort_order = $${idx++}`);      values.push(dto.sortOrder); }
    if (dto.isActive !== undefined)      { fields.push(`is_active = $${idx++}`);       values.push(dto.isActive); }
    if (dto.availableFrom !== undefined) { fields.push(`available_from = $${idx++}`);  values.push(dto.availableFrom); }
    if (dto.availableUntil !== undefined){ fields.push(`available_until = $${idx++}`); values.push(dto.availableUntil); }

    if (fields.length === 0) return (await this.getCategoryById(id, restaurantId))!;

    values.push(id, restaurantId);
    const row = await queryOne<CategoryRow>(
      `UPDATE menu_categories SET ${fields.join(", ")}
       WHERE id = $${idx++} AND restaurant_id = $${idx} RETURNING *`,
      values
    );
    if (!row) throw Object.assign(new Error("Category not found"), { statusCode: 404 });
    return mapCategory(row);
  }

  async deleteCategory(id: string, restaurantId: string): Promise<void> {
    const result = await query(
      "DELETE FROM menu_categories WHERE id = $1 AND restaurant_id = $2",
      [id, restaurantId]
    );
    if (!result.length && !(result as unknown as { rowCount: number }).rowCount) {
      // Check if the row exists
      const exists = await queryOne(
        "SELECT id FROM menu_categories WHERE id = $1 AND restaurant_id = $2",
        [id, restaurantId]
      );
      if (!exists) throw Object.assign(new Error("Category not found"), { statusCode: 404 });
    }
  }

  async uploadCategoryImage(
    id: string,
    restaurantId: string,
    buffer: Buffer
  ): Promise<string> {
    const result = await storageService.uploadImage(buffer, restaurantId, "categories", "category");
    await query(
      "UPDATE menu_categories SET image_url = $1 WHERE id = $2 AND restaurant_id = $3",
      [result.url, id, restaurantId]
    );
    return result.url;
  }

  // ── Items ─────────────────────────────────────────────────────

  async listItems(
    restaurantId: string,
    opts: { categoryId?: string; search?: string; featuredOnly?: boolean } = {}
  ): Promise<MenuItem[]> {
    const conditions = ["i.restaurant_id = $1"];
    const values: unknown[] = [restaurantId];
    let idx = 2;

    if (opts.categoryId) {
      conditions.push(`i.category_id = $${idx++}`);
      values.push(opts.categoryId);
    }
    if (opts.featuredOnly) {
      conditions.push(`i.is_featured = true`);
    }
    if (opts.search) {
      conditions.push(`(i.name ILIKE $${idx++} OR i.description ILIKE $${idx - 1})`);
      values.push(`%${opts.search}%`);
    }

    const rows = await query<ItemRow>(
      `SELECT i.*, c.name AS category_name
       FROM menu_items i
       LEFT JOIN menu_categories c ON c.id = i.category_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY i.sort_order ASC, i.name ASC`,
      values
    );
    return rows.map(mapItem);
  }

  async getItemById(id: string, restaurantId: string): Promise<MenuItem | null> {
    const row = await queryOne<ItemRow>(
      `SELECT i.*, c.name AS category_name
       FROM menu_items i
       LEFT JOIN menu_categories c ON c.id = i.category_id
       WHERE i.id = $1 AND i.restaurant_id = $2`,
      [id, restaurantId]
    );
    if (!row) return null;
    const item = mapItem(row);
    item.modifiers = await this.getItemModifiers(id, restaurantId);
    return item;
  }

  async createItem(
    restaurantId: string,
    dto: CreateMenuItemDto
  ): Promise<MenuItem> {
    return withTransaction(async (client) => {
      const { rows: [row] } = await client.query<ItemRow>(
        `INSERT INTO menu_items
           (restaurant_id, category_id, name, description, price,
            tags, allergens, calories, prep_time_min, is_featured, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          restaurantId,
          dto.categoryId ?? null,
          dto.name,
          dto.description ?? null,
          dto.price,
          dto.tags ?? [],
          dto.allergens ?? [],
          dto.calories ?? null,
          dto.prepTimeMin ?? 10,
          dto.isFeatured ?? false,
          dto.sortOrder ?? 0,
        ]
      );

      // Attach modifiers
      if (dto.modifierIds?.length) {
        for (const modId of dto.modifierIds) {
          await client.query(
            "INSERT INTO item_modifiers (item_id, modifier_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [row.id, modId]
          );
        }
      }

      const item = mapItem(row);
      item.modifiers = await this.getItemModifiers(row.id, restaurantId);
      return item;
    });
  }

  async updateItem(
    id: string,
    restaurantId: string,
    dto: UpdateMenuItemDto
  ): Promise<MenuItem> {
    return withTransaction(async (client) => {
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (dto.name !== undefined)        { fields.push(`name = $${idx++}`);          values.push(dto.name); }
      if (dto.description !== undefined) { fields.push(`description = $${idx++}`);   values.push(dto.description); }
      if (dto.price !== undefined)       { fields.push(`price = $${idx++}`);         values.push(dto.price); }
      if (dto.categoryId !== undefined)  { fields.push(`category_id = $${idx++}`);   values.push(dto.categoryId); }
      if (dto.tags !== undefined)        { fields.push(`tags = $${idx++}`);          values.push(dto.tags); }
      if (dto.allergens !== undefined)   { fields.push(`allergens = $${idx++}`);     values.push(dto.allergens); }
      if (dto.calories !== undefined)    { fields.push(`calories = $${idx++}`);      values.push(dto.calories); }
      if (dto.prepTimeMin !== undefined) { fields.push(`prep_time_min = $${idx++}`); values.push(dto.prepTimeMin); }
      if (dto.isAvailable !== undefined) { fields.push(`is_available = $${idx++}`);  values.push(dto.isAvailable); }
      if (dto.isFeatured !== undefined)  { fields.push(`is_featured = $${idx++}`);   values.push(dto.isFeatured); }
      if (dto.sortOrder !== undefined)   { fields.push(`sort_order = $${idx++}`);    values.push(dto.sortOrder); }

      if (fields.length > 0) {
        values.push(id, restaurantId);
        const { rows: [row] } = await client.query<ItemRow>(
          `UPDATE menu_items SET ${fields.join(", ")}
           WHERE id = $${idx++} AND restaurant_id = $${idx} RETURNING *`,
          values
        );
        if (!row) throw Object.assign(new Error("Item not found"), { statusCode: 404 });
      }

      // Update modifier attachments
      if (dto.modifierIds !== undefined) {
        await client.query("DELETE FROM item_modifiers WHERE item_id = $1", [id]);
        for (const modId of dto.modifierIds) {
          await client.query(
            "INSERT INTO item_modifiers (item_id, modifier_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [id, modId]
          );
        }
      }

      return (await this.getItemById(id, restaurantId))!;
    });
  }

  async deleteItem(id: string, restaurantId: string): Promise<void> {
    await query(
      "DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2",
      [id, restaurantId]
    );
  }

  async toggleAvailability(id: string, restaurantId: string): Promise<MenuItem> {
    const row = await queryOne<ItemRow>(
      `UPDATE menu_items
       SET is_available = NOT is_available
       WHERE id = $1 AND restaurant_id = $2
       RETURNING *`,
      [id, restaurantId]
    );
    if (!row) throw Object.assign(new Error("Item not found"), { statusCode: 404 });
    return mapItem(row);
  }

  async uploadItemImage(
    id: string,
    restaurantId: string,
    buffer: Buffer
  ): Promise<string> {
    const result = await storageService.uploadImage(buffer, restaurantId, "menu-items", "menu_item");
    await query(
      "UPDATE menu_items SET image_url = $1 WHERE id = $2 AND restaurant_id = $3",
      [result.url, id, restaurantId]
    );
    return result.url;
  }

  // ── Modifiers ─────────────────────────────────────────────────

  async listModifiers(restaurantId: string): Promise<Modifier[]> {
    const mods = await query<ModifierRow>(
      "SELECT * FROM modifiers WHERE restaurant_id = $1 ORDER BY name",
      [restaurantId]
    );
    if (!mods.length) return [];

    const modIds = mods.map((m) => m.id);
    const options = await query<ModifierOptionRow>(
      `SELECT * FROM modifier_options WHERE modifier_id = ANY($1) ORDER BY name`,
      [modIds]
    );

    return mods.map((mod) => {
      const opts = options
        .filter((o) => o.modifier_id === mod.id)
        .map((o) => ({
          id: o.id,
          modifierId: o.modifier_id,
          name: o.name,
          priceDelta: parseFloat(o.price_delta),
        }));
      return mapModifier(mod, opts);
    });
  }

  async getItemModifiers(itemId: string, restaurantId: string): Promise<Modifier[]> {
    const mods = await query<ModifierRow>(
      `SELECT m.* FROM modifiers m
       JOIN item_modifiers im ON im.modifier_id = m.id
       WHERE im.item_id = $1 AND m.restaurant_id = $2
       ORDER BY m.name`,
      [itemId, restaurantId]
    );
    if (!mods.length) return [];

    const modIds = mods.map((m) => m.id);
    const options = await query<ModifierOptionRow>(
      `SELECT * FROM modifier_options WHERE modifier_id = ANY($1) ORDER BY name`,
      [modIds]
    );

    return mods.map((mod) => {
      const opts = options
        .filter((o) => o.modifier_id === mod.id)
        .map((o) => ({
          id: o.id,
          modifierId: o.modifier_id,
          name: o.name,
          priceDelta: parseFloat(o.price_delta),
        }));
      return mapModifier(mod, opts);
    });
  }

  async createModifier(
    restaurantId: string,
    dto: CreateModifierDto
  ): Promise<Modifier> {
    return withTransaction(async (client) => {
      const { rows: [mod] } = await client.query<ModifierRow>(
        `INSERT INTO modifiers (restaurant_id, name, is_required, min_select, max_select)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          restaurantId,
          dto.name,
          dto.isRequired ?? false,
          dto.minSelect ?? 0,
          dto.maxSelect ?? 1,
        ]
      );

      const options: ModifierOption[] = [];
      for (const opt of dto.options) {
        const { rows: [optRow] } = await client.query<ModifierOptionRow>(
          `INSERT INTO modifier_options (modifier_id, name, price_delta)
           VALUES ($1, $2, $3) RETURNING *`,
          [mod.id, opt.name, opt.priceDelta ?? 0]
        );
        options.push({
          id: optRow.id,
          modifierId: optRow.modifier_id,
          name: optRow.name,
          priceDelta: parseFloat(optRow.price_delta),
        });
      }

      return mapModifier(mod, options);
    });
  }

  async deleteModifier(id: string, restaurantId: string): Promise<void> {
    await query(
      "DELETE FROM modifiers WHERE id = $1 AND restaurant_id = $2",
      [id, restaurantId]
    );
  }
}

export const menuService = new MenuService();
