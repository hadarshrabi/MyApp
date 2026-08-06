#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Usage: $0 <branch|tag> <ref-name> <40-character-git-sha>" >&2
  exit 2
}

[[ $# -eq 3 ]] || usage

ref_type=$1
ref_name=$2
git_sha=$3

if [[ ! "$git_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid Git commit SHA: $git_sha" >&2
  exit 1
fi

short_sha=${git_sha:0:12}
sha_tag="sha-${short_sha}"

case "$ref_type" in
  branch)
    if [[ "$ref_name" != "main" ]]; then
      echo "Publishing is only allowed from the main branch" >&2
      exit 1
    fi
    publish_kind=main
    version=main
    tag_suffixes="main,${sha_tag}"
    ;;
  tag)
    if [[ ! "$ref_name" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
      echo "Release tag must be strict Semantic Versioning: vMAJOR.MINOR.PATCH" >&2
      exit 1
    fi
    major=${BASH_REMATCH[1]}
    minor=${BASH_REMATCH[2]}
    patch=${BASH_REMATCH[3]}
    publish_kind=version
    version="${major}.${minor}.${patch}"
    tag_suffixes="${version},${major}.${minor},${major},latest,${sha_tag}"
    ;;
  *)
    echo "Unsupported Git ref type: $ref_type" >&2
    exit 1
    ;;
esac

emit_output() {
  local key=$1
  local value=$2
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "$key" "$value" >> "$GITHUB_OUTPUT"
  else
    printf '%s=%s\n' "$key" "$value"
  fi
}

emit_output publish_kind "$publish_kind"
emit_output version "$version"
emit_output short_sha "$short_sha"
emit_output sha_tag "$sha_tag"
emit_output tag_suffixes "$tag_suffixes"
