import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../supabase/client';

export const analysesRouter = Router();

/**
 * GET /api/analyses?limit=10
 * Get recent AI diet analyses for the current user.
 */
analysesRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit), 10) || 10, 50);

    const { data: analyses, error } = await supabaseAdmin
      .from('ai_diet_analyses')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      res.status(500).json({ error: '查询分析记录失败' });
      return;
    }

    res.json({
      analyses: (analyses || []).map((a) => ({
        id: a.id,
        name: a.name,
        calories: a.calories,
        protein: { amount: a.protein_amount, percentage: a.protein_percentage },
        carbs: { amount: a.carbs_amount, percentage: a.carbs_percentage },
        fat: { amount: a.fat_amount, percentage: a.fat_percentage },
        suggestions: {
          optimization: a.optimization_suggestion,
          exercise: a.exercise_suggestion,
        },
        ingredients: [], // lazy load via detail endpoint
        image: a.image,
        createdAt: a.created_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * GET /api/analyses/:id
 * Get a single analysis with ingredients.
 */
analysesRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: analysis, error } = await supabaseAdmin
      .from('ai_diet_analyses')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (error || !analysis) {
      res.status(404).json({ error: '分析记录未找到' });
      return;
    }

    const { data: ingredients } = await supabaseAdmin
      .from('ai_analysis_ingredients')
      .select('name, portion, calories')
      .eq('analysis_id', id);

    res.json({
      analysis: {
        id: analysis.id,
        name: analysis.name,
        calories: analysis.calories,
        protein: { amount: analysis.protein_amount, percentage: analysis.protein_percentage },
        carbs: { amount: analysis.carbs_amount, percentage: analysis.carbs_percentage },
        fat: { amount: analysis.fat_amount, percentage: analysis.fat_percentage },
        suggestions: {
          optimization: analysis.optimization_suggestion,
          exercise: analysis.exercise_suggestion,
        },
        ingredients: ingredients || [],
        image: analysis.image,
        createdAt: analysis.created_at,
      },
    });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/analyses
 * Save a new AI diet analysis with ingredients.
 * Body: { name, calories, protein: {amount, percentage}, carbs, fat, suggestions: {optimization, exercise}, ingredients: [{name, portion, calories}], image }
 */
analysesRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, calories, protein, carbs, fat, suggestions, ingredients, image } = req.body;

    if (!name || !calories || !protein || !carbs || !fat) {
      res.status(400).json({ error: '请提供完整的分析数据' });
      return;
    }

    // Insert analysis
    const { data: analysis, error } = await supabaseAdmin
      .from('ai_diet_analyses')
      .insert({
        user_id: req.userId,
        name,
        calories,
        protein_amount: protein.amount,
        protein_percentage: protein.percentage,
        carbs_amount: carbs.amount,
        carbs_percentage: carbs.percentage,
        fat_amount: fat.amount,
        fat_percentage: fat.percentage,
        optimization_suggestion: suggestions?.optimization || null,
        exercise_suggestion: suggestions?.exercise || null,
        image: image || null,
      })
      .select('*')
      .single();

    if (error) {
      res.status(500).json({ error: '保存分析记录失败' });
      return;
    }

    // Insert ingredients
    if (ingredients && ingredients.length > 0) {
      await supabaseAdmin.from('ai_analysis_ingredients').insert(
        ingredients.map((ing: any) => ({
          analysis_id: analysis.id,
          name: ing.name,
          portion: ing.portion || '',
          calories: ing.calories,
        }))
      );
    }

    res.json({
      analysis: {
        id: analysis.id,
        name: analysis.name,
        calories: analysis.calories,
        protein: { amount: analysis.protein_amount, percentage: analysis.protein_percentage },
        carbs: { amount: analysis.carbs_amount, percentage: analysis.carbs_percentage },
        fat: { amount: analysis.fat_amount, percentage: analysis.fat_percentage },
        suggestions: {
          optimization: analysis.optimization_suggestion,
          exercise: analysis.exercise_suggestion,
        },
        ingredients: ingredients || [],
        image: analysis.image,
        createdAt: analysis.created_at,
      },
    });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});
