/**
 * Core shared constants, database types, and Zod schemas for Qlam.
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

export * from "./database.types.js";
export * from "./schemas/index.js";
export * from "./ai.js";
export * from "./prompts/parseResume.js";
export * from "./prompts/scoreMatch.js";
export * from "./prompts/tailorResume.js";
export * from "./prompts/coverLetter.js";
export * from "./prompts/answerQuestion.js";
export * from "./truthCheck.js";
export * from "./pdf.js";
export { z } from "zod";
