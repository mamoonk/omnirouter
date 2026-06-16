#!/usr/bin/env bash
set -euo pipefail

REPO="mamoonk/omnirouter"
APP_NAME="Omni-Router"
INSTALL_DIR="/Applications"

# ── colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}▸ $*${RESET}"; }
success() { echo -e "${GREEN}✔ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }
die()     { echo -e "${RED}✖ $*${RESET}" >&2; exit 1; }

# ── platform check ────────────────────────────────────────────────────────────
[[ "$(uname)" == "Darwin" ]] || die "This installer is for macOS only."

# ── detect architecture ───────────────────────────────────────────────────────
ARCH="$(uname -m)"
case "$ARCH" in
  arm64)  DMG_ARCH="arm64" ;;
  x86_64) DMG_ARCH="x64"   ;;
  *)      die "Unsupported architecture: $ARCH" ;;
esac

info "Detected architecture: $ARCH"

# ── resolve latest release ────────────────────────────────────────────────────
info "Fetching latest release from GitHub…"
LATEST_URL="https://api.github.com/repos/${REPO}/releases/latest"

if command -v curl &>/dev/null; then
  RELEASE_JSON="$(curl -fsSL "$LATEST_URL")"
else
  die "curl is required but not found."
fi

VERSION="$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\(.*\)".*/\1/')"
[[ -n "$VERSION" ]] || die "Could not determine latest version. Is the repo public with a release published?"

info "Latest version: ${BOLD}${VERSION}${RESET}"

# ── find the matching DMG asset ───────────────────────────────────────────────
DMG_URL="$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep -i "\.dmg" | grep -i "$DMG_ARCH" | head -1 | sed 's/.*"browser_download_url": *"\(.*\)".*/\1/')"
[[ -n "$DMG_URL" ]] || die "No DMG found for arch=${DMG_ARCH} in release ${VERSION}. Check https://github.com/${REPO}/releases"

info "Downloading ${APP_NAME} ${VERSION} (${DMG_ARCH})…"

# ── download ──────────────────────────────────────────────────────────────────
TMP_DIR="$(mktemp -d)"
DMG_PATH="${TMP_DIR}/${APP_NAME}-${VERSION}-${DMG_ARCH}.dmg"
trap 'rm -rf "$TMP_DIR"' EXIT

curl -fL --progress-bar -o "$DMG_PATH" "$DMG_URL"

# ── mount & install ───────────────────────────────────────────────────────────
info "Mounting disk image…"
MOUNT_POINT="$(mktemp -d)"
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_POINT" -nobrowse -quiet

APP_SRC="$(find "$MOUNT_POINT" -maxdepth 1 -name "*.app" | head -1)"
[[ -n "$APP_SRC" ]] || { hdiutil detach "$MOUNT_POINT" -quiet; die "No .app bundle found in DMG."; }

DEST="${INSTALL_DIR}/${APP_NAME}.app"

if [[ -d "$DEST" ]]; then
  warn "${APP_NAME}.app already exists in ${INSTALL_DIR} — replacing it."
  rm -rf "$DEST"
fi

info "Installing ${APP_NAME}.app to ${INSTALL_DIR}…"
cp -R "$APP_SRC" "$DEST"

hdiutil detach "$MOUNT_POINT" -quiet

# ── clear quarantine flag ────────────────────────────────────────────────────
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

success "${APP_NAME} ${VERSION} installed successfully!"
echo -e "  ${BOLD}Open it:${RESET}  open '${DEST}'"
echo -e "  ${BOLD}Or run:${RESET}   open -a '${APP_NAME}'"
