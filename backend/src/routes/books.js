import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();

// Get all books and notes (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { 
      book_type, subject, course_code, academic_level, 
      condition, min_price, max_price, search,
      limit = 20, offset = 0, sort = 'newest' 
    } = req.query;
    
    let query = supabase
      .from('books_and_notes')
      .select(`
        *,
        users!books_and_notes_user_id_fkey(
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
    if (book_type) {
      query = query.eq('book_type', book_type);
    }
    if (subject) {
      query = query.ilike('subject', `%${subject}%`);
    }
    if (course_code) {
      query = query.ilike('course_code', `%${course_code}%`);
    }
    if (academic_level) {
      query = query.eq('academic_level', academic_level);
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
      query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%,description.ilike.%${search}%`);
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
    const books = (data || []).map(book => ({
      id: book.id,
      user_id: book.user_id,
      title: book.title,
      description: book.description,
      isbn: book.isbn,
      author: book.author,
      edition: book.edition,
      publisher: book.publisher,
      book_type: book.book_type,
      subject: book.subject,
      course_code: book.course_code,
      academic_level: book.academic_level,
      condition: book.condition,
      price: book.price,
      price_negotiable: book.price_negotiable,
      page_count: book.page_count,
      language: book.language,
      location: book.location,
      images: book.images,
      view_count: book.view_count,
      rating: book.rating,
      review_count: book.review_count,
      created_at: book.created_at,
      seller: book.users ? {
        id: book.users.id,
        full_name: book.users.full_name,
        avatar_url: book.users.avatar_url,
        campus: book.users.campus,
        role: book.users.role
      } : null
    }));

    res.json(books);
  } catch (error) {
    console.error('Error fetching books and notes:', error);
    res.status(500).json({ error: 'Failed to fetch books and notes' });
  }
});

// Get book by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First get the book
    const { data: book, error: bookError } = await supabase
      .from('books_and_notes')
      .select(`
        *,
        users!books_and_notes_user_id_fkey(
          id,
          full_name,
          avatar_url,
          campus,
          role
        )
      `)
      .eq('id', id)
      .single();

    if (bookError) throw bookError;

    // Increment view count
    await supabase
      .from('books_and_notes')
      .update({ view_count: (book.view_count || 0) + 1 })
      .eq('id', id);

    // Get reviews
    const { data: reviews } = await supabase
      .from('book_reviews')
      .select(`
        *,
        users!book_reviews_reviewer_id_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('book_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      ...book,
      seller: book.users ? {
        id: book.users.id,
        full_name: book.users.full_name,
        avatar_url: book.users.avatar_url,
        campus: book.users.campus,
        role: book.users.role
      } : null,
      reviews: reviews || []
    });
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ error: 'Failed to fetch book details' });
  }
});

// Create a new book listing
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title, description, isbn, author, edition, publisher,
      book_type, subject, course_code, academic_level,
      condition, price, price_negotiable, page_count, language,
      location, images
    } = req.body;

    if (!title || !book_type || !condition || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('books_and_notes')
      .insert({
        user_id: userId,
        title,
        description,
        isbn,
        author,
        edition,
        publisher,
        book_type,
        subject,
        course_code,
        academic_level,
        condition,
        price,
        price_negotiable: price_negotiable !== false,
        page_count,
        language: language || 'English',
        location,
        images: images || []
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating book listing:', error);
    res.status(500).json({ error: 'Failed to create book listing' });
  }
});

// Update a book listing
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updates = req.body;

    // Check ownership
    const { data: existing, error: checkError } = await supabase
      .from('books_and_notes')
      .select('user_id')
      .eq('id', id)
      .single();

    if (checkError) throw checkError;
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this listing' });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('books_and_notes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error updating book listing:', error);
    res.status(500).json({ error: 'Failed to update book listing' });
  }
});

// Delete a book listing
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Check ownership
    const { data: existing, error: checkError } = await supabase
      .from('books_and_notes')
      .select('user_id')
      .eq('id', id)
      .single();

    if (checkError) throw checkError;
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this listing' });
    }

    const { error } = await supabase
      .from('books_and_notes')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Book listing deleted successfully' });
  } catch (error) {
    console.error('Error deleting book listing:', error);
    res.status(500).json({ error: 'Failed to delete book listing' });
  }
});

// Mark book as sold
router.post('/:id/sold', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Check ownership
    const { data: existing, error: checkError } = await supabase
      .from('books_and_notes')
      .select('user_id')
      .eq('id', id)
      .single();

    if (checkError) throw checkError;
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data, error } = await supabase
      .from('books_and_notes')
      .update({ is_sold: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error marking book as sold:', error);
    res.status(500).json({ error: 'Failed to mark as sold' });
  }
});

// Add review for a book
router.post('/:id/reviews', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Get book to find seller
    const { data: book, error: bookError } = await supabase
      .from('books_and_notes')
      .select('user_id')
      .eq('id', id)
      .single();

    if (bookError) throw bookError;

    // Create review
    const { data: review, error } = await supabase
      .from('book_reviews')
      .insert({
        book_id: id,
        reviewer_id: userId,
        seller_id: book.user_id,
        rating,
        comment
      })
      .select()
      .single();

    if (error) throw error;

    // Update book's average rating
    const { data: reviews } = await supabase
      .from('book_reviews')
      .select('rating')
      .eq('book_id', id);

    if (reviews && reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await supabase
        .from('books_and_notes')
        .update({ 
          rating: avgRating.toFixed(2),
          review_count: reviews.length
        })
        .eq('id', id);
    }

    res.status(201).json(review);
  } catch (error) {
    console.error('Error adding book review:', error);
    res.status(500).json({ error: 'Failed to add review' });
  }
});

// Get user's books
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const { data, error } = await supabase
      .from('books_and_notes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching user books:', error);
    res.status(500).json({ error: 'Failed to fetch user books' });
  }
});

// Get book types/categories
router.get('/meta/types', async (req, res) => {
  try {
    const { data } = await supabase
      .from('books_and_notes')
      .select('book_type')
      .not('book_type', 'is', null);
    
    const types = [...new Set(data?.map(b => b.book_type) || [])];
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch types' });
  }
});

// Get subjects
router.get('/meta/subjects', async (req, res) => {
  try {
    const { data } = await supabase
      .from('books_and_notes')
      .select('subject')
      .not('subject', 'is', null);
    
    const subjects = [...new Set(data?.map(b => b.subject) || [])];
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

export default router;
