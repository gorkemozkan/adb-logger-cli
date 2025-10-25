import { execa } from "execa";
import chalk from "chalk";

export class DeviceManager {
  async checkDevices() {
    try {
      const { stdout } = await execa("adb", ["devices"], {
        timeout: 10000, // 10 second timeout
        killSignal: "SIGTERM",
      });
      const lines = stdout.trim().split("\n").slice(1);

      const devices = lines
        .filter((line) => line.trim() && !line.includes("List of devices"))
        .map((line) => {
          const [id, status] = line.split("\t");
          return {
            id: id.trim(),
            status: status.trim(),
            isValid: id.trim().length > 0 && status.trim().length > 0,
          };
        })
        .filter((device) => device.isValid && device.status === "device");

      return {
        connected: devices.length > 0,
        devices,
        count: devices.length,
      };
    } catch (error) {
      // Handle specific ADB errors
      if (error.code === "ENOENT") {
        return {
          connected: false,
          devices: [],
          count: 0,
          error:
            "ADB not found. Please install Android SDK and add ADB to PATH.",
        };
      } else if (error.code === "ETIMEDOUT") {
        return {
          connected: false,
          devices: [],
          count: 0,
          error: "ADB command timed out. Device may be unresponsive.",
        };
      } else if (error.signal === "SIGTERM") {
        return {
          connected: false,
          devices: [],
          count: 0,
          error: "ADB command was terminated.",
        };
      }

      return {
        connected: false,
        devices: [],
        count: 0,
        error: error.message,
      };
    }
  }

  async getDeviceName(deviceId) {
    try {
      const { stdout } = await execa("adb", [
        "-s",
        deviceId,
        "shell",
        "getprop",
        "ro.product.model",
      ]);
      return stdout.trim() || deviceId;
    } catch {
      return deviceId;
    }
  }

  async isPackageInstalled(packageName, deviceId = null) {
    try {
      const args = deviceId
        ? ["-s", deviceId, "shell", "pm", "list", "packages", packageName]
        : ["shell", "pm", "list", "packages", packageName];

      const { stdout } = await execa("adb", args);
      return stdout.includes(`package:${packageName}`);
    } catch {
      return false;
    }
  }

  async getPackagePid(packageName, deviceId = null) {
    try {
      const args = deviceId
        ? ["-s", deviceId, "shell", "pidof", packageName]
        : ["shell", "pidof", packageName];

      const { stdout } = await execa("adb", args);
      const pid = stdout.trim();
      return pid && pid !== "" ? pid : null;
    } catch {
      return null;
    }
  }

  displayDeviceStatus(deviceInfo) {
    if (!deviceInfo.connected) {
      console.log(chalk.red("❌ No Android devices or emulators connected"));

      if (deviceInfo.error) {
        console.log(chalk.red(`Error: ${deviceInfo.error}`));

        if (deviceInfo.error.includes("ADB not found")) {
          console.log(chalk.yellow("💡 To fix this:"));
          console.log(chalk.gray("  1. Install Android SDK"));
          console.log(
            chalk.gray("  2. Add ADB to your PATH environment variable")
          );
          console.log(chalk.gray("  3. Restart your terminal"));
        } else if (deviceInfo.error.includes("timed out")) {
          console.log(chalk.yellow("💡 Try:"));
          console.log(
            chalk.gray(
              "  1. Restart ADB server: adb kill-server && adb start-server"
            )
          );
          console.log(chalk.gray("  2. Check USB connection"));
          console.log(chalk.gray("  3. Enable USB debugging on your device"));
        }
      } else {
        console.log(
          chalk.yellow(
            "Please connect a device or start an emulator and try again."
          )
        );
      }
      return false;
    }

    if (deviceInfo.count === 1 && deviceInfo.devices.length > 0) {
      console.log(
        chalk.green(
          `✅ Connected to Android device: ${deviceInfo.devices[0].id}`
        )
      );
    } else if (deviceInfo.count > 1) {
      console.log(
        chalk.green(`✅ Connected to ${deviceInfo.count} Android devices:`)
      );
      deviceInfo.devices.forEach((device) => {
        console.log(chalk.cyan(`  - ${device.id}`));
      });
    } else {
      console.log(chalk.yellow("⚠️  Device status unclear"));
      return false;
    }

    return true;
  }

  async waitForDevice(timeoutMs = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const deviceInfo = await this.checkDevices();
      if (deviceInfo.connected) return true;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return false;
  }
}
