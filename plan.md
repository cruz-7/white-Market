

# UG Hustle – Verified Student Services & Gig Marketplace

## Overview
A full-stack, mobile-first marketplace exclusively for University of Ghana students to offer and hire services — powered by Lovable Cloud (Supabase) for authentication, database, storage, and real-time messaging.

**Color Palette:** Teal primary (trust & professionalism) with warm orange accents (energy & action), neutral grays, and clean white backgrounds.

---

## Pages & Features

### 1. Landing Page
- Hero section: **"Earn on Campus. Hire with Trust."** with teal/orange gradient accents
- How it works in 3-4 simple steps with icons
- Two CTAs: "Offer a Service" and "Hire a Student"
- Trending services carousel
- "Top Hustlers of the Week" spotlight section
- Student-style testimonials
- UG campus life imagery and tone throughout

### 2. Authentication & Verification
- Sign up / log in with email & password (UG email encouraged)
- Email verification flow
- Profile setup wizard after signup:
  - Name, profile photo upload (required), skill categories, pricing, availability, Mobile Money number
- Student ID upload for verification (stored in Supabase Storage)
- Admin reviews verification → "Verified UG Student" badge granted
- Profiles table linked to auth, with verification status tracking

### 3. Browse / Marketplace Page
- Grid of service cards showing: title, price, rating, provider photo, verified badge
- Filters: category, price range, rating, availability
- Search bar
- "Trending This Week" highlighted section
- Responsive — card layout on mobile, grid on desktop

### 4. Service Detail Page
- Full service description and photos
- Provider profile card with rating, verification badge, join date
- Reviews & ratings list
- "Request Service" button → opens job request flow
- Estimated delivery time display

### 5. Messaging System
- Real-time in-platform chat between buyer and seller (Supabase real-time)
- Conversation list in dashboard
- Job agreement summary within chat
- Status tracking: Requested → Accepted → In Progress → Completed

### 6. Payments UI (Conceptual — No Real Integration)
- Mobile Money-first payment UX design
- Escrow-style flow visualization: Buyer pays → Platform holds → Released on completion
- Payout schedule and earnings display
- Withdrawal request UI
- All designed for future MoMo API integration

### 7. Student Dashboard
- **For Providers:** Active jobs, earnings summary, rating overview, withdrawal history, profile management
- **For Buyers:** Active requests, past hires, favorite providers
- Notifications panel (job updates, messages, verification status)
- Badges display: Fast Responder, Top Rated, Verified

### 8. Admin Dashboard
- User list with verification status and actions (approve/reject/flag)
- Job/transaction list with status
- Reported disputes view
- Toggle "Featured" users for homepage spotlight
- Basic analytics (total users, active jobs, completed jobs)

### 9. Referral System
- Unique referral link per user
- "Invite Friends" section in dashboard
- Referral tracking (who invited whom)
- Reward display (conceptual — points/credits placeholder)

---

## Database Structure (Lovable Cloud / Supabase)
- **profiles** — name, photo URL, bio, skills, pricing, availability, MoMo number, verification status, verified badge
- **user_roles** — separate table for admin/user roles (security best practice)
- **services** — title, description, category, price, delivery time, images, provider ID
- **reviews** — rating, comment, reviewer, service, created date
- **jobs** — buyer, seller, service, status (requested/accepted/in-progress/completed/disputed), agreed price
- **messages** — sender, receiver, job reference, content, timestamp (real-time enabled)
- **referrals** — referrer, referred user, status
- **verification_requests** — user, student ID file URL, status, admin notes
- **Storage buckets** — profile photos, student ID uploads, service images

---

## Trust & Safety Features
- Verified badge prominently displayed everywhere
- Ratings & reviews after each completed job
- First-time seller soft limits (max active jobs)
- Dispute reporting flow
- Admin moderation tools

---

## Design Principles
- **Mobile-first** — every page designed for phone screens first
- **Trust-heavy** — verification badges, checkmarks, progress indicators everywhere
- **UG-authentic** — warm, community-driven tone; simple language, not corporate
- **Clean & clear** — no clutter, generous whitespace, obvious CTAs

