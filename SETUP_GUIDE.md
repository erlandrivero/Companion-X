# Phase 0 Setup Guide - Authentication

## ✅ What's Been Completed

Phase 0 (Authentication Setup) is now complete! Here's what was built:

### 1. **NextAuth.js v5 Configuration**
- ✅ Google OAuth provider configured
- ✅ MongoDB adapter for session storage
- ✅ Session callbacks for user data
- ✅ Proper TypeScript types

### 2. **Route Protection**
- ✅ Middleware to protect all routes except `/login` and `/api/auth/*`
- ✅ Automatic redirect to login for unauthenticated users
- ✅ Automatic redirect to home for authenticated users on login page

### 3. **UI Components**
- ✅ Beautiful login page with gradient background
- ✅ Google sign-in button with loading states
- ✅ User menu with profile picture and sign-out
- ✅ Session provider wrapper

### 4. **Project Structure**
```
✅ lib/auth.ts              - NextAuth configuration
✅ lib/mongodb.ts           - MongoDB connection with pooling
✅ middleware.ts            - Route protection
✅ app/login/page.tsx       - Login page
✅ app/api/auth/[...nextauth]/route.ts - Auth API routes
✅ components/LoginButton.tsx - Google sign-in button
✅ components/UserMenu.tsx    - User profile menu
✅ components/Providers.tsx   - Session provider
✅ types/user.ts             - User type definitions
✅ .env.example              - Environment variable template
✅ .env.local                - Local environment variables (needs your keys)
```

## 🔧 Next Steps - Before Testing

### 1. Set Up Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Navigate to "APIs & Services" → "Credentials"
4. Click "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure consent screen if prompted
6. Application type: "Web application"
7. Add authorized redirect URI:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
8. Copy the **Client ID** and **Client Secret**

### 2. Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster (M0 tier)
3. Create a database user:
   - Database Access → Add New Database User
   - Choose password authentication
   - Save username and password
4. Whitelist your IP:
   - Network Access → Add IP Address
   - Use `0.0.0.0/0` for development (allow all)
5. Get connection string:
   - Clusters → Connect → Connect your application
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `ai-agent-manager`

### 3. Generate NextAuth Secret

Run this command in your terminal:
```bash
openssl rand -base64 32
```

### 4. Update `.env.local`

Open `.env.local` and fill in your actual values:

```env
# MongoDB - Replace with your actual connection string
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/ai-agent-manager?retryWrites=true&w=majority

# Google OAuth - From Google Cloud Console
GOOGLE_CLIENT_ID=YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_ACTUAL_CLIENT_SECRET

# NextAuth - Generated secret
NEXTAUTH_SECRET=YOUR_GENERATED_SECRET_FROM_OPENSSL
NEXTAUTH_URL=http://localhost:3000

# These can stay as-is for now (will be used in later phases)
ANTHROPIC_API_KEY=sk-ant-xxxxx
ELEVENLABS_API_KEY=xxxxx
ELEVENLABS_VOICE_ID=your-preferred-voice-id
ELEVENLABS_MONTHLY_LIMIT=30000
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEFAULT_MONTHLY_BUDGET=50
BUDGET_ALERT_THRESHOLD=80
```

## 🚀 Testing the Authentication

### 1. Start the Development Server

```bash
npm run dev
```

### 2. Test the Flow

1. Open [http://localhost:3000](http://localhost:3000)
2. You should be redirected to `/login` (not authenticated)
3. Click "Sign in with Google"
4. Complete Google OAuth flow
5. You should be redirected back to home page
6. You should see your profile picture and name in the top-right corner
7. Click your profile → "Sign Out" to test logout

### 3. Verify Database

1. Go to MongoDB Atlas
2. Navigate to your cluster → Browse Collections
3. You should see a new database `ai-agent-manager`
4. Collections should include:
   - `users` - Your user data
   - `accounts` - OAuth account data
   - `sessions` - Active sessions

## 🐛 Troubleshooting

### "Invalid redirect URI" error
- Make sure you added `http://localhost:3000/api/auth/callback/google` to Google Cloud Console
- Check that the URL is exactly correct (no trailing slash)

### "Cannot connect to MongoDB" error
- Verify your connection string is correct
- Check that you replaced `<password>` with actual password
- Ensure your IP is whitelisted in MongoDB Atlas

### "Invalid client" error
- Double-check your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Make sure there are no extra spaces or quotes

### Page keeps redirecting
- Clear your browser cookies
- Check that `NEXTAUTH_URL` matches your actual URL
- Verify `NEXTAUTH_SECRET` is set

## 📝 What's Next?

After authentication is working:

- **Phase 1**: Complete project setup with additional dependencies
- **Phase 2**: Build database layer for agents and conversations
- **Phase 3**: Integrate Claude API for AI functionality
- **Phase 4**: Add voice features with ElevenLabs
- **Phase 5**: Build the chat interface
- And more...

## 🎉 Success Criteria

Phase 0 is complete when:
- ✅ You can sign in with Google
- ✅ Your profile appears in the top-right corner
- ✅ You can sign out successfully
- ✅ User data is stored in MongoDB
- ✅ Protected routes redirect to login when not authenticated

---

**Ready to continue?** Let me know when authentication is working and we'll move to the next phase!
