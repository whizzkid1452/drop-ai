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
  echo "Usage: pnpm worktree:remove [--internal] <branch-name>"
  echo ""
  echo "Current worktrees:"
  git worktree list
  exit 1
fi

BRANCH="$1"

if [ "$INTERNAL" = true ]; then
  WORKTREE_DIR="worktrees/${BRANCH}"
else
  WORKTREE_DIR="../drop-ai--${BRANCH}"
fi

if [ ! -d "$WORKTREE_DIR" ]; then
  echo "Worktree not found: $WORKTREE_DIR"
  echo ""
  echo "Current worktrees:"
  git worktree list
  exit 1
fi

git worktree remove "$WORKTREE_DIR"

echo "Worktree removed: $WORKTREE_DIR"
