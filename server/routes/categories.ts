/**
 * PRYORA Categories API Routes
 */

import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { query, queryOne, run } from '../db/database.js';
import { suggestCategoryForMerchant } from '../services/geminiService.js';

export const categoriesRouter = Router();

// POST /api/categories/suggest - AI-driven auto-categorization based on merchant
categoriesRouter.post('/suggest', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { merchant, type = 'expense', availableCategories } = req.body;

    if (!merchant || typeof merchant !== 'string' || !merchant.trim()) {
      res.status(400).json({ error: 'Merchant name is required.' });
      return;
    }

    let categoriesToUse = availableCategories;
    if (!categoriesToUse || !Array.isArray(categoriesToUse) || categoriesToUse.length === 0) {
      categoriesToUse = query<any>(
        'SELECT id, name FROM categories WHERE user_id = ? AND type = ? AND is_archived = 0 ORDER BY name ASC',
        [userId, type]
      );
    }

    const suggestion = await suggestCategoryForMerchant(merchant.trim(), categoriesToUse);
    res.json({ suggestion });
  } catch (err: any) {
    console.error('Error suggesting category with AI:', err);
    res.status(500).json({ error: 'Could not suggest category.' });
  }
});

// GET /api/categories
categoriesRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const categories = query<any>(
      `SELECT c.id, c.parent_id, c.name, c.type, c.icon, c.color, c.is_archived, c.created_at,
              COUNT(t.id) as transaction_count
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id
       WHERE c.user_id = ?
       GROUP BY c.id
       ORDER BY c.type ASC, c.name ASC`,
      [userId]
    );

    res.json({ categories });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Could not fetch categories.' });
  }
});

// POST /api/categories
categoriesRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { name, type, parentId, icon, color } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }

    const catId = `cat_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO categories (id, user_id, parent_id, name, type, icon, color, is_archived, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        catId,
        userId,
        parentId || null,
        name.trim(),
        type || 'expense',
        icon || 'Tag',
        color || '#6366F1',
        now,
      ]
    );

    const created = queryOne('SELECT * FROM categories WHERE id = ?', [catId]);
    res.status(201).json({ message: 'Category created successfully.', category: created });
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Could not create category.' });
  }
});

// PUT /api/categories/:id
categoriesRouter.put('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const catId = req.params.id;
    const { name, parentId, icon, color, isArchived } = req.body;

    const existing = queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [catId, userId]);
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    run(
      `UPDATE categories 
       SET name = COALESCE(?, name),
           parent_id = COALESCE(?, parent_id),
           icon = COALESCE(?, icon),
           color = COALESCE(?, color),
           is_archived = COALESCE(?, is_archived)
       WHERE id = ? AND user_id = ?`,
      [
        name?.trim(),
        parentId !== undefined ? (parentId || null) : existing.parent_id,
        icon,
        color,
        isArchived !== undefined ? (isArchived ? 1 : 0) : existing.is_archived,
        catId,
        userId,
      ]
    );

    const updated = queryOne('SELECT * FROM categories WHERE id = ?', [catId]);
    res.json({ message: 'Category updated successfully.', category: updated });
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ error: 'Could not update category.' });
  }
});

// DELETE /api/categories/:id
categoriesRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const catId = req.params.id;

    const existing = queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [catId, userId]);
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const txCount = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions WHERE category_id = ?',
      [catId]
    );

    if (txCount && txCount.count > 0) {
      // Archive to protect transaction integrity
      run('UPDATE categories SET is_archived = 1 WHERE id = ?', [catId]);
      res.json({ message: `Category has ${txCount.count} transactions. It was archived to preserve your history.` });
      return;
    }

    run('DELETE FROM categories WHERE id = ? AND user_id = ?', [catId, userId]);
    res.json({ message: 'Category deleted successfully.' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Could not delete category.' });
  }
});
