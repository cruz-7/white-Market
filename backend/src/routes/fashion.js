import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();

// Get all fashion items (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { 
      category, gender, size, color, brand, condition,
      min_price, max_price, search,
      limit = 20, offset = 0, sort = 'newest' 
    } = req.query;
    
    let query = supabase
      .from('fashion_items')
      .select(`
        *,
        users!fashion_items_user_id_fkey(
          id,
          full_name,
          avatar_url,
          campus,
          role
        )
      `)
      .eq('is_active', true)
      .eq('is_sold', false);

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }
    if (gender) {
      query = query.eq('gender', gender);
    }
    if (size) {
      query = query.eq('size', size);
    }
    if (color) {
      query = query.ilike('color', `%${color}%`);
    }
    if (brand) {
      query = query.ilike('brand', `%${brand}%`);
    }
    if (condition) {
      query = query.eq('condition', condition);
    }
    if (min_price) {
      query = query.gte('price', parseFloat(min_price));
    }
    if (max_price) {
      query = query.lte('price', parseFloat(max_price));
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,brand.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sort) {
      case 'price_low':
        query = query.order('price', { ascending: true });
        break;
      case 'price_high':
        query = query.order('price', { ascending: false });
        break;
      case 'rating':
        query = query.order('rating', { ascending: false });
        break;
      case 'popular':
        query = query.order('view_count', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
    }

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error } = await query;

    if (error) throw error;

    // Transform data to include user info
    const items = (data || []).map(item => ({
      id: item.id,
      user_id: item.user_id,
      title: item.title,
      description: item.description,
      category: item.category,
      gender: item.gender,
      size: item.size,
      color: item.color,
      brand: item.brand,
      material: item.material,
      pattern: item.pattern,
      condition: item.condition,
      price: item.price,
      price_negotiable: item.price_negotiable,
      original_price: item.original_price,
      location: item.location,
      images: item.images,
      view_count: item.view_count,
      rating: item.rating,
      review_count: item.review_count,
      created_at: item.created_at,
      seller: item.users ? {
        id: item.users.id,
        full_name: item.users.full_name,
        avatar_url: item.users.avatar_url,
        campus: item.users.campus,
        role: item.users.role
      } : null
    }));

    res.json(items);
  } catch (error) {
    console.error('Error fetching fashion items:', error);
    res.status(500).json({ error: 'Failed to fetch fashion items' });
  }
});

// Get fashion item by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First get the item
    const { data: item, error: itemError } = await supabase
      .from('fashion_items')
      .select(`
        *,
        users!fashion_items_user_id_fkey(
          id,
          full_name,
          avatar_url,
          campus,
          role
        )
      `)
      .eq('id', id)
      .single();

    if (itemError) throw itemError;

    // Increment view count
    await supabase
      .from('fashion_items')
      .update({ view_count: (item.view_count || 0) + 1 })
      .eq('id', id);

    // Get reviews
    const { data: reviews } = await supabase
      .from('fashion_reviews')
      .select(`
        *,
        users!fashion_reviews_reviewer_id_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('fashion_item_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      ...item,
      seller: item.users ? {
        id: item.users.id,
        full_name: item.users.full_name,
        avatar_url: item.users.avatar_url,
        campus: item.users.campus,
        role: item.users.role
      } : null,
      reviews: reviews || []
    });
  } catch (error) {
    console.error('Error fetching fashion item:', error);
    res.status(500).json({ error: 'Failed to fetch fashion item details' });
  }
});

// Create a new fashion listing
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title, description, category, gender, size, color,
      brand, material, pattern, condition, price, price_negotiable,
      original_price, location, images
    } = req.body;

    if (!title || !category || !gender || !condition || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('fashion_items')
      .insert({
        user_id: userId,
        title,
        description,
        category,
        gender,
        size,
        color,
        brand,
        material,
        pattern,
        condition,
        price,
        price_negotiable: price_negotiable !== false,
        original_price,
        location,
        images: images || []
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating fashion listing:', error);
    res.status(500).json({ error: 'Failed to create fashion listing' });
  }
});

// Update a fashion listing
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updates = req.body;

    // Check ownership
    const { data: existing, error: checkError } = await supabase
      .from('fashion_items')
      .select('user_id')
      .eq('id', id)
      .single();

    if (checkError) throw checkError;
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this listing' });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('fashion_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error updating fashion listing:', error);
    res.status(500).json({ error: 'Failed to update fashion listing' });
  }
});

// Delete a fashion listing
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Check ownership
    const { data: existing, error: checkError } = await supabase
      .from('fashion_items')
      .select('user_id')
      .eq('id', id)
      .single();

    if (checkError) throw checkError;
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this listing' });
    }

    const { error } = await supabase
      .from('fashion_items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Fashion listing deleted successfully' });
  } catch (error) {
    console.error('Error deleting fashion listing:', error);
    res.status(500).json({ error: 'Failed to delete fashion listing' });
  }
});

// Mark item as sold
router.post('/:id/sold', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Check ownership
    const { data: existing, error: checkError } = await supabase
      .from('fashion_items')
      .select('user_id')
      .eq('id', id)
      .single();

    if (checkError) throw checkError;
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data, error } = await supabase
      .from('fashion_items')
      .update({ is_sold: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error marking item as sold:', error);
    res.status(500).json({ error: 'Failed to mark as sold' });
  }
});

// Add review for a fashion item
router.post('/:id/reviews', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Get item to find seller
    const { data: item, error: itemError } = await supabase
      .from('fashion_items')
      .select('user_id')
      .eq('id', id)
      .single();

    if (itemError) throw itemError;

    // Create review
    const { data: review, error } = await supabase
      .from('fashion_reviews')
      .insert({
        fashion_item_id: id,
        reviewer_id: userId,
        seller_id: item.user_id,
        rating,
        comment
      })
      .select()
      .single();

    if (error) throw error;

    // Update item's average rating
    const { data: reviews } = await supabase
      .from('fashion_reviews')
      .select('rating')
      .eq('fashion_item_id', id);

    if (reviews && reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await supabase
        .from('fashion_items')
        .update({ 
          rating: avgRating.toFixed(2),
          review_count: reviews.length
        })
        .eq('id', id);
    }

    res.status(201).json(review);
  } catch (error) {
    console.error('Error adding fashion review:', error);
    res.status(500).json({ error: 'Failed to add review' });
  }
});

// Get user's fashion items
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const { data, error } = await supabase
      .from('fashion_items')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching user fashion items:', error);
    res.status(500).json({ error: 'Failed to fetch user items' });
  }
});

// Get fashion categories
router.get('/meta/categories', async (req, res) => {
  try {
    const { data } = await supabase
      .from('fashion_items')
      .select('category')
      .not('category', 'is', null);
    
    const categories = [...new Set(data?.map(i => i.category) || [])];
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get brands
router.get('/meta/brands', async (req, res) => {
  try {
    const { data } = await supabase
      .from('fashion_items')
      .select('brand')
      .not('brand', 'is', null);
    
    const brands = [...new Set(data?.map(i => i.brand) || [])];
    res.json(brands);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

export default router;
