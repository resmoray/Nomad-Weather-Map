#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh is not authenticated. Run: gh auth login -h github.com"
  exit 1
fi

origin_url="$(git remote get-url origin)"
repo_slug="$(printf "%s" "$origin_url" | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')"

if [[ -z "$repo_slug" || "$repo_slug" != */* ]]; then
  echo "Could not derive owner/repo from origin URL: $origin_url"
  exit 1
fi

echo "Configuring repository: $repo_slug"

echo "1) Enable auto-merge + auto-delete branch"
gh api -X PATCH "repos/$repo_slug" \
  -F allow_auto_merge=true \
  -F delete_branch_on_merge=true

echo "2) Set Actions workflow permissions (write + allow PR approve)"
gh api -X PUT "repos/$repo_slug/actions/permissions/workflow" \
  -f default_workflow_permissions=write \
  -F can_approve_pull_request_reviews=true

echo "3) Apply branch protection for main"
gh api -X PUT "repos/$repo_slug/branches/main/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["CI / quality"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo
echo "Repository settings applied."
echo "Manual remaining step: Settings -> Pages -> Source = GitHub Actions"
