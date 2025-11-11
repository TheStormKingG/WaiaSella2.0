# 🔧 Fixing "API Key Not Configured" Error

## Problem

You're seeing: **"Gemini API key not configured. Get one from https://aistudio.google.com/apikey"**

This means the environment variables aren't being loaded in the deployed version.

## ✅ Quick Fixes

### Fix 1: Wait for GitHub Actions to Complete

The deployment takes 2-3 minutes after pushing. 

**Check if it's done:**
1. Go to: https://github.com/TheStormKingG/WaiaSella2.0/actions
2. Look for the latest workflow run
3. Wait until you see a ✅ green checkmark
4. Hard refresh your site: **Ctrl+Shift+R** (or Cmd+Shift+R on Mac)

### Fix 2: Verify GitHub Secrets Are Added

1. Go to: https://github.com/TheStormKingG/WaiaSella2.0/settings/secrets/actions
2. You should see these 3 secrets:
   - `VITE_AI_SERVICE`
   - `VITE_AI_API_KEY`
   - `VITE_AI_MODEL`
3. If any are missing, add them now
4. After adding, manually trigger deployment:
   - Go to Actions tab
   - Click "Deploy to GitHub Pages"
   - Click "Run workflow" → "Run workflow"

### Fix 3: Clear Browser Cache

The old version might be cached:
1. Open your site: https://thestormkingg.github.io/WaiaSella2.0/
2. Press **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)
3. Or open in Incognito/Private window

### Fix 4: Check Workflow Permissions

GitHub Actions might not have permission to deploy:

1. Go to: https://github.com/TheStormKingG/WaiaSella2.0/settings/actions
2. Under "Workflow permissions":
   - Select **"Read and write permissions"**
   - Check **"Allow GitHub Actions to create and approve pull requests"**
3. Click **Save**
4. Re-run the workflow from Actions tab

### Fix 5: Manual Rebuild

Force a new build with the secrets:

```bash
# In your terminal
git commit --allow-empty -m "Trigger rebuild with API keys"
git push
```

This creates an empty commit that triggers GitHub Actions with your secrets.

## 🔍 Verify Secrets Are Working

Once deployed, open browser console (F12) and look for:
- ✅ `🍌 Using service: gemini`
- ❌ If you see the error, secrets aren't loading

## 🚨 Alternative: Test Locally First

Your local environment should work since `.env.local` has the key:

```bash
npm run dev
```

Open http://localhost:5173 and test AI generation there. If it works locally but not deployed, it's definitely a GitHub secrets issue.

## 📋 Common Issues

### Issue 1: Secrets Added After Workflow Ran
**Solution:** Manually trigger workflow again from Actions tab

### Issue 2: Secrets Have Wrong Names
**Solution:** Names must be EXACTLY:
- `VITE_AI_SERVICE` (not AI_SERVICE)
- `VITE_AI_API_KEY` (not GEMINI_KEY)
- `VITE_AI_MODEL` (not MODEL)

### Issue 3: API Key Invalid
**Solution:** 
1. Test your key at: https://aistudio.google.com/apikey
2. Generate a new one if needed
3. Update GitHub secret
4. Rebuild

### Issue 4: Vite Not Loading Environment Variables
**Solution:** Variable names MUST start with `VITE_` to be exposed to client

## 🎯 Quick Test Command

To verify the key locally:

```bash
# This should show your API key
echo $VITE_AI_API_KEY

# If empty, load from .env.local
source .env.local
```

## ✨ Expected Behavior When Working

When working correctly, you should see:
1. No error modal
2. Loading spinner with "Generating Product Image..."
3. "Image generated successfully! ✓"
4. AI-generated image appears
5. Modal closes automatically

Time: ~2-5 seconds total

## 🆘 Still Not Working?

If none of these work, there might be an issue with the Gemini API key itself:

1. **Test the key manually**: Visit https://aistudio.google.com/apikey
2. **Check quota**: Make sure you haven't exceeded limits
3. **Generate new key**: Create a fresh key and update everywhere
4. **Verify key format**: Should look like: `AIzaSy...` (39 characters)

## 💡 Pro Tip

For immediate testing without waiting for deployment:
```bash
npm run dev
```
This uses your `.env.local` file and should work right away!

