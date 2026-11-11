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
