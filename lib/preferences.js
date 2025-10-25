import storage from "node-persist";
import { join } from "path";
import { mkdir } from "fs/promises";

export class PreferencesManager {
  constructor() {
    this.storageDir = join(process.env.HOME, ".adb-logger-prefs");
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await mkdir(this.storageDir, { recursive: true });
      await storage.init({
        dir: this.storageDir,
        stringify: JSON.stringify,
        parse: JSON.parse,
        encoding: "utf8",
        logging: false,
      });
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize storage: ${error.message}`);
    }
  }

  async get(key, defaultValue = null) {
    await this.initialize();
    return (await storage.getItem(key)) || defaultValue;
  }

  async set(key, value) {
    await this.initialize();
    await storage.setItem(key, value);
  }

  async getRecentApps() {
    return await this.get("recentApps", []);
  }

  async addRecentApp(app) {
    const recentApps = await this.getRecentApps();
    const filtered = recentApps.filter(
      (recent) => recent.packageName !== app.packageName
    );
    const updated = [app, ...filtered].slice(0, 10);
    await this.set("recentApps", updated);
  }

  async getPreferredLogLevel() {
    return await this.get("preferredLogLevel", "I");
  }

  async setPreferredLogLevel(level) {
    await this.set("preferredLogLevel", level);
  }

  async getCustomScanPaths() {
    return await this.get("customScanPaths", []);
  }

  async setCustomScanPaths(paths) {
    await this.set("customScanPaths", paths);
  }

  async getLastUsedPackage() {
    return await this.get("lastUsedPackage");
  }

  async setLastUsedPackage(packageName) {
    await this.set("lastUsedPackage", packageName);
  }

  async clearAll() {
    await this.initialize();
    await storage.clear();
  }
}
