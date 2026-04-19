export const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "nonbinary", label: "Non-binary" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export const EDUCATION_LEVELS = [
  { value: "less_than_hs", label: "Less than high school" },
  { value: "high_school", label: "High school" },
  { value: "some_college", label: "Some college" },
  { value: "bachelors", label: "Bachelor's degree" },
  { value: "masters", label: "Master's degree" },
  { value: "doctorate", label: "Doctorate" },
] as const;

export const VERIFICATION_FIELDS = [
  { key: "birth_year", label: "Birth year" },
  { key: "gender", label: "Gender" },
  { key: "education", label: "Education" },
  { key: "country", label: "Country" },
  { key: "admin1", label: "State / region" },
  { key: "city", label: "City" },
  { key: "race", label: "Race" },
  { key: "ethnicity", label: "Ethnicity" },
] as const;

export const MIN_RESPONDENT_AGE = 18;
export const MAX_QUESTIONS_PER_SURVEY = 10;
