# Agent Storage & Generic Content Issue

## Where Agents Are Stored

**YES, agents are stored in MongoDB!**

- **Database**: Your MongoDB Atlas connection
- **Collection**: `agents`
- **Location**: `lib/db/agentDb.ts` handles all database operations

## Why You're Seeing Generic Content

### **Root Cause**: Fallback Agent Creation

When you create an agent, the system tries to use **Claude Sonnet** to generate a rich, detailed profile (300-500 words with structure). However, if this fails, it falls back to a generic template.

### **Fallback Trigger Conditions**:
1. **Claude API Error** - API key issue, rate limit, network error
2. **JSON Parsing Error** - Claude's response isn't valid JSON
3. **Missing Fields** - Response doesn't have required fields
4. **Any Exception** - Catches all errors and uses fallback

### **Generic Fallback Template**:
```typescript
{
  name: "Financial Advisor Assistant",
  description: "A specialized assistant focused on financial advisor...",
  systemPrompt: `You are a specialized Financial Advisor Assistant...
  
  Guidelines:
  - Stay within your area of expertise
  - Provide clear, accurate information
  - Be helpful and professional`
}
```

This is **NOT** the rich 300-500 word structured prompt you want!

---

## How to Check What's Actually Stored

### **Option 1: Check MongoDB Directly**
1. Go to MongoDB Atlas
2. Browse Collections → `agents`
3. Look at the `systemPrompt` field
4. If it's short and generic → fallback was used
5. If it's long with emojis and structure → rich version was used

### **Option 2: Check via Agent Detail Modal**
1. Click an agent in sidebar
2. Agent Detail Modal opens
3. Look at "System Prompt" section
4. **Rich version** has:
   - 🎯 Goal:
   - 📖 Backstory:
   - Core Competencies
   - ✅ DO / ❌ DON'T sections
5. **Generic version** has:
   - Simple "You are a..." text
   - Basic guidelines
   - No emojis or structure

### **Option 3: Check Console Logs**
When agent is created, check browser console for:
```
Agent creation error: [error message]
```
This means fallback was used.

---

## Why Fallback Might Be Triggered

### **1. Claude Sonnet API Issues**
```typescript
// In agentCreator.ts line 120
const response = await sendMessageSonnet(userPrompt, {
  systemPrompt,
  enableCaching: true,
  maxTokens: 8192,
  temperature: 0.7,
});
```

**Possible issues**:
- API key not working
- Rate limit exceeded
- Network timeout
- Model not available

### **2. JSON Parsing Failure**
```typescript
// Line 128
const jsonMatch = response.content.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  throw new Error("Invalid response format from Claude");
}
```

**Possible issues**:
- Claude returns text instead of JSON
- JSON is malformed
- Response is truncated

### **3. Missing Required Fields**
```typescript
// Line 136-143
if (!agentData.name || !agentData.description || 
    !agentData.expertise || !agentData.systemPrompt) {
  throw new Error("Missing required fields in agent profile");
}
```

---

## How to Fix

### **Immediate Fix: Add Better Logging**

I'll add detailed logging to see exactly why fallback is triggered:

```typescript
try {
  const response = await sendMessageSonnet(...);
  console.log("✅ Claude Sonnet response received");
  
  const jsonMatch = response.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("❌ No JSON found in response:", response.content);
    throw new Error("Invalid response format");
  }
  
  const agentData = JSON.parse(jsonMatch[0]);
  console.log("✅ Agent data parsed:", {
    name: agentData.name,
    promptLength: agentData.systemPrompt?.length
  });
  
  return agentData;
} catch (error) {
  console.error("❌ Agent creation failed, using fallback:", error);
  return createFallbackAgent(topic, context);
}
```

### **Long-term Fix: Retry Logic**

Add retry mechanism before falling back:
1. Try Claude Sonnet
2. If fails, wait 2 seconds and retry
3. If fails again, try Claude Haiku (cheaper)
4. Only then use fallback

---

## Testing Steps

### **Test 1: Check Existing Agents**
1. Open Agent Detail Modal for any agent
2. Look at System Prompt
3. Is it rich (with emojis) or generic?

### **Test 2: Create New Agent**
1. Open browser console (F12)
2. Create a new agent
3. Watch for logs:
   - "✅ Claude Sonnet response received" = Good!
   - "❌ Agent creation failed" = Using fallback

### **Test 3: Check MongoDB**
1. Go to MongoDB Atlas
2. Collections → `agents`
3. Find recent agent
4. Check `systemPrompt` field length
5. **Rich**: 500-1000+ characters
6. **Generic**: 100-300 characters

---

## Quick Fix Implementation

Let me add better logging and error handling right now...
