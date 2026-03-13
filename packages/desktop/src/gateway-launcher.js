// Gateway launcher that sets up module resolution for bundled dependencies
const path = require("path");
const Module = require("module");

// Get the resources path (passed as first argument)
const resourcesPath = process.argv[2];

// Add custom module paths
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
  // Redirect @cortask/core to bundled version
  if (request === "@cortask/core") {
    return path.join(resourcesPath, "core-dist", "index.js");
  }
  // Redirect @cortask/gateway to bundled version
  if (request === "@cortask/gateway") {
    return path.join(resourcesPath, "gateway-dist", "index.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain);
};

// Load and start the gateway
const gatewayPath = path.join(resourcesPath, "gateway-dist", "index.js");
require(gatewayPath);
