import type {
  ApplicationMode,
  AtsType,
  EmailCategory,
  Json,
  MatchStatus,
  RunStatus,
  Stage,
} from "./enums.js";

export type JobTables = {
  companies: {
    Row: {
      id: string;
      name: string;
      ats: AtsType;
      board_token: string;
      active: boolean;
      last_synced_at: string | null;
      sync_requested_at: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      name: string;
      ats: AtsType;
      board_token: string;
      active?: boolean;
      last_synced_at?: string | null;
      sync_requested_at?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      name?: string;
      ats?: AtsType;
      board_token?: string;
      active?: boolean;
      last_synced_at?: string | null;
      sync_requested_at?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  jobs: {
    Row: {
      id: string;
      company_id: string;
      ats: AtsType;
      external_id: string;
      title: string;
      location: string | null;
      is_remote: boolean;
      department: string | null;
      description_text: string | null;
      apply_url: string;
      posted_at: string | null;
      embedding: string | null;
      raw: Json;
      is_open: boolean;
      last_seen_at: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      company_id: string;
      ats: AtsType;
      external_id: string;
      title: string;
      location?: string | null;
      is_remote?: boolean;
      department?: string | null;
      description_text?: string | null;
      apply_url: string;
      posted_at?: string | null;
      embedding?: string | null;
      raw?: Json;
      is_open?: boolean;
      last_seen_at?: string;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      company_id?: string;
      ats?: AtsType;
      external_id?: string;
      title?: string;
      location?: string | null;
      is_remote?: boolean;
      department?: string | null;
      description_text?: string | null;
      apply_url?: string;
      posted_at?: string | null;
      embedding?: string | null;
      raw?: Json;
      is_open?: boolean;
      last_seen_at?: string;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  matches: {
    Row: {
      id: string;
      user_id: string;
      job_id: string;
      score: number;
      reasons: Json;
      status: MatchStatus;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      job_id: string;
      score: number;
      reasons?: Json;
      status?: MatchStatus;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      job_id?: string;
      score?: number;
      reasons?: Json;
      status?: MatchStatus;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  tailored_resumes: {
    Row: {
      id: string;
      user_id: string;
      job_id: string;
      base_resume_id: string;
      content: Json;
      pdf_path: string | null;
      approved: boolean;
      cover_letter: string | null;
      truth_check_ok: boolean;
      tailoring_strength: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      job_id: string;
      base_resume_id: string;
      content?: Json;
      pdf_path?: string | null;
      approved?: boolean;
      cover_letter?: string | null;
      truth_check_ok?: boolean;
      tailoring_strength?: string;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      job_id?: string;
      base_resume_id?: string;
      content?: Json;
      pdf_path?: string | null;
      approved?: boolean;
      cover_letter?: string | null;
      truth_check_ok?: boolean;
      tailoring_strength?: string;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  applications: {
    Row: {
      id: string;
      user_id: string;
      job_id: string;
      tailored_resume_id: string | null;
      run_status: RunStatus;
      stage: Stage;
      mode: ApplicationMode;
      attempts: number;
      error: string | null;
      needs_user_reason: string | null;
      filled_fields: Json;
      screenshot_paths: string[];
      confirmation_text: string | null;
      submitted_at: string | null;
      dry_run: boolean;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      job_id: string;
      tailored_resume_id?: string | null;
      run_status?: RunStatus;
      stage?: Stage;
      mode?: ApplicationMode;
      attempts?: number;
      error?: string | null;
      needs_user_reason?: string | null;
      filled_fields?: Json;
      screenshot_paths?: string[];
      confirmation_text?: string | null;
      submitted_at?: string | null;
      dry_run?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      job_id?: string;
      tailored_resume_id?: string | null;
      run_status?: RunStatus;
      stage?: Stage;
      mode?: ApplicationMode;
      attempts?: number;
      error?: string | null;
      needs_user_reason?: string | null;
      filled_fields?: Json;
      screenshot_paths?: string[];
      confirmation_text?: string | null;
      submitted_at?: string | null;
      dry_run?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  emails: {
    Row: {
      id: string;
      user_id: string;
      application_id: string | null;
      from_address: string;
      subject: string;
      text_body: string | null;
      category: EmailCategory;
      otp_code: string | null;
      read: boolean;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      application_id?: string | null;
      from_address: string;
      subject: string;
      text_body?: string | null;
      category?: EmailCategory;
      otp_code?: string | null;
      read?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      application_id?: string | null;
      from_address?: string;
      subject?: string;
      text_body?: string | null;
      category?: EmailCategory;
      otp_code?: string | null;
      read?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
}
