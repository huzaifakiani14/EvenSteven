#!/bin/bash
# Script to set environment variables in Vercel
# Make sure you're logged in: vercel login

echo "Setting Firebase environment variables in Vercel..."

vercel env add VITE_FIREBASE_API_KEY production <<EOF
AIzaSyA1CMy-4vq66chNB2x2SzqFsQLwXf7KpLU
EOF

vercel env add VITE_FIREBASE_AUTH_DOMAIN production <<EOF
evensteven-a459f.firebaseapp.com
EOF

vercel env add VITE_FIREBASE_PROJECT_ID production <<EOF
evensteven-a459f
EOF

vercel env add VITE_FIREBASE_STORAGE_BUCKET production <<EOF
evensteven-a459f.firebasestorage.app
EOF

vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production <<EOF
959642717735
EOF

vercel env add VITE_FIREBASE_APP_ID production <<EOF
1:959642717735:web:fdc9f3d8bbd68bed8b8802
EOF

vercel env add VITE_FIREBASE_MEASUREMENT_ID production <<EOF
G-BSPE9FM42C
EOF

echo "✅ Environment variables added! Now redeploy: vercel --prod"
