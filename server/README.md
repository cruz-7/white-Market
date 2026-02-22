# Server RBAC Notes

## Roles
- `user` (default)
- `seller`
- `admin`

## One-time admin promotion
Run once from a secure backend/CI environment:

```bash
node server/scripts/promote-super-admin.mjs
```

Required env vars:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPER_ADMIN_EMAIL` (set this to `reavugla@st.ug.edu.gh`)

The script is idempotent and records completion in `public.app_settings`.

## Admin route protection
Use both middleware on all `/admin/*` routes:
- `requireAuth`
- `requireAdmin`

Unauthenticated requests return `403`.
Non-admin requests return `403`.
