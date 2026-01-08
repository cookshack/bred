# Bred - Browser Editor Thing

## Overview

Bred is an Electron-based code editor that supports multiple editing backends including CodeMirror, Monaco, and Ace. It is designed as a modern, extensible editor with features commonly found in Emacs-style editors, such as advanced navigation, multiple panes, and customizable key bindings.

## Core Architecture

### Electron Framework

The application is built using Electron, separating the codebase into main and renderer processes:

1. **Main Process**: Handles system-level operations, file I/O, and inter-process communication
2. **Renderer Process**: Manages the UI, editing interface, and user interactions

Communication between processes occurs via IPC (Inter-Process Communication) channels.

### Editing Backends

Bred supports three major editing backends:

- **CodeMirror** (Primary): A versatile, modular code editor for the web
- **Monaco**: Microsoft's powerful editor used in VS Code
- **Ace**: A standalone code editor with high performance

Each backend is integrated through adapter modules that expose a consistent API to the rest of the application.

### Key Features

- Multi-pane interface with tabbed browsing
- Emacs-style key bindings and navigation
- Syntax highlighting for numerous programming languages
- File browsing and management capabilities
- Customizable themes (light/dark modes)
- Extension system for additional functionality
- Collaborative editing support
- Integrated terminal functionality
- Language Server Protocol (LSP) integration

## User Interface

### Layout Components

1. **Menu Bar**: Top-level application menus
2. **Tab Bar**: Document tabs for open files
3. **Editing Panes**: Main content areas for file editing
4. **Status Bar**: Informational display at the bottom
5. **Mini Buffer**: Command input and feedback area

### Navigation

Emacs-style navigation is central to the user experience:

- **Movement**: Line-based (C-a, C-e, C-f, C-b) and document-based (C-v, M-v)
- **Searching**: Incremental search (C-s, C-r)
- **Window Management**: Splitting, focusing, and resizing panes
- **File Operations**: Opening, saving, and managing files

## Technical Implementation

### Module System

The codebase follows a modular architecture where each component is contained in its own module file. Core systems include:

- **Buffer Management**: Text buffer representation and manipulation
- **Command System**: Centralized command handling and key bindings
- **Event Handling**: Input processing and event routing
- **File Operations**: Reading, writing, and watching files
- **UI Components**: DOM manipulation and interface elements
- **Pane Management**: Multi-pane layout and navigation

### Configuration

User preferences are stored using Electron Store with hierarchical options:

1. Global application settings
2. Per-user configurations
3. Project-specific options
4. Buffer-local settings

### Extension Points

The system provides several mechanisms for extending functionality:

1. **Modes**: Major and minor editing modes
2. **Commands**: Custom actions and operations
3. **Key Bindings**: Input mappings for commands
4. **Language Support**: Syntax definitions and language-specific features
5. **UI Extensions**: Additional interface components

## Development Approach

### Code Style

Following conventions typical of JavaScript/Node.js projects:

- ES Modules for modern JavaScript imports/exports
- Asynchronous operations for non-blocking I/O
- Functional programming patterns where appropriate
- Event-driven architecture for responsiveness

### Build Process

The application uses standard npm workflows:

1. Dependencies managed through package.json
2. Build scripts for packaging and distribution
3. Development and production configurations
4. Automated testing setup

This specification provides a foundation for understanding Bred's architecture and implementation approach.
