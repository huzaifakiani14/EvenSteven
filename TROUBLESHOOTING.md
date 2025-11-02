# Troubleshooting Google Sign-In

If Google Sign-In is not working, follow these steps:

## 1. Check Firebase Console Settings

### Enable Google Sign-In Provider
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `evensteven-a459f`
3. Navigate to **Authentication** → **Sign-in method**
4. Click on **Google** provider
5. Toggle **Enable** to ON
6. Enter a **Project support email** (your email)
7. Click **Save**

### Add Authorized Domains
1. In Firebase Console, go to **Authentication** → **Settings** → **Authorized domains**
2. Make sure these domains are listed:
   - `localhost` (for local development)
   - `evensteven-a459f.firebaseapp.com`
   - Your Vercel domain (after deployment)
3. Click **Add domain** if `localhost` is missing

## 2. Check Browser Console

Open your browser's Developer Tools (F12) and check the Console tab for errors. Common errors:

- `auth/operation-not-allowed` → Google Sign-In not enabled in Firebase
- `auth/unauthorized-domain` → Domain not in authorized domains list
- `auth/popup-blocked` → Browser is blocking pop-ups
- `auth/popup-closed-by-user` → User closed the pop-up

## 3. Check Environment Variables

Make sure your `.env` file exists and has the correct values:
- File should be in the root directory: `/Users/huzaifakiani/EvenSteven/.env`
- Restart the dev server after creating/editing `.env` file

## 4. Clear Browser Cache

Sometimes cached Firebase config can cause issues:
1. Clear browser cache
2. Or use incognito/private browsing mode

## 5. Check Browser Pop-up Blocker

Make sure your browser is not blocking pop-ups:
- Chrome: Check the address bar for pop-up blocker icon
- Allow pop-ups for `localhost` if needed

## 6. Verify Firebase Config

Check the browser console for the Firebase config debug message:
- Should see: `Firebase Config: { hasConfig: true, authDomain: "...", projectId: "..." }`
- If `hasConfig: false`, check your `.env` file

## 7. Common Fixes

### If you see "operation-not-allowed":
```bash
# Go to Firebase Console → Authentication → Sign-in method
# Enable Google provider
```

### If you see "unauthorized-domain":
```bash
# Go to Firebase Console → Authentication → Settings → Authorized domains
# Add "localhost"
```

### If pop-up doesn't appear:
```bash
# Check browser pop-up blocker settings
# Try in incognito mode
```

## 8. Test the Connection

After making changes:
1. Restart the dev server: `npm run dev`
2. Refresh the browser (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)
3. Try signing in again
4. Check browser console for any errors

