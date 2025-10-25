#!/usr/bin/env node
import { execa } from "execa";
import chalk from "chalk";
import inquirer from "inquirer";
import { ProjectScanner } from "./lib/scanner.js";
import { PreferencesManager } from "./lib/preferences.js";
import { DeviceManager } from "./lib/device.js";

class AdbLogger {
  constructor() {
    this.scanner = new ProjectScanner();
    this.preferences = new PreferencesManager();
    this.deviceManager = new DeviceManager();
    this.logLevels = {
      V: ["V/", "D/", "I/", "W/", "E/", "F/"],
      D: ["D/", "I/", "W/", "E/", "F/"],
      I: ["I/", "W/", "E/", "F/"],
      W: ["W/", "E/", "F/"],
      E: ["E/", "F/"],
      F: ["F/"],
    };
    this.activeProcesses = new Set();
    this.eventListeners = new Map();
  }

  async run() {
    try {
      console.log(chalk.blue.bold("🔍 ADB Logger CLI"));
      console.log(
        chalk.gray(
          "Scanning for React Native projects and checking device connection...\n"
        )
      );

      const deviceInfo = await this.deviceManager.checkDevices();
      if (!this.deviceManager.displayDeviceStatus(deviceInfo)) {
        process.exit(1);
      }

      await this.preferences.initialize();
      const customPaths = await this.preferences.getCustomScanPaths();
      const projects = await this.scanner.scanProjects(customPaths);

      if (projects.length === 0) {
        console.log(
          chalk.yellow("No React Native projects found in default directories.")
        );
        console.log(
          chalk.gray("You can add custom scan paths in the settings.\n")
        );
      }

      const recentApps = await this.preferences.getRecentApps();
      const selectedApp = await this.selectApp(projects, recentApps);
      const logLevel = await this.selectLogLevel();

      await this.preferences.addRecentApp(selectedApp);
      await this.preferences.setPreferredLogLevel(logLevel);
      await this.preferences.setLastUsedPackage(selectedApp.packageName);

      await this.startLogging(selectedApp.packageName, logLevel);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  }

  async selectApp(projects, recentApps) {
    const choices = [];

    if (recentApps.length > 0) {
      choices.push(new inquirer.Separator("--- Recent Apps ---"));
      recentApps.forEach((app) => {
        choices.push({
          name: `${app.name} (${app.packageName})`,
          value: app,
          short: app.name,
        });
      });
    }

    if (projects.length > 0) {
      if (recentApps.length > 0) {
        choices.push(new inquirer.Separator("--- Discovered Projects ---"));
      }
      projects.forEach((project) => {
        choices.push({
          name: `${project.name} (${project.packageName})`,
          value: project,
          short: project.name,
        });
      });
    }

    choices.push(
      new inquirer.Separator("--- Options ---"),
      { name: "Enter custom package name", value: "custom", short: "Custom" },
      {
        name: "Configure scan directories",
        value: "configure",
        short: "Configure",
      }
    );

    if (choices.length <= 3) {
      const { customPackage } = await inquirer.prompt([
        {
          type: "input",
          name: "customPackage",
          message: "Enter package name:",
          validate: (input) => {
            const trimmed = input.trim();
            if (!trimmed) return "Package name is required";
            if (trimmed.length > 100)
              return "Package name too long (max 100 characters)";
            if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(trimmed)) {
              return "Invalid package name format (use letters, numbers, dots, underscores, hyphens)";
            }
            return true;
          },
        },
      ]);

      return {
        name: "Custom App",
        packageName: customPackage.trim(),
        path: null,
      };
    }

    const { selectedApp } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedApp",
        message: "Select an app to monitor:",
        choices,
        pageSize: 15,
      },
    ]);

    if (selectedApp === "custom") {
      const { customPackage } = await inquirer.prompt([
        {
          type: "input",
          name: "customPackage",
          message: "Enter package name:",
          validate: (input) => {
            const trimmed = input.trim();
            if (!trimmed) return "Package name is required";
            if (trimmed.length > 100)
              return "Package name too long (max 100 characters)";
            if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(trimmed)) {
              return "Invalid package name format (use letters, numbers, dots, underscores, hyphens)";
            }
            return true;
          },
        },
      ]);

      return {
        name: "Custom App",
        packageName: customPackage.trim(),
        path: null,
      };
    }

    if (selectedApp === "configure") {
      await this.configureScanPaths();
      return this.selectApp(projects, recentApps);
    }

    return selectedApp;
  }

  async selectLogLevel() {
    const preferredLevel = await this.preferences.getPreferredLogLevel();

    const { logLevel } = await inquirer.prompt([
      {
        type: "list",
        name: "logLevel",
        message: "Select log level:",
        choices: [
          { name: "Verbose (V) - All logs", value: "V" },
          { name: "Debug (D) - Debug and above", value: "D" },
          { name: "Info (I) - Info and above", value: "I" },
          { name: "Warning (W) - Warnings and errors", value: "W" },
          { name: "Error (E) - Errors only", value: "E" },
          { name: "Fatal (F) - Fatal errors only", value: "F" },
        ],
        default: preferredLevel,
      },
    ]);

    return logLevel;
  }

  async configureScanPaths() {
    const currentPaths = await this.preferences.getCustomScanPaths();

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Configure scan paths:",
        choices: [
          { name: "Add new path", value: "add" },
          { name: "View current paths", value: "view" },
          { name: "Clear all custom paths", value: "clear" },
          { name: "Back to app selection", value: "back" },
        ],
      },
    ]);

    if (action === "add") {
      const { newPath } = await inquirer.prompt([
        {
          type: "input",
          name: "newPath",
          message: "Enter directory path to scan:",
          validate: (input) => (input.trim() ? true : "Path is required"),
        },
      ]);

      await this.preferences.setCustomScanPaths([
        ...currentPaths,
        newPath.trim(),
      ]);
      console.log(chalk.green("✅ Path added successfully"));
    } else if (action === "view") {
      console.log(chalk.cyan("Current custom scan paths:"));
      if (currentPaths.length === 0) {
        console.log(chalk.gray("No custom paths configured"));
      } else {
        currentPaths.forEach((path, index) => {
          console.log(chalk.cyan(`  ${index + 1}. ${path}`));
        });
      }
    } else if (action === "clear") {
      await this.preferences.setCustomScanPaths([]);
      console.log(chalk.green("✅ All custom paths cleared"));
    }
  }

  async startLogging(packageName, logLevel) {
    console.log(chalk.blue(`\n🚀 Starting log monitoring for ${packageName}`));
    console.log(chalk.gray(`Log level: ${logLevel}`));
    console.log(chalk.gray("Press Ctrl+C to stop\n"));

    const pid = await this.deviceManager.getPackagePid(packageName);
    let adbArgs = ["logcat", "-v", "time"];

    if (pid) {
      adbArgs.push(`--pid=${pid}`);
      console.log(chalk.green(`✅ Found running process (PID: ${pid})`));
    } else {
      console.log(
        chalk.yellow(
          `⚠️  App not running, monitoring all logs for package: ${packageName}`
        )
      );
    }

    let adb;
    try {
      adb = execa("adb", adbArgs);
      this.activeProcesses.add(adb);
    } catch (error) {
      console.error(chalk.red("Failed to start ADB logcat:"), error.message);
      return;
    }

    const cleanup = () => {
      if (adb && !adb.killed) {
        adb.kill();
        this.activeProcesses.delete(adb);
      }
      this.removeAllEventListeners();
    };

    const dataHandler = (chunk) => {
      const line = chunk.toString();
      if (!pid && !line.includes(packageName)) return;
      if (!this.matchesLogLevel(line, logLevel)) return;
      this.colorizeLog(line);
    };

    const errorHandler = (err) => {
      console.error(chalk.red("ADB error:"), err.toString());
    };

    const processErrorHandler = (error) => {
      console.error(chalk.red("ADB process error:"), error.message);
      cleanup();
    };

    const sigintHandler = () => {
      console.log(chalk.yellow("\n\n🛑 Stopping log monitoring..."));
      cleanup();
      process.exit(0);
    };

    // Store event listeners for proper cleanup
    this.eventListeners.set(adb, {
      data: dataHandler,
      error: errorHandler,
      processError: processErrorHandler,
      sigint: sigintHandler,
    });

    adb.stdout.on("data", dataHandler);
    adb.stderr.on("data", errorHandler);
    adb.on("error", processErrorHandler);

    // Remove any existing SIGINT handlers to prevent memory leaks
    process.removeAllListeners("SIGINT");
    process.on("SIGINT", sigintHandler);
  }

  removeAllEventListeners() {
    for (const [process, listeners] of this.eventListeners) {
      if (process && !process.killed) {
        process.stdout.removeAllListeners("data");
        process.stderr.removeAllListeners("data");
        process.removeAllListeners("error");
      }
    }
    this.eventListeners.clear();
    process.removeAllListeners("SIGINT");
  }

  matchesLogLevel(line, level) {
    const allowedLevels = this.logLevels[level] || this.logLevels["I"];
    return allowedLevels.some((l) => line.includes(` ${l}`));
  }

  colorizeLog(line) {
    const colors = {
      " F/": chalk.magenta,
      " E/": chalk.red,
      " W/": chalk.yellow,
      " I/": chalk.cyan,
      " D/": chalk.green,
      " V/": chalk.gray,
    };

    for (const [level, colorFn] of Object.entries(colors)) {
      if (line.includes(level)) {
        console.log(colorFn(line));
        return;
      }
    }
    console.log(line);
  }
}

const logger = new AdbLogger();
logger.run().catch((error) => {
  console.error(chalk.red("Fatal error:"), error.message);
  process.exit(1);
});
