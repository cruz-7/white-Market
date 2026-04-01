import express from "express";
const router = express.Router();
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Get all books and notes services
router.get('/', async (req, res) => {
  try {
    const { category, condition, level, university, limit = 20, offset = 0, sort = 'rating' } = req.query;
    
    let query = supabase
      .from('services')
      .select(`
        *,
        users!services_user_id_fkey(
          id,
          full_name,
          avatar_url,
          role
        )
      `)
      .eq('is_active', true)
      .eq('service_type', 'books_and_note');

    // Filter by subcategory if provided
    if (category) {
      // Store in location field as JSON for filtering
      query = query.ilike('location', `%${category}%`);
    }

    // Apply sorting
    switch (sort) {
      case 'rating':
        query = query.order('rating', { ascending: false });
        break;
      case 'reviews':
        query = query.order('review_count', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'price_low':
        query = query.order('price', { ascending: true });
        break;
      case 'price_high':
        query = query.order('price', { ascending: false });
        break;
      default:
        query = query.order('rating', { ascending: false });
    }

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error } = await query;

    if (error) throw error;

    // Transform data
    const services = (data || []).map(service => ({
      id: service.id,
      user_id: service.user_id,
      service_type: service.service_type,
      title: service.title,
      description: service.description,
      price: service.price,
      price_type: service.price_type,
      location: service.location,
      availability: service.availability,
      response_time: service.response_time,
      images: service.images || [],
      is_active: service.is_active,
      is_verified: service.is_verified,
      rating: service.rating,
      review_count: service.review_count,
      completed_jobs: service.completed_jobs,
      created_at: service.created_at,
      provider: service.users ? {
        id: service.users.id,
        full_name: service.users.full_name,
        avatar_url: service.users.avatar_url,
        role: service.users.role
      } : null
    }));

    res.json(services);
  } catch (error) {
    console.error('Error fetching books and notes:', error);
    res.status(500).json({ error: 'Failed to fetch books and notes' });
  }
});

// Get books and notes by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('services')
      .select(`
        *,
        users!services_user_id_fkey(
          id,
          full_name,
          avatar_url,
          role
        )
      `)
      .eq('id', id)
      .eq('service_type', 'books_and_note')
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Book or note not found' });
    }

    // Get reviews
    const { data: reviews } = await supabase
      .from('service_reviews')
      .select(`
        *,
        users!service_reviews_reviewer_id_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('service_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    const service = {
      id: data.id,
      user_id: data.user_id,
      service_type: data.service_type,
      title: data.title,
      description: data.description,
      price: data.price,
      price_type: data.price_type,
      location: data.location,
      availability: data.availability,
      response_time: data.response_time,
      images: data.images || [],
      is_active: data.is_active,
      is_verified: data.is_verified,
      rating: data.rating,
      review_count: data.review_count,
      completed_jobs: data.completed_jobs,
      created_at: data.created_at,
      provider: data.users ? {
        id: data.users.id,
        full_name: data.users.full_name,
        avatar_url: data.users.avatar_url,
        role: data.users.role
      } : null,
      reviews: (reviews || []).map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        reviewer: r.users ? {
          id: r.users.id,
          full_name: r.users.full_name,
          avatar_url: r.users.avatar_url
        } : null
      }))
    };

    res.json(service);
  } catch (error) {
    console.error('Error fetching book/note:', error);
    res.status(500).json({ error: 'Failed to fetch book or note' });
  }
});

// Get subcategories for books and notes
router.get('/meta/subcategories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('location, service_type')
      .eq('is_active', true)
      .eq('service_type', 'books_and_note');

    if (error) throw error;

    // Extract unique categories from location field
    const categories = [...new Set((data || []).map(s => s.location).filter(Boolean))];

    res.json(categories);
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ error: 'Failed to fetch subcategories' });
  }
});

// Create a new books and notes listing
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      title, 
      description, 
      price, 
      price_type = 'fixed',
      location,
      availability,
      response_time 
    } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: 'Title and price are required' });
    }

    const { data, error } = await supabase
      .from('services')
      .insert({
        user_id: userId,
        service_type: 'books_and_note',
        title,
        description,
        price,
        price_type,
        location,
        availability,
        response_time
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// Update a books and notes listing
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updates = req.body;

    // Check ownership
    const { data: existing, error: fetchError } = await supabase
      .from('services')
      .select('user_id, service_type')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (existing.service_type !== 'books_and_note') {
      return res.status(400).json({ error: 'Invalid service type' });
    }

    delete updates.user_id;
    delete updates.service_type;
    delete updates.rating;
    delete updates.review_count;
    delete updates.completed_jobs;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// Delete a books and notes listing
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from('services')
      .select('user_id, service_type')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (existing.service_type !== 'books_and_note') {
      return res.status(400).json({ error: 'Invalid service type' });
    }

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Error deleting listing:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

// Toggle active status
router.patch('/:id/toggle', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from('services')
      .select('user_id, is_active, service_type')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (existing.service_type !== 'books_and_note') {
      return res.status(400).json({ error: 'Invalid service type' });
    }

    const { data, error } = await supabase
      .from('services')
      .update({ 
        is_active: !existing.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error toggling status:', error);
    res.status(500).json({ error: 'Failed to toggle status' });
  }
});

// Create a review
router.post('/:id/reviews', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('user_id, service_type')
      .eq('id', id)
      .single();

    if (serviceError) throw serviceError;
    if (!service) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (service.service_type !== 'books_and_note') {
      return res.status(400).json({ error: 'Invalid service type' });
    }
    if (service.user_id === userId) {
      return res.status(400).json({ error: 'Cannot review your own listing' });
    }

    const { data, error } = await supabase
      .from('service_reviews')
      .insert({
        service_id: id,
        reviewer_id: userId,
        provider_id: service.user_id,
        rating,
        comment
      })
      .select()
      .single();

    if (error) throw error;

    // Update rating
    await updateServiceRating(id);

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Helper function
async function updateServiceRating(serviceId) {
  try {
    const { data: reviews } = await supabase
      .from('service_reviews')
      .select('rating')
      .eq('service_id', serviceId);

    if (!reviews || reviews.length === 0) return;

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await supabase
      .from('services')
      .update({ 
        rating: avgRating.toFixed(2),
        review_count: reviews.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', serviceId);
  } catch (error) {
    console.error('Error updating rating:', error);
  }
}

// Create an order/purchase
router.post('/:id/purchase', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { notes } = req.body;

    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('user_id, price, title')
      .eq('id', id)
      .single();

    if (serviceError) throw serviceError;
    if (!service) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (service.user_id === userId) {
      return res.status(400).json({ error: 'Cannot purchase your own item' });
    }

    // Create an order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: userId,
        seller_id: service.user_id,
        product_title: service.title,
        product_price: service.price,
        status: 'pending',
        quantity: 1
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Update completed_jobs for the service
    await supabase
      .from('services')
      .update({ 
        completed_jobs: (service.completed_jobs || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating purchase:', error);
    res.status(500).json({ error: 'Failed to create purchase' });
  }
});

export default router;
