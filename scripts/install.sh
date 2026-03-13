#!/bin/bash
# Cortask Installation Script for Mac/Linux
# Usage: curl -fsSL https://cortask.dev/install.sh | bash

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m'

echo ""
echo -e "${BLUE}⚡ Cortask Installer${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check Node.js
echo -ne "→ Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e " ${RED}✗${NC}"
    echo ""
    echo -e "${RED}Node.js is not installed. Please install Node.js 20 or higher:${NC}"
    echo -e "${CYAN}  https://nodejs.org/${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e " ${GREEN}✓ ($NODE_VERSION)${NC}"

MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1 | sed 's/v//')
if [ "$MAJOR_VERSION" -lt 20 ]; then
    echo ""
    echo -e "${YELLOW}⚠ Warning: Node.js 20 or higher is required.${NC}"
    echo -e "${YELLOW}  Current version: $NODE_VERSION${NC}"
    echo -e "${CYAN}  Please upgrade at: https://nodejs.org/${NC}"
    exit 1
fi

# Check pnpm
echo -ne "→ Checking pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo -e " ${RED}✗${NC}"
    echo ""
    echo -e "${YELLOW}Installing pnpm...${NC}"
    npm install -g pnpm
    echo -e "${GREEN}✓ pnpm installed${NC}"
else
    PNPM_VERSION=$(pnpm --version)
    echo -e " ${GREEN}✓ ($PNPM_VERSION)${NC}"
fi

# Setup pnpm global directory
echo -ne "→ Setting up pnpm..."
pnpm setup &> /dev/null || true
echo -e " ${GREEN}✓${NC}"

# Check git
echo -ne "→ Checking git..."
if ! command -v git &> /dev/null; then
    echo -e " ${RED}✗${NC}"
    echo ""
    echo -e "${RED}Git is not installed. Please install Git:${NC}"
    echo -e "${CYAN}  https://git-scm.com/${NC}"
    exit 1
fi
GIT_VERSION=$(git --version)
echo -e " ${GREEN}✓ ($GIT_VERSION)${NC}"

# Set installation directory
INSTALL_DIR="$HOME/.cortask"

# Check if already installed
if [ -d "$INSTALL_DIR" ]; then
    echo ""
    echo -e "${YELLOW}⚠ Cortask is already installed at:${NC}"
    echo -e "${CYAN}  $INSTALL_DIR${NC}"
    echo ""
    read -p "Do you want to reinstall? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Installation cancelled.${NC}"
        exit 0
    fi
    echo ""
    echo -ne "→ Removing existing installation..."
    rm -rf "$INSTALL_DIR"
    echo -e " ${GREEN}✓${NC}"
fi

# Clone repository
echo -ne "→ Cloning repository..."
git clone --quiet https://github.com/cortask-ai/cortask.git "$INSTALL_DIR" 2>&1 > /dev/null
if [ $? -ne 0 ]; then
    echo -e " ${RED}✗${NC}"
    echo ""
    echo -e "${RED}Failed to clone repository${NC}"
    exit 1
fi
echo -e " ${GREEN}✓${NC}"

cd "$INSTALL_DIR"

# Install dependencies
echo -ne "→ Installing dependencies..."
pnpm install --silent &> /dev/null
if [ $? -ne 0 ]; then
    echo -e " ${RED}✗${NC}"
    echo ""
    echo -e "${RED}Failed to install dependencies${NC}"
    exit 1
fi
echo -e " ${GREEN}✓${NC}"

# Build packages
echo -ne "→ Building packages..."
pnpm build --silent &> /dev/null
if [ $? -ne 0 ]; then
    echo -e " ${RED}✗${NC}"
    echo ""
    echo -e "${RED}Failed to build packages${NC}"
    exit 1
fi
echo -e " ${GREEN}✓${NC}"

# Link CLI globally
echo -ne "→ Linking CLI globally..."
pnpm link-cli &> /dev/null
if [ $? -ne 0 ]; then
    echo -e " ${RED}✗${NC}"
    echo ""
    echo -e "${RED}Failed to link CLI${NC}"
    exit 1
fi
echo -e " ${GREEN}✓${NC}"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Installation complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Installed at: ${CYAN}$INSTALL_DIR${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Close and reopen your terminal"
echo -e "  2. Run: ${CYAN}cortask credentials set provider.anthropic.apiKey YOUR_KEY${NC}"
echo -e "  3. Start the server: ${CYAN}cortask serve${NC}"
echo ""
echo -e "${GRAY}Get help: cortask --help${NC}"
echo ""
