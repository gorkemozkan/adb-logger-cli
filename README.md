# ADB Logger CLI

A simple, interactive command-line tool for monitoring Android logs from React Native projects.

## Features

- **Interactive App Selection** - Choose from discovered React Native projects or enter custom package names
- **Smart Project Discovery** - Automatically scans your directories for React Native projects

- **Log Level Filtering** - Filter logs by Verbose, Debug, Info, Warning, Error, or Fatal levels

- **Preferences Memory** - Remembers your recent apps and preferred settings
- **Device Detection** - Automatically detects connected Android devices/emulators

## Installation

### Prerequisites

- Node.js (v14 or higher)
- Android SDK with ADB in your PATH
- Connected Android device or emulator

### Install

```bash
# Clone the repositor
git clone <your-repo-url>
cd adb-logger-cli

# Install dependencies
npm install

# Make it globally available (optional)
npm link
```

## Usage

### Basic Usage

```bash
# Run the CLI
node index.js

# Or if you linked it globally
adb-logger
```

### Interactive Flow

1. **Device Check** - The tool automatically checks for connected Android devices
2. **Project Scan** - Scans your Desktop, Documents, and Projects folders for React Native projects
3. **App Selection** - Choose from:
   - Recently used apps (if any)
   - Discovered React Native projects
   - Enter custom package name
   - Configure scan directories
4. **Log Level** - Select desired log level (V/D/I/W/E/F)
5. **Live Monitoring** - Watch colorized logs in real-time

### Example Session

```
🔍 ADB Logger CLI
Scanning for React Native projects and checking device connection...

✅ Connected to Android device: emulator-5554

? Select an app to monitor:
❯ MyApp (com.example.myapp)
  AnotherApp (com.example.anotherapp)
  Enter custom package name
  Configure scan directories

? Select log level: Info (I) - Info and above

🚀 Starting log monitoring for com.example.myapp
Log level: I
Press Ctrl+C to stop

✅ Found running process (PID: 12345)
```

## Configuration

### Custom Scan Directories

You can add custom directories to scan for React Native projects:

1. Select "Configure scan directories" from the app selection menu
2. Choose "Add new path"
3. Enter the directory path
4. The tool will remember your custom paths

### Preferences

The tool automatically saves:

- Recently used apps (up to 10)
- Preferred log level
- Custom scan directories
- Last used package name

Preferences are stored in `~/.adb-logger-prefs/`

## Development

### Project Structure

- **`index.js`** - Main CLI with interactive prompts
- **`lib/scanner.js`** - Scans directories for React Native projects
- **`lib/preferences.js`** - Manages user preferences and history
- **`lib/device.js`** - Handles Android device detection

### Key Features

- **Smart Scanning** - Recursively finds React Native projects by looking for `AndroidManifest.xml`
- **Depth Limiting** - Prevents infinite recursion with max depth of 5 levels
- **Error Handling** - Graceful handling of permission errors and missing files
- **Cross-Platform** - Works on Windows, macOS, and Linux

## Troubleshooting

### Common Issues

**"No Android devices connected"**

- Ensure your device/emulator is connected
- Enable USB debugging on your device
- Try: `adb kill-server && adb start-server`

**"ADB not found"**

- Install Android SDK
- Add ADB to your PATH environment variable
- Restart your terminal

**"No React Native projects found"**

- Add custom scan directories
- Ensure projects have `android/app/src/main/AndroidManifest.xml`
- Check directory permissions

**"Permission denied"**

- The tool will skip directories it can't access
- Run with appropriate permissions if needed

### Debug Mode

For verbose output, you can modify the code to add debug logging:

```javascript
// In any file, add:
console.log("Debug:", yourVariable);
```
