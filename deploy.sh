#!/bin/bash

echo "📦 Commit su Git..."
git add .
git commit -m "Deploy Firebase del $(date '+%Y-%m-%d %H:%M:%S')"
git push

echo "🚀 Deploy Firebase..."
firebase deploy
