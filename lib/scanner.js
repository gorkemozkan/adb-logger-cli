import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import { parseString } from "xml2js";

export class ProjectScanner {
  constructor() {
    const home =
      process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
    if (!home) {
      throw new Error(
        "Cannot determine home directory. Please set HOME environment variable."
      );
    }

    this.defaultPaths = [
      join(home, "Desktop"),
      join(home, "Documents"),
      join(home, "Projects"),
    ];

    this.skipDirs = new Set([
      "node_modules",
      ".git",
      ".vscode",
      ".idea",
      "build",
      "dist",
      "coverage",
      ".expo",
      "ios",
      "android",
    ]);
    this.maxDepth = 5;
  }

  async scanProjects(customPaths = []) {
    const allPaths = [...this.defaultPaths, ...customPaths];
    const projects = [];

    for (const path of allPaths) {
      try {
        projects.push(...(await this.scanDirectory(path)));
      } catch (error) {
        console.warn(`Warning: Could not scan ${path}: ${error.message}`);
      }
    }

    return this.deduplicate(projects);
  }

  async scanDirectory(dirPath, depth = 0) {
    if (depth > this.maxDepth) return [];

    try {
      const entries = await readdir(dirPath);
      const projects = [];

      for (const entry of entries) {
        const fullPath = join(dirPath, entry);

        try {
          const stats = await stat(fullPath);
          if (!stats.isDirectory()) continue;

          const manifestPath = join(
            fullPath,
            "android",
            "app",
            "src",
            "main",
            "AndroidManifest.xml"
          );
          const packageInfo = await this.extractPackageInfo(manifestPath);

          if (packageInfo) {
            projects.push({
              name: entry,
              path: fullPath,
              packageName: packageInfo.packageName,
              appName: packageInfo.appName,
            });
          } else if (this.shouldScan(entry)) {
            projects.push(...(await this.scanDirectory(fullPath, depth + 1)));
          }
        } catch {
          continue;
        }
      }

      return projects;
    } catch {
      return [];
    }
  }

  async extractPackageInfo(manifestPath) {
    try {
      const content = await readFile(manifestPath, "utf8");
      const result = await parseString(content);
      const manifest = result.manifest;

      if (!manifest?.$?.package) return null;

      return {
        packageName: manifest.$.package,
        appName:
          manifest.application?.[0]?.$?.["android:label"] ||
          manifest.application?.[0]?.$?.["android:name"] ||
          "Unknown App",
      };
    } catch {
      return null;
    }
  }

  shouldScan(dirName) {
    return !this.skipDirs.has(dirName) && !dirName.startsWith(".");
  }

  deduplicate(projects) {
    const seen = new Set();
    return projects.filter((project) => {
      if (seen.has(project.packageName)) return false;
      seen.add(project.packageName);
      return true;
    });
  }
}
