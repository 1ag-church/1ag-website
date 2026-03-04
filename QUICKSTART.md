# 🚀 Quick Start Guide

**Get your 1AG Church website live in 30 minutes!**

## ⚡ Super Quick Version

### 1. Supabase Setup (5 minutes)
```
1. Go to app.supabase.com → Create new project
2. Copy Project URL and anon key
3. Run the SQL from README.md to create storage table
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
- [ ] Change admin password in `src/App.jsx`
- [ ] Update giving link in `src/App.jsx`
- [ ] Test admin panel at `yoursite.com/#admin`
- [ ] Add your first sermon and staff members

## 🆘 Stuck?

See the full `README.md` for detailed step-by-step instructions.

**Default Admin Password:** `1agchurch` (change this immediately!)
