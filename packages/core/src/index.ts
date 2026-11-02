/**
 * Core shared constants and interfaces for Qlam.
 */

export const APP_NAME = "Qlam";

export interface WorkspaceInfo {
  name: string;
  version: string;
}

export const coreInfo: WorkspaceInfo = {
  name: "@qlam/core",
  version: "0.1.0",
};
