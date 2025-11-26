# Development Guide - Companion X

## Project Structure

```
companion-x/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   └── auth/[...nextauth]/   # NextAuth endpoints
│   ├── login/                    # Login page
│   ├── dashboard/                # (Future) Usage dashboard
│   ├── layout.tsx                # Root layout with SessionProvider
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
├── components/                   # React components
│   ├── LoginButton.tsx           # Google OAuth button
│   ├── UserMenu.tsx              # User profile menu
│   └── Providers.tsx             # Client-side providers
├── lib/                          # Core business logic
│   ├── auth.ts                   # NextAuth configuration
│   ├── mongodb.ts                # MongoDB connection
│   ├── constants.ts              # App constants
│   ├── utils.ts                  # Utility functions
│   ├── usage/                    # Usage tracking
│   │   └── costCalculator.ts    # Cost calculation logic
│   └── utils/                    # Additional utilities
│       └── formatters.ts         # Formatting helpers
├── types/                        # TypeScript definitions
│   ├── user.ts                   # User types
│   ├── agent.ts                  # Agent types
│   ├── conversation.ts           # Conversation types
│   └── usage.ts                  # Usage tracking types
├── middleware.ts                 # Route protection
├── netlify.toml                  # Netlify configuration
├── .env.local                    # Environment variables
└── package.json                  # Dependencies
```

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling
- **Lucide React** - Icons
- **Framer Motion** - Animations

### Backend
- **NextAuth.js v5** - Authentication
- **MongoDB** - Database
- **Anthropic Claude API** - AI models
- **ElevenLabs** - Voice synthesis

### Deployment
- **Netlify** - Hosting and serverless functions
- **GitHub** - Version control

## Development Workflow

### 1. Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### 2. Environment Variables

Required variables in `.env.local`:

```env
# MongoDB
MONGODB_URI=mongodb+srv://...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# NextAuth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Claude API
ANTHROPIC_API_KEY=...

# ElevenLabs
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_MONTHLY_LIMIT=30000

# Budget
DEFAULT_MONTHLY_BUDGET=50
BUDGET_ALERT_THRESHOLD=80
```

### 3. Database Schema

#### Users Collection
- Stores user profiles from Google OAuth
- Tracks usage statistics
- Manages budget limits

#### Agents Collection (Future)
- AI agent profiles
- Expertise and capabilities
- Performance metrics
- Evolution history

#### Conversations Collection (Future)
- Chat messages
- Agent assignments
- Session management

#### Usage Logs Collection (Future)
- API call tracking
- Cost calculation
- Service usage breakdown

## Code Style Guidelines

### TypeScript
- Use strict type checking
- Define interfaces for all data structures
- Avoid `any` type
- Use const assertions for constants

### React Components
- Use functional components with hooks
- Separate client and server components
- Use TypeScript for props
- Keep components focused and small

### File Naming
- Components: PascalCase (e.g., `UserMenu.tsx`)
- Utilities: camelCase (e.g., `formatters.ts`)
- Types: camelCase (e.g., `user.ts`)
- API routes: lowercase (e.g., `route.ts`)

### Import Order
1. External packages
2. Internal lib/utils
3. Components
4. Types
5. Styles

## API Routes Structure

### Authentication
- `POST /api/auth/signin` - Google OAuth
- `POST /api/auth/signout` - Logout
- `GET /api/auth/session` - Get session

### Future Endpoints
- `POST /api/chat` - Send message
- `POST /api/agents/create` - Create agent
- `GET /api/agents/list` - List agents
- `PUT /api/agents/update` - Update agent
- `GET /api/usage/stats` - Usage statistics

## Cost Management

### Claude API Costs
- **Haiku**: $1 input / $5 output per 1M tokens
- **Sonnet**: $3 input / $15 output per 1M tokens
- **Cached**: 90% discount on repeated prompts

### ElevenLabs Costs
- **$5/month plan**: 30,000 characters
- **Fallback**: Free Web Speech API

### Budget Tracking
- Real-time cost calculation
- Monthly usage limits
- Alert thresholds
- Automatic fallback to free services

## Testing Strategy

### Unit Tests (Future)
- Test utility functions
- Test cost calculations
- Test formatters

### Integration Tests (Future)
- Test API routes
- Test database operations
- Test authentication flow

### E2E Tests (Future)
- Test user flows
- Test agent creation
- Test conversations

## Deployment

### Netlify Setup
1. Connect GitHub repository
2. Configure build settings
3. Add environment variables
4. Enable automatic deployments

### Production Checklist
- [ ] Environment variables configured
- [ ] Google OAuth redirect URIs updated
- [ ] MongoDB IP whitelist updated
- [ ] NEXTAUTH_SECRET generated
- [ ] API keys secured
- [ ] Budget limits set

## Troubleshooting

### Common Issues

**MongoDB Connection Error**
- Check connection string format
- Verify IP whitelist
- Confirm database user credentials

**Google OAuth Error**
- Verify redirect URIs
- Check client ID/secret
- Ensure consent screen configured

**Build Errors**
- Clear `.next` folder
- Delete `node_modules` and reinstall
- Check TypeScript errors

**Runtime Errors**
- Check browser console
- Review server logs
- Verify environment variables

## Performance Optimization

### Caching Strategy
- Enable prompt caching for agents
- Cache API responses
- Use MongoDB indexes

### Bundle Optimization
- Code splitting
- Lazy loading components
- Optimize images

### Database Optimization
- Index frequently queried fields
- Limit query results
- Use projection for large documents

## Security Best Practices

### Authentication
- Use secure session storage
- Implement CSRF protection
- Validate all inputs

### API Security
- Rate limiting
- Input sanitization
- Error message sanitization

### Data Protection
- Encrypt sensitive data
- Use environment variables
- Never commit secrets

## Future Enhancements

### Phase 2: Database Layer
- Agent CRUD operations
- Conversation storage
- Usage tracking

### Phase 3: AI Integration
- Claude API wrapper
- Agent matching logic
- Agent creation/evolution

### Phase 4: Voice Features
- ElevenLabs integration
- Web Speech fallback
- Voice controls UI

### Phase 5: Chat Interface
- Real-time messaging
- Agent selection
- Voice input/output

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Guide](https://next-auth.js.org)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Anthropic Claude API](https://docs.anthropic.com)
- [Netlify Docs](https://docs.netlify.com)

## Support

For issues or questions:
1. Check this documentation
2. Review SETUP_GUIDE.md
3. Check GitHub issues
4. Contact project maintainer
