export type FormFieldType =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "textarea"
  | "select"
  | "file"
  | "checkbox"
  | "radio"
  | "other";

export interface FormField {
  id?: string;
  name?: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
  selector: string;
}

export interface ApplyJobData {
  applicationId: string;
  userId?: string;
  jobId?: string;
}

export interface ApplyResult {
  success: boolean;
  dryRun: boolean;
  confirmationText?: string;
  filledFields: Record<string, string>;
  screenshotPaths: string[];
  submittedAt?: string;
  error?: string;
  needsUser?: boolean;
  needsUserReason?: string;
  unansweredQuestions?: string[];
}
