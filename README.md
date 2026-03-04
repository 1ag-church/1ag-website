# 1AG Church Website - Deployment Guide

Complete step-by-step guide to deploy your church website to Netlify with Supabase backend.

---

## 📋 Prerequisites

Before you begin, make sure you have:
- A GitHub account
- A Netlify account (free tier works great)
- A Supabase account (free tier works great)
- Your domain credentials (GoDaddy, Namecheap, etc.)

---

## 🚀 Part 1: Set Up Supabase Database

### Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click **"New Project"**
3. Fill in the details:
   - **Name**: `1ag-church`
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose the closest to Jerseyville, IL (US East is good)
4. Click **"Create new project"**
5. Wait 2-3 minutes for the project to initialize

### Step 2: Create the Storage Table

1. In your Supabase project, click **"SQL Editor"** in the left sidebar
2. Click **"+ New query"**
3. Paste this SQL code:

```sql
-- Create the storage table for sermons and staff data
CREATE TABLE storage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  shared BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on key and shared combination
CREATE UNIQUE INDEX storage_key_shared_idx ON storage(key, shared);

-- Enable Row Level Security
ALTER TABLE storage ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust in production for security)
CREATE POLICY "Allow all operations" ON storage
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_storage_updated_at
  BEFORE UPDATE ON storage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

4. Click **"Run"** (or press Ctrl/Cmd + Enter)
5. You should see "Success. No rows returned"

### Step 3: Get Your Supabase Credentials

1. Click **"Settings"** (gear icon) in the left sidebar
2. Click **"API"** under Project Settings
3. Copy these two values (you'll need them later):
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

---

## 📦 Part 2: Prepare Your Code for Deployment

### Step 1: Copy Your Logo File

1. Make sure you have your `1AG_Color_Web.png` logo file
2. Place it in the `/public` folder of your project
3. If you don't have a `/public` folder, create one at the root level

### Step 2: Create Environment File

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### Step 3: Test Locally (Optional but Recommended)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`
4. Test that everything works, especially:
   - Adding/editing sermons in the admin panel
   - Adding/editing staff members
   - Make sure data persists after page refresh

---

## 🌐 Part 3: Deploy to Netlify

### Step 1: Push Code to GitHub

