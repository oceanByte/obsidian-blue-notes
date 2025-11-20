#!/bin/bash

# Exit on error
set -e

# Build the plugin
echo "Building plugin..."
pnpm build

# Define destination directory
PLUGIN_ID="blue-notes"

# Use custom path if OBSIDIAN_PLUGINS_DIR is set, otherwise use default
if [ -n "$OBSIDIAN_PLUGINS_DIR" ]; then
  DEST_DIR="$OBSIDIAN_PLUGINS_DIR/$PLUGIN_ID"
else
  DEST_DIR="$HOME/Library/Application Support/obsidian/plugins/$PLUGIN_ID"
fi

# Create destination directory if it doesn't exist
echo "Creating destination directory: $DEST_DIR"
mkdir -p "$DEST_DIR"

# Copy files
echo "Copying files..."
cp main.js "$DEST_DIR/"
cp styles.css "$DEST_DIR/"
cp manifest.json "$DEST_DIR/"

echo "Plugin deployed successfully to $DEST_DIR"
