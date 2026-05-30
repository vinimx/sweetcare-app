const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// pnpm monorepo: resolve packages from app and workspace root
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

/** TypeScript NodeNext imports use .js suffix; Metro must resolve to .ts/.tsx sources. */
function isMonorepoTypeScriptSource(originModulePath) {
  const origin = originModulePath?.replace(/\\/g, "/") ?? "";
  return origin.includes("/apps/mobile/") || origin.includes("/packages/");
}

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;

  if (moduleName.endsWith(".js") && isMonorepoTypeScriptSource(context.originModulePath)) {
    const base = moduleName.replace(/\.js$/, "");
    for (const ext of [".tsx", ".ts", ".jsx"]) {
      try {
        return resolve(context, base + ext, platform);
      } catch {
        // try next extension
      }
    }
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;
