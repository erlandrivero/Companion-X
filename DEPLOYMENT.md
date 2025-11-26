# Deployment Guide

## 🚀 Deploying to Netlify

This guide will walk you through deploying your Companion X application to Netlify.

## Prerequisites

- GitHub account
- Netlify account (free tier works!)
- MongoDB Atlas account
- Anthropic API key
- (Optional) Google OAuth credentials
- (Optional) ElevenLabs API key

## Step 1: Prepare Your Repository

### 1.1 Initialize Git (if not already done)

```bash
git init
git add .
git commit -m "Initial commit - Companion X v1.0"
```

### 1.2 Create GitHub Repository

1. Go to [github.com](https://github.com)
2. Click "New repository"
3. Name it: `companion-x`
4. Don't initialize with README (we already have one)
5. Click "Create repository"

### 1.3 Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/companion-x.git
git branch -M main
git push -u origin main
```

## Step 2: Set Up Netlify

### 2.1 Connect Repository

1. Go to [netlify.com](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Choose "GitHub"
4. Authorize Netlify
5. Select your `companion-x` repository

### 2.2 Configure Build Settings

Netlify should auto-detect Next.js settings:

- **Build command**: `npm run build`
- **Publish directory**: `.next`
- **Node version**: 18.x or higher

If not auto-detected, set these manually.

### 2.3 Add Environment Variables

In Netlify dashboard → Site settings → Environment variables, add:

**Required:**
```
MONGODB_URI=mongodb+srv://...
ANTHROPIC_API_KEY=sk-ant-...
NEXTAUTH_URL=https://your-site.netlify.app
NEXTAUTH_SECRET=your-secret-here
```

**Optional (for Google OAuth):**
```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

**Optional (for ElevenLabs):**
```
ELEVENLABS_API_KEY=your-key
ELEVENLABS_VOICE_ID=your-voice-id
ELEVENLABS_MONTHLY_LIMIT=30000
```

**Budget Settings:**
```
DEFAULT_MONTHLY_BUDGET=50
BUDGET_ALERT_THRESHOLD=0.8
```

### 2.4 Deploy

Click "Deploy site" and wait for the build to complete (~2-3 minutes).

## Step 3: Configure Production URLs

### 3.1 Update Google OAuth (if using)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to your OAuth credentials
3. Add authorized redirect URI:
   ```
   https://your-site.netlify.app/api/auth/callback/google
   ```

### 3.2 Update MongoDB Network Access

1. Go to MongoDB Atlas
2. Network Access → Add IP Address
3. Add: `0.0.0.0/0` (allow from anywhere)
   - Or add Netlify's IP ranges for better security

### 3.3 Update NEXTAUTH_URL

In Netlify environment variables:
```
NEXTAUTH_URL=https://your-actual-domain.netlify.app
```

Redeploy after updating.

## Step 4: Custom Domain (Optional)

### 4.1 Add Custom Domain

1. In Netlify: Domain settings → Add custom domain
2. Enter your domain (e.g., `companion-x.com`)
3. Follow DNS configuration instructions

### 4.2 Enable HTTPS

Netlify automatically provisions SSL certificates via Let's Encrypt.

### 4.3 Update Environment Variables

Update `NEXTAUTH_URL` to your custom domain:
```
NEXTAUTH_URL=https://companion-x.com
```

## Step 5: Verify Deployment

### 5.1 Check Build Logs

- Ensure no errors in build process
- Verify all environment variables are set
- Check for any warnings

### 5.2 Test Functionality

Visit your deployed site and test:

- ✅ Homepage loads
- ✅ Authentication works (if configured)
- ✅ Chat functionality
- ✅ Agent creation
- ✅ Voice features
- ✅ Export functionality
- ✅ Database connections

### 5.3 Monitor Performance

Use Netlify Analytics to track:
- Page load times
- API response times
- Error rates
- Traffic patterns

## Continuous Deployment

### Automatic Deploys

Netlify automatically deploys when you push to GitHub:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

### Deploy Previews

Netlify creates preview deployments for pull requests automatically.

### Branch Deploys

Configure branch deploys in Netlify settings for staging environments.

## Troubleshooting

### Build Fails

**Issue**: Build fails with module errors
**Solution**: Ensure all dependencies are in `package.json`

```bash
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

### Environment Variables Not Working

**Issue**: App can't connect to MongoDB or APIs
**Solution**: 
1. Check environment variables in Netlify dashboard
2. Ensure no trailing spaces
3. Redeploy after adding variables

### Authentication Errors

**Issue**: Google OAuth not working
**Solution**:
1. Verify `NEXTAUTH_URL` matches your domain
2. Check Google OAuth redirect URIs
3. Ensure `NEXTAUTH_SECRET` is set

### Database Connection Errors

**Issue**: Can't connect to MongoDB
**Solution**:
1. Check MongoDB network access (allow 0.0.0.0/0)
2. Verify `MONGODB_URI` is correct
3. Ensure database user has proper permissions

### API Rate Limits

**Issue**: Hitting rate limits
**Solution**:
1. Implement caching
2. Use prompt caching for Claude
3. Monitor usage in Netlify Functions logs

## Performance Optimization

### 1. Enable Caching

Already configured in `netlify.toml`:
- Static assets cached for 1 year
- API routes cached appropriately

### 2. Image Optimization

Use Next.js Image component for automatic optimization.

### 3. Code Splitting

Next.js automatically splits code - no action needed.

### 4. Database Indexes

Ensure MongoDB indexes are created:
```bash
npm run db:init
```

## Security Checklist

- ✅ Environment variables not in repository
- ✅ `.env.local` in `.gitignore`
- ✅ HTTPS enabled (automatic with Netlify)
- ✅ CORS configured in `netlify.toml`
- ✅ Rate limiting implemented
- ✅ Input validation on all endpoints
- ✅ Authentication on protected routes

## Monitoring & Maintenance

### Netlify Dashboard

Monitor:
- Build status
- Deploy logs
- Function logs
- Bandwidth usage

### MongoDB Atlas

Monitor:
- Connection count
- Query performance
- Storage usage
- Network traffic

### API Usage

Track:
- Claude API usage (Anthropic dashboard)
- ElevenLabs usage (ElevenLabs dashboard)
- Monthly costs

## Backup Strategy

### Database Backups

MongoDB Atlas provides automatic backups on paid tiers.

For free tier:
1. Export data periodically
2. Use `mongoexport` for collections
3. Store backups securely

### Code Backups

GitHub serves as your code backup:
- Commit regularly
- Use branches for features
- Tag releases

## Scaling Considerations

### Free Tier Limits

**Netlify Free:**
- 100 GB bandwidth/month
- 300 build minutes/month
- 125K function requests/month

**MongoDB Atlas Free:**
- 512 MB storage
- Shared CPU
- 500 connections

**Anthropic:**
- Pay-as-you-go
- No free tier

### Upgrade Path

When you outgrow free tiers:
1. **Netlify Pro** ($19/mo) - More bandwidth & builds
2. **MongoDB M10** ($57/mo) - Dedicated cluster
3. **Anthropic** - Usage-based pricing

## Support & Resources

### Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [Netlify Docs](https://docs.netlify.com)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com)
- [Anthropic Docs](https://docs.anthropic.com)

### Community

- Next.js Discord
- Netlify Community
- MongoDB Community Forums

---

## Quick Deploy Checklist

- [ ] Code pushed to GitHub
- [ ] Netlify site created
- [ ] Environment variables added
- [ ] Build successful
- [ ] Database accessible
- [ ] Authentication working
- [ ] APIs responding
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] Monitoring enabled

**Congratulations! Your Companion X app is now live! 🎉**
