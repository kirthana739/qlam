import type {
  AnswerSource,
  ApplicationMode,
  AtsType,
  EmailCategory,
  MatchStatus,
  PlanType,
  RunStatus,
  Stage,
} from "./enums.js";
import type { JobTables } from "./job-tables.js";
import type { UserTables } from "./user-tables.js";

type WithRelationships<T> = {
  [K in keyof T]: T[K] & { Relationships: [] };
};

export type AllTables = WithRelationships<UserTables & JobTables>;

export type Database = {
  public: {
    Tables: AllTables;
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_inbox_alias: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_daily_scoring_count: {
        Args: {
          p_user_id: string;
        };
        Returns: number;
      };
      increment_daily_scoring: {
        Args: {
          p_user_id: string;
          p_increment?: number;
        };
        Returns: number;
      };
      match_jobs: {
        Args: {
          p_user_id: string;
          p_limit?: number;
        };
        Returns: {
          id: string;
          company_id: string;
          company_name: string;
          ats: AtsType;
          title: string;
          location: string | null;
          is_remote: boolean;
          department: string | null;
          description_text: string | null;
          apply_url: string;
          posted_at: string | null;
          similarity: number;
        }[];
      };
    };
    Enums: {
      ats_type: AtsType;
      match_status: MatchStatus;
      run_status: RunStatus;
      stage: Stage;
      email_category: EmailCategory;
      plan_type: PlanType;
      answer_source: AnswerSource;
      application_mode: ApplicationMode;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TableInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TableUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
