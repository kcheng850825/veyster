export type Gender =
  | "female"
  | "male"
  | "nonbinary"
  | "other"
  | "prefer_not_to_say";

export type Education =
  | "less_than_hs"
  | "high_school"
  | "some_college"
  | "bachelors"
  | "masters"
  | "doctorate";

export type Answer = "yes" | "no";

export type VerificationField =
  | "birth_year"
  | "gender"
  | "education"
  | "country"
  | "admin1"
  | "city"
  | "race"
  | "ethnicity";

export type Profile = {
  id: string;
  display_name: string | null;
  birth_year: number | null;
  gender: Gender | null;
  education: Education | null;
  country_code: string | null;
  admin1_code: string | null;
  city_geonameid: number | null;
  race_codes: string[];
  ethnicity_codes: string[];
  onboarded_at: string | null;
};

export type Question = {
  id: string;
  survey_id: string;
  version_id: string;
  question_group_id: string;
  position: number;
  text: string;
  next_on_yes: string | null;
  next_on_no: string | null;
  end_on_yes: boolean;
  end_on_no: boolean;
};

export type SurveyVersion = {
  id: string;
  survey_id: string;
  version_number: number;
  status: "draft" | "open" | "retired";
  created_at: string;
  opened_at: string | null;
  retired_at: string | null;
};

export type ContactFieldKey = "name" | "phone" | "email";

export type ContactFieldConfig = {
  show: boolean;
  required: boolean;
};

export type ContactFields = Partial<Record<ContactFieldKey, ContactFieldConfig>>;

export type Survey = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  status: "draft" | "open" | "closed";
  visibility: "public" | "link_only";
  share_slug: string;
  access_mode: "authenticated" | "open";
  contact_fields: ContactFields;
  payout_mode: "per_question" | "on_complete";
  complete_premium_pct: number;
  verification_fields: VerificationField[];
  is_paid_tier: boolean;
  target_recruits: number | null;
  created_at: string;
  updated_at: string;
  opened_at: string | null;
  closed_at: string | null;
};
