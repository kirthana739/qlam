import type {
  AnswerSource,
  Json,
  PlanType,
} from "./enums.js";

export type UserTables = {
  profiles: {
    Row: {
      id: string;
      user_id: string;
      name: string | null;
      phone: string | null;
      city: string | null;
      links: Json;
      work_authorization: string | null;
      needs_sponsorship: boolean;
      notice_period_days: number | null;
      expected_salary: string | null;
      preferences: Json;
      inbox_alias: string;
      onboarding_done: boolean;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      name?: string | null;
      phone?: string | null;
      city?: string | null;
      links?: Json;
      work_authorization?: string | null;
      needs_sponsorship?: boolean;
      notice_period_days?: number | null;
      expected_salary?: string | null;
      preferences?: Json;
      inbox_alias: string;
      onboarding_done?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      name?: string | null;
      phone?: string | null;
      city?: string | null;
      links?: Json;
      work_authorization?: string | null;
      needs_sponsorship?: boolean;
      notice_period_days?: number | null;
      expected_salary?: string | null;
      preferences?: Json;
      inbox_alias?: string;
      onboarding_done?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  resumes: {
    Row: {
      id: string;
      user_id: string;
      file_path: string;
      parsed: Json;
      is_default: boolean;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      file_path: string;
      parsed?: Json;
      is_default?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      file_path?: string;
      parsed?: Json;
      is_default?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  answers: {
    Row: {
      id: string;
      user_id: string;
      question_key: string;
      question_text: string;
      answer: string;
      source: AnswerSource;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      question_key: string;
      question_text: string;
      answer: string;
      source?: AnswerSource;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      question_key?: string;
      question_text?: string;
      answer?: string;
      source?: AnswerSource;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  subscriptions: {
    Row: {
      id: string;
      user_id: string;
      plan: PlanType;
      monthly_quota: number;
      used_this_period: number;
      period_end: string | null;
      razorpay_subscription_id: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      plan?: PlanType;
      monthly_quota?: number;
      used_this_period?: number;
      period_end?: string | null;
      razorpay_subscription_id?: string | null;
      status?: string;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      plan?: PlanType;
      monthly_quota?: number;
      used_this_period?: number;
      period_end?: string | null;
      razorpay_subscription_id?: string | null;
      status?: string;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  events: {
    Row: {
      id: string;
      user_id: string;
      type: string;
      data: Json;
      created_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      type: string;
      data?: Json;
      created_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      type?: string;
      data?: Json;
      created_at?: string;
    };
    Relationships: [];
  };
}
