# 📋 Deployment Checklist

Use this checklist to make sure you've completed all the necessary steps.

## Pre-Deployment

- [ ] Logo file (`1AG_Color_Web.png`) is in `/public` folder
- [ ] Changed admin password from default in `src/App.jsx`
- [ ] Updated giving URL in `src/App.jsx`
- [ ] Updated contact information (address, phone, email)
- [ ] Updated service times if different from defaults
- [ ] Tested site locally with `npm run dev`

## Supabase Setup

- [ ] Created Supabase account
- [ ] Created new project
- [ ] Ran SQL to create `storage` table
- [ ] Saved Project URL
- [ ] Saved anon key
- [ ] Tested database connection locally

## GitHub Setup

- [ ] Created GitHub repository
- [ ] Initialized git in project folder
- [ ] Pushed code to GitHub
- [ ] Repository is set to private (recommended)

## Netlify Deployment

- [ ] Connected GitHub repository to Netlify
- [ ] Added `VITE_SUPABASE_URL` environment variable
- [ ] Added `VITE_SUPABASE_ANON_KEY` environment variable
- [ ] First deployment completed successfully
- [ ] Tested site at Netlify URL

## Domain Configuration

- [ ] Added custom domain in Netlify
- [ ] Updated DNS A record to point to Netlify
- [ ] Updated DNS CNAME record for www subdomain
- [ ] Waited for DNS propagation (24-48 hours max)
- [ ] SSL certificate provisioned
- [ ] Forced HTTPS enabled
- [ ] Tested site at custom domain

## Optional Integrations

- [ ] Google Calendar API key created
- [ ] Calendar ID added to environment variables
- [ ] Calendar displaying events correctly
- [ ] Tested calendar on live site

## Content Population

- [ ] Logged into admin panel (`yourdomain.com/#admin`)
- [ ] Added real sermon data
- [ ] Added staff member profiles
- [ ] Uploaded staff photos
- [ ] Tested data persistence (refresh page, data stays)

## Final Testing

- [ ] Tested all navigation links
- [ ] Tested on mobile devices
- [ ] Tested admin panel functionality
- [ ] Tested giving button links correctly
- [ ] Checked all images load properly
- [ ] Verified contact information is correct
- [ ] Tested Watch Live button
- [ ] Checked that forms work (if applicable)

## Security

- [ ] Changed default admin password
- [ ] Environment variables are secure (not in code)
- [ ] Supabase RLS policies configured
- [ ] SSL certificate is active and forced
- [ ] No sensitive data in public repository

## Launch

- [ ] Shared website URL with church leadership
- [ ] Provided admin password to authorized staff
- [ ] Set up analytics (Netlify Analytics or Google Analytics)
- [ ] Scheduled first content review/update
- [ ] Created backup of Supabase data

## Post-Launch

- [ ] Monitor for any errors in Netlify logs
- [ ] Check website loads properly from different devices
- [ ] Test from different internet connections
- [ ] Get feedback from team
- [ ] Plan regular content updates

---

## 🎉 Ready to Launch?

If all checkboxes are checked, you're ready to go live!

**Share your new website:**
- Update social media profiles
- Send email to church members
- Add to church bulletins
- Update Google My Business listing

---

**Date Launched:** _______________
**Deployed By:** _______________
**Notes:** _______________________________________________
