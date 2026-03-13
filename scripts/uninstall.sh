#!/bin/bash
# Cortask Uninstall Script for Mac/Linux
# Usage: curl -fsSL https://raw.githubusercontent.com/cortask/cortask/main/scripts/uninstall.sh | bash

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m'

echo ""
echo -e "${BLUE}⚡ Cortask Uninstaller${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

INSTALL_DIR="$HOME/.cortask"

if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Cortask is not installed.${NC}"
    echo ""
    exit 0
fi

echo -e "${YELLOW}Installation found at:${NC}"
echo -e "${CYAN}  $INSTALL_DIR${NC}"
echo ""
read -p "Are you sure you want to uninstall? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Uninstall cancelled.${NC}"
    exit 0
fi

echo ""

# Unlink CLI
echo -ne "→ Unlinking CLI..."
cd "$INSTALL_DIR"
pnpm -F cortask unlink --global &> /dev/null || true
echo -e " ${GREEN}✓${NC}"

# Remove installation directory
echo -ne "→ Removing files..."
cd "$HOME"
rm -rf "$INSTALL_DIR"
echo -e " ${GREEN}✓${NC}"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Uninstall complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GRAY}Cortask has been removed from your system.${NC}"
echo ""
