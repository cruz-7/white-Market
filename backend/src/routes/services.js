import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();

// Get all active services (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { service_type, limit = 20, offset = 0, sort = 'rating' } = req.query;
    
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
      .eq('is_active', true);

    if (service_type) {
      query = query.eq('service_type', service_type);
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
      default:
        query = query.order('rating', { ascending: false });
    }

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error } = await query;

    if (error) throw error;

    // Transform data to include user info
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
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Get service by ID
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
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Get reviews for this service
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
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

// Get service types with counts
router.get('/meta/types', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('service_type, id')
      .eq('is_active', true);

    if (error) throw error;

    // Count services per type
    const typeCounts = {};
    (data || []).forEach(service => {
      typeCounts[service.service_type] = (typeCounts[service.service_type] || 0) + 1;
    });

    // Format response
    const types = Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count
    }));

    res.json(types);
  } catch (error) {
    console.error('Error fetching service types:', error);
    res.status(500).json({ error: 'Failed to fetch service types' });
  }
});

// Get provider's services (for dashboard)
router.get('/provider/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching provider services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Create a new service
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      service_type, 
      title, 
      description, 
      price, 
      price_type = 'fixed',
      location,
      availability,
      response_time 
    } = req.body;

    if (!service_type || !title) {
      return res.status(400).json({ error: 'Service type and title are required' });
    }

    const { data, error } = await supabase
      .from('services')
      .insert({
        user_id: userId,
        service_type,
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
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// Update a service
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updates = req.body;

    // First check ownership
    const { data: existing, error: fetchError } = await supabase
      .from('services')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Service not found' });
    }
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this service' });
    }

    // Remove fields that shouldn't be updated by user
    delete updates.user_id;
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
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// Delete a service
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // First check ownership
    const { data: existing, error: fetchError } = await supabase
      .from('services')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Service not found' });
    }
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this service' });
    }

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// Toggle service active status
router.patch('/:id/toggle', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // First check ownership
    const { data: existing, error: fetchError } = await supabase
      .from('services')
      .select('user_id, is_active')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Service not found' });
    }
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this service' });
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
    console.error('Error toggling service:', error);
    res.status(500).json({ error: 'Failed to toggle service status' });
  }
});

// Create a service review
router.post('/:id/reviews', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Get the service to find provider
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('user_id')
      .eq('id', id)
      .single();

    if (serviceError) throw serviceError;
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Can't review your own service
    if (service.user_id === userId) {
      return res.status(400).json({ error: 'Cannot review your own service' });
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

    // Update service rating
    await updateServiceRating(id);

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Helper function to update service rating
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
    console.error('Error updating service rating:', error);
  }
}

// Create a service booking
router.post('/:id/bookings', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { scheduled_date, scheduled_time, notes, price } = req.body;

    // Get the service to find provider
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('user_id, price')
      .eq('id', id)
      .single();

    if (serviceError) throw serviceError;
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Can't book your own service
    if (service.user_id === userId) {
      return res.status(400).json({ error: 'Cannot book your own service' });
    }

    const { data, error } = await supabase
      .from('service_bookings')
      .insert({
        service_id: id,
        customer_id: userId,
        provider_id: service.user_id,
        scheduled_date,
        scheduled_time,
        notes,
        price: price || service.price
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Get user's bookings (as customer or provider)
router.get('/bookings/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { role = 'customer' } = req.query;

    let query = supabase
      .from('service_bookings')
      .select(`
        *,
        services!service_bookings_service_id_fkey(
          id,
          title,
          service_type,
          price
        ),
        users:users_service_bookings_customer_id_fkey(
          id,
          full_name,
          avatar_url
        ),
        provider:users_service_bookings_provider_id_fkey(
          id,
          full_name,
          avatar_url
        )
      `);

    if (role === 'provider') {
      query = query.eq('provider_id', userId);
    } else {
      query = query.eq('customer_id', userId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const bookings = (data || []).map(booking => ({
      id: booking.id,
      service_id: booking.service_id,
      status: booking.status,
      scheduled_date: booking.scheduled_date,
      scheduled_time: booking.scheduled_time,
      notes: booking.notes,
      price: booking.price,
      created_at: booking.created_at,
      service: booking.services,
      customer: booking.users,
      provider: booking.provider
    }));

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Update booking status
router.patch('/bookings/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    // Check if user is the provider
    const { data: existing, error: fetchError } = await supabase
      .from('service_bookings')
      .select('provider_id, customer_id')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only provider or customer can update
    if (existing.provider_id !== userId && existing.customer_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this booking' });
    }

    const { data, error } = await supabase
      .from('service_bookings')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If completed, increment provider's completed_jobs
    if (status === 'completed' && existing.provider_id === userId) {
      await supabase.rpc('increment_completed_jobs', { provider_id: existing.provider_id });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

export default router;
