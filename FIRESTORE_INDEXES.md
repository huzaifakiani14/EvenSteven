# Firestore Indexes Required

## Payments Collection

The app requires a composite index for querying payments by group and date:

**Collection:** `payments`
**Fields:**
- `groupId` (Ascending)
- `createdAt` (Descending)

### How to Create:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes**
4. Click **Create Index**
5. Set:
   - Collection ID: `payments`
   - Query scope: Collection
   - Fields to index:
     - Field: `groupId`, Order: Ascending
     - Field: `createdAt`, Order: Descending
6. Click **Create**

Alternatively, when you first try to query payments, Firebase will show an error with a direct link to create the index.

---

**Note:** Without this index, the payment subscription will fail silently, and balances won't update when payments are recorded.

