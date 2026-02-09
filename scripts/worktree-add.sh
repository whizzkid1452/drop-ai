#!/bin/bash
set -e

INTERNAL=false

while [[ "$1" == -* ]]; do
  case "$1" in
    --internal|-i)
      INTERNAL=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [ -z "$1" ]; then
  echo "Usage: pnpm worktree:add [--internal] <branch-name>"
  exit 1
fi

BRANCH="$1"

if [ "$INTERNAL" = true ]; then
  WORKTREE_DIR="worktrees/${BRANCH}"
  mkdir -p worktrees
else
  WORKTREE_DIR="../drop-ai--${BRANCH}"
fi

if [ -d "$WORKTREE_DIR" ]; then
  echo "Directory already exists: $WORKTREE_DIR"
  echo "  Remove it first: pnpm worktree:remove $BRANCH"
  exit 1
fi

git worktree add "$WORKTREE_DIR" "$BRANCH" 2>/dev/null \
  || git worktree add -b "$BRANCH" "$WORKTREE_DIR"

cd "$WORKTREE_DIR"
pnpm install

echo ""
echo "Worktree ready: $WORKTREE_DIR"
echo "  cd $WORKTREE_DIR && pnpm dev"
