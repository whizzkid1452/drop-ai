#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: pnpm worktree:add <branch-name>"
  exit 1
fi

BRANCH="$1"
WORKTREE_DIR="../drop-ai--${BRANCH}"

git worktree add "$WORKTREE_DIR" "$BRANCH" 2>/dev/null \
  || git worktree add -b "$BRANCH" "$WORKTREE_DIR"

cd "$WORKTREE_DIR"
pnpm install

echo ""
echo "Worktree ready: $WORKTREE_DIR"
echo "  cd $WORKTREE_DIR && pnpm dev"
