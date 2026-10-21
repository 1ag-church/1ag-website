# 🚀 Quick Start Guide

**Deploy the website after the shared Supabase staff-access foundation is ready.**

## ⚡ Super Quick Version

### 1. Supabase Setup
```
1. Go to app.supabase.com → Create new project
2. Copy Project URL and anon key
3. Follow database/README.md: install the reviewed private staff-access foundation
4. For a fresh storage table, run database/website-setup.sql
5. Validate grants, RLS and staff access in an isolated preview
```

### 2. GitHub Setup (5 minutes)
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 3. Netlify Deploy (10 minutes)
```
1. app.netlify.com → Import from GitHub
2. Add environment variables:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
3. Deploy!
```

### 4. Domain Setup (10 minutes)
```
1. Netlify → Domain settings → Add domain
2. Your registrar → DNS settings → Add:
   - A record: @ → 75.2.60.5
   - CNAME: www → your-site.netlify.app
3. Wait 15 minutes, enable HTTPS
```

## 📝 Don't Forget

- [ ] Place `1AG_Color_Web.png` in `/public` folder
- [ ] Provision individual Supabase Auth staff accounts with explicit website-admin membership
- [ ] Update giving link in `src/App.jsx`
- [ ] Test admin panel at `yoursite.com/#admin`
- [ ] Add your first sermon and staff members

## 🆘 Stuck?

See the full `README.md` for detailed step-by-step instructions.

Staff Login uses individual Supabase Auth accounts and explicit authorization; there is no shared default admin password. Existing production tables keep their grants. See [database/README.md](database/README.md) before a reset or preview database creation.

