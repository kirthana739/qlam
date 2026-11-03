export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AtsType = "greenhouse" | "lever" | "ashby";
export type MatchStatus = "new" | "saved" | "skipped" | "queued" | "applied";
export type RunStatus =
  | "queued"
  | "running"
  | "needs_user"
  | "submitted"
  | "failed";
export type Stage =
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "ghosted";
export type EmailCategory =
  | "otp"
  | "confirmation"
  | "interview"
  | "rejection"
  | "other";
export type PlanType = "free" | "starter" | "pro";
export type AnswerSource = "user" | "ai";
export type ApplicationMode = "manual" | "auto";