1. Go to [https://github.com](https://github.com)
2. Click **"New repository"** (+ icon in top right)
3. Name it `1ag-church-website`
4. Make it **Private** (recommended for church sites)
5. Click **"Create repository"**

6. In your terminal (in the project folder), run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - 1AG Church website"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/1ag-church-website.git
   git push -u origin main
   ```
   (Replace YOUR-USERNAME with your GitHub username)

### Step 2: Connect to Netlify

1. Go to [https://app.netlify.com](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Click **"GitHub"**
4. Authorize Netlify to access your GitHub account
5. Search for and select your `1ag-church-website` repository
6. Configure build settings:
   - **Branch to deploy**: `main`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
7. Click **"Show advanced"** → **"New variable"**
8. Add your environment variables:
   - Variable 1:
     - **Key**: `VITE_SUPABASE_URL`
     - **Value**: Your Supabase URL
   - Variable 2:
     - **Key**: `VITE_SUPABASE_ANON_KEY`
     - **Value**: Your Supabase anon key
9. Click **"Deploy site"**

### Step 3: Wait for Deployment

1. Netlify will start building your site (takes 2-3 minutes)
2. Watch the deploy logs - they should show:
   ```
   Building...
   npm run build
   Build complete
   ```
3. Once done, you'll get a URL like: `https://random-name-12345.netlify.app`
4. Click the URL to test your site!

---

## 🌍 Part 4: Connect Your Custom Domain

### Option A: Domain Purchased Through Netlify

1. In Netlify, go to **"Domain settings"**
2. Click **"Add a domain"**
3. Type your domain (e.g., `1ag.church` or `www.1agchurch.com`)
4. Click **"Register domain"** and follow purchase flow
5. Netlify will automatically configure everything!

### Option B: Domain from Another Registrar (GoDaddy, Namecheap, etc.)

#### Step 1: Add Domain in Netlify

1. In your Netlify site, click **"Domain settings"**
2. Click **"Add a domain"** → **"Add custom domain"**
3. Enter your domain (e.g., `1agchurch.com`)
4. Click **"Verify"**
5. Netlify will show you DNS instructions

#### Step 2: Configure DNS at Your Domain Registrar

**For GoDaddy:**
1. Go to [https://dcc.godaddy.com/manage/dns](https://dcc.godaddy.com/manage/dns)
2. Click your domain
3. Scroll to **"Records"**
4. **Delete** any existing A or CNAME records for @ and www
5. Add these records:
   - **Type**: A Record
     - **Name**: @
     - **Value**: `75.2.60.5` (Netlify's load balancer IP)
   - **Type**: CNAME
     - **Name**: www
     - **Value**: `your-site-name.netlify.app`
6. Click **"Save"**

**For Namecheap:**
1. Go to your domain list
2. Click **"Manage"** next to your domain
3. Go to **"Advanced DNS"**
4. Delete existing A and CNAME records for @ and www
5. Add these records:
   - **Type**: A Record
     - **Host**: @
     - **Value**: `75.2.60.5`
   - **Type**: CNAME Record
     - **Host**: www
     - **Value**: `your-site-name.netlify.app`
6. Save changes

**For Other Registrars:**
- The process is similar - you need to:
  1. Point the apex domain (@) to Netlify's IP: `75.2.60.5`
  2. Point www subdomain to your Netlify URL via CNAME

#### Step 3: Enable HTTPS

1. Back in Netlify, wait 5-60 minutes for DNS to propagate
2. Once DNS is verified, go to **"Domain settings"** → **"HTTPS"**
3. Click **"Verify DNS configuration"**
4. Once verified, click **"Provision certificate"**
5. Wait a few minutes for the SSL certificate to be issued
6. Enable **"Force HTTPS"** to redirect all HTTP traffic to HTTPS

---

## ✅ Part 5: Final Configuration

### Update Google Calendar (Optional)

If you want live calendar integration:

1. Get your Google Calendar ID:
   - Open Google Calendar
   - Click the 3 dots next to your church calendar
   - Click **"Settings and sharing"**
   - Scroll to **"Integrate calendar"**
   - Copy your **Calendar ID**

2. Get a Google API Key:
   - Go to [https://console.cloud.google.com](https://console.cloud.google.com)
   - Create a new project (or select existing)
   - Enable **"Google Calendar API"**
   - Create credentials (API Key)
   - Restrict the key to Google Calendar API

3. Add to Netlify:
   - In Netlify → **"Site settings"** → **"Environment variables"**
   - Add two new variables:
     - `VITE_GOOGLE_CALENDAR_ID`: your calendar ID
     - `VITE_GOOGLE_API_KEY`: your API key
   - Trigger a new deploy

### Update Giving Link

1. In your code, find `GIVING_URL` in `src/App.jsx`
2. Replace with your Tithe.ly or church giving platform URL
3. Commit and push:
   ```bash
   git add .
   git commit -m "Update giving URL"
   git push
   ```
4. Netlify will auto-deploy the changes!

---

## 🔐 Security Best Practices

### Change Admin Password

1. In `src/App.jsx`, find:
   ```javascript
   const ADMIN_PASS = "1agchurch";
   ```
2. Change to a strong password:
   ```javascript
   const ADMIN_PASS = "YourStrongPassword123!";
   ```
3. Commit and push the change

### Secure Your Supabase (Production Ready)

1. Go to Supabase → SQL Editor
2. Update the storage policy to restrict access:
   ```sql
   -- Drop the permissive policy
   DROP POLICY "Allow all operations" ON storage;
   
   -- Create more restrictive policies
   -- Allow read for everyone
   CREATE POLICY "Allow public read" ON storage
     FOR SELECT
     USING (true);
   
   -- Allow write only from your Netlify domain
   CREATE POLICY "Allow authorized write" ON storage
     FOR INSERT, UPDATE, DELETE
     USING (
       current_setting('request.headers')::json->>'origin' 
       LIKE '%your-domain.com%'
     );
   ```

---

## 🎨 Customization

### Upload Your Logo

1. Place your `1AG_Color_Web.png` in the `/public` folder
2. Make sure the filename matches exactly
3. The logo will appear automatically in the navigation

### Update Colors

In `src/App.jsx`, find:
```javascript
const BLUE = "#01A8D7";  // Your brand blue
const DARK = "#212120";  // Your brand dark
```
Change these to match your brand guidelines!

### Update Content

- **Service times**: Search for "Service Times" in `src/App.jsx`
- **Contact info**: Search for "500 Cross Ave" to update address
- **About section**: Edit the "About 1AG Church" content

---

## 🆘 Troubleshooting

### Site won't build on Netlify
- Check the build logs in Netlify
- Make sure all environment variables are set
- Verify `package.json` has all dependencies

### Domain not working
- Wait 24-48 hours for DNS propagation
- Use [https://dnschecker.org](https://dnschecker.org) to verify DNS changes
- Make sure you deleted old A/CNAME records

### Data not saving
- Verify Supabase credentials are correct in Netlify environment variables
- Check Supabase table was created correctly
- Check browser console for errors

### Need Help?
- Netlify Support: [https://answers.netlify.com](https://answers.netlify.com)
- Supabase Support: [https://supabase.com/docs](https://supabase.com/docs)

---

## 📞 Next Steps

1. **Test everything**: Add sermons, edit staff, test on mobile
2. **Update content**: Replace sample data with your actual church info
3. **Set up backups**: Consider exporting your Supabase data monthly
4. **Monitor traffic**: Check Netlify Analytics to see visitor stats
5. **Share with your team**: Give staff the admin password to manage content

---

**Congratulations! Your church website is live! 🎉**

Visit your site at: `https://your-domain.com`
