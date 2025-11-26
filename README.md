# Companion X - AI Agent Profile Manager

An intelligent assistant that creates, stores, and manages specialized AI agent profiles. The system routes questions to appropriate agents and evolves profiles over time through reasoning and learning.

## 🚀 Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Authentication**: NextAuth.js v5 with Google OAuth
- **Database**: MongoDB Atlas
- **AI**: Claude API (Haiku for chat, Sonnet for agent creation)
- **Voice**: ElevenLabs + Web Speech API fallback
- **Deployment**: Netlify

## 📋 Prerequisites

Before you begin, ensure you have:

- Node.js 20+ installed
- MongoDB Atlas account (free tier)
- Google Cloud Console project for OAuth
- Anthropic API key (Claude)
- ElevenLabs API key (optional, for voice)

## 🔧 Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/erlandrivero/Companion-X.git
cd Companion-X
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required environment variables:
- `MONGODB_URI` - Your MongoDB connection string
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `NEXTAUTH_URL` - `http://localhost:3000` for development
- `ANTHROPIC_API_KEY` - Your Claude API key

### 4. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret to `.env.local`

### 5. Set Up MongoDB Atlas

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a database user
3. Whitelist your IP address (or use 0.0.0.0/0 for development)
4. Get connection string and add to `.env.local`

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 📁 Project Structure

```
companion-x/
├── app/
│   ├── api/
│   │   └── auth/[...nextauth]/    # NextAuth routes
│   ├── login/                     # Login page
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Home page
├── components/
│   ├── LoginButton.tsx            # Google sign-in button
│   ├── UserMenu.tsx               # User profile menu
│   └── Providers.tsx              # Session provider
├── lib/
│   ├── auth.ts                    # NextAuth configuration
│   ├── mongodb.ts                 # MongoDB connection
│   └── utils.ts                   # Utility functions
├── types/
│   └── user.ts                    # TypeScript types
└── middleware.ts                  # Route protection
```

## 🎯 Development Phases

- ✅ **Phase 0**: Authentication Setup (COMPLETED)
- ✅ **Phase 1**: Project Setup (COMPLETED)
- ✅ **Phase 2**: Database Layer (COMPLETED)
- ✅ **Phase 3**: AI Integration (COMPLETED)
- ✅ **Phase 4**: Voice Integration (COMPLETED)
- ✅ **Phase 5**: Chat Interface (COMPLETED)
- ✅ **Phase 6**: API Routes (COMPLETED)
- ✅ **Phase 7**: Export Functionality (COMPLETED)
- ✅ **Phase 8**: Netlify & GitHub Configuration (COMPLETED)
- ✅ **Phase 9**: UI/UX Polish (COMPLETED)
- ✅ **Phase 10**: Testing & Optimization (COMPLETED)

## 🎉 PROJECT 100% COMPLETE!

## 🔐 Security Notes

- Never commit `.env.local` to version control
- Keep your API keys secure
- Use strong `NEXTAUTH_SECRET` in production
- Update Google OAuth redirect URIs for production deployment

## 📝 License

MIT

## 🤝 Contributing

This is a school project. Contributions are welcome!

## 📧 Contact

For questions or issues, please open a GitHub issue.
