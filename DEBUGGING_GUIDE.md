# Debugging Guide - Firestore Write Operations

## ✅ What Was Fixed

### 1. **Timeout Protection**
- Added 15-second timeout wrapper for all Firestore write operations
- Prevents infinite hangs - operations will fail with a timeout error after 15 seconds
- Error message: "Request timed out. Please check your internet connection and try again."

### 2. **Authentication Verification**
- Now verifies `auth.currentUser` exists before attempting writes
- Verifies `createdBy` matches the signed-in user's UID
- Prevents writes with mismatched user IDs

### 3. **Comprehensive Logging**
- Added detailed console logging at every step:
  - `[handleCreateGroup]` - Component-level logging
  - `[createGroup]` - Service-level logging
  - `[handleCreateExpense]` - Component-level logging
  - `[createExpense]` - Service-level logging
- Logs include: user IDs, document data, error codes, error messages, stack traces

### 4. **Better Error Messages**
- Specific error messages for:
  - Permission denied
  - Timeout
  - Unavailable service
  - Authentication issues

## 🔍 How to Debug in Production

### Step 1: Open Browser Console
1. Open your deployed app in a browser
2. Press `F12` or `Cmd+Option+I` (Mac) to open DevTools
3. Go to the **Console** tab

### Step 2: Try Creating a Group
1. Click "Create Group"
2. Enter a group name
3. Click "Create"
4. **Watch the console** for log messages

### Step 3: Check Console Output

**Expected Success Flow:**
```
[handleCreateGroup] Starting group creation: {userId: "...", groupName: "..."}
[handleCreateGroup] Calling createGroup...
[createGroup] Starting group creation: {createdBy: "...", currentUser: "...", ...}
[createGroup] Document to create: {name: "...", createdBy: "...", ...}
[createGroup] Group created successfully: "abc123"
[handleCreateGroup] Group created, newGroupId: "abc123"
[handleCreateGroup] Navigating to group: "abc123"
```

**If You See Errors:**

#### Error: "You must be signed in to create a group"
- **Problem:** User is not authenticated
- **Fix:** Sign out and sign back in

#### Error: "Permission denied..."
- **Problem:** Firestore security rules are blocking the write
- **Fix:** 
  1. Go to Firebase Console → Firestore Database → Rules
  2. Verify rules match `FIRESTORE_RULES.txt`
  3. Make sure the rule allows: `request.auth.uid == request.resource.data.createdBy`

#### Error: "Request timed out..."
- **Problem:** Firestore is not responding (network issue, missing index, etc.)
- **Fix:**
  1. Check internet connection
  2. Check Firebase Console → Firestore Database → Indexes
  3. Verify all required indexes are created and enabled

#### Error: "Operation timed out after 15000ms"
- **Problem:** The timeout wrapper caught a hanging operation
- **Fix:** This means Firestore never responded. Check:
  1. Firebase project is active
  2. Environment variables are correct in Vercel
  3. Firestore is enabled in Firebase Console

### Step 4: Check Network Tab
1. Go to **Network** tab in DevTools
2. Filter by "firestore" or "googleapis"
3. Try creating a group/expense
4. Look for:
   - **Pending requests** (red) = Firestore is not responding
   - **403 Forbidden** = Permission denied (security rules issue)
   - **404 Not Found** = Wrong Firebase project ID or collection name

## 🐛 Common Issues and Solutions

### Issue: "Creating..." button stays stuck
**Cause:** Operation is hanging (no timeout, no error)
**Solution:** The timeout wrapper should now catch this and show an error after 15 seconds

### Issue: No console logs appear
**Cause:** Console might be filtered or logs are being suppressed
**Solution:** 
1. Clear console filter
2. Make sure "Verbose" logs are enabled
3. Check if browser extensions are blocking console logs

### Issue: "Permission denied" but rules look correct
**Possible Causes:**
1. Rules not published (click "Publish" in Firebase Console)
2. User UID doesn't match `createdBy` field
3. `request.resource.data.createdBy` is not set correctly

**Debug:**
- Check console log: `[createGroup] Document to create:` - verify `createdBy` matches user UID
- Check Firebase Console → Authentication → Users - verify user exists

### Issue: Timeout errors
**Possible Causes:**
1. Missing Firestore indexes
2. Network connectivity issues
3. Firebase project is paused/disabled

**Debug:**
1. Check Firebase Console → Firestore Database → Indexes
2. Look for any indexes with "Error" status
3. Check Firebase Console → Project Settings → General - verify project is active

## 📋 Checklist for Production

- [ ] All environment variables set in Vercel
- [ ] Firestore security rules match `FIRESTORE_RULES.txt`
- [ ] All Firestore indexes are created and enabled
- [ ] Firebase project is active (not paused)
- [ ] Authorized domains include your Vercel domain
- [ ] Browser console shows detailed logs
- [ ] Network tab shows successful Firestore requests

## 🚀 Next Steps

1. **Deploy the latest changes** (already pushed to GitHub)
2. **Open browser console** when testing
3. **Try creating a group/expense** and watch the console
4. **Share the console logs** if issues persist - the detailed logging will help identify the exact problem

The timeout and logging should now make it clear what's happening when operations fail!

