// Mirrors the backend response models in Backend/main.py.

export type Me = {
  user_id: string;
  profile: {
    email: string;
    full_name: string | null;
    school_name: string | null;
    school_type?: string | null;
    academic_year?: string | null;
    major: string | null;
    naming_style: string;
    school_domain?: string | null;
    lms_provider?: 'brightspace' | 'canvas' | null;
    lms_host?: string | null;
  } | null;
  subscription: { tier: 'free' | 'pro'; is_pro: boolean; is_founding_member: boolean };
  has_completed_onboarding: boolean;
};

export type Subscription = {
  tier: 'free' | 'pro';
  is_pro: boolean;
  is_founding_member: boolean;
  billing_source: 'stripe' | 'app_store' | 'founding' | string | null;
  iap_expires_at: string | null;
  is_trial?: boolean;
  period_end?: string | null;
  ai_generations_used: number;
  ai_generations_max: number | null;
  chat_messages_used: number;
  chat_messages_max: number | null;
};

export type Course = {
  id: string;
  name: string;
  code: string | null;
  semester: string | null;
  color: string | null;
  deadline_count: number;
  flashcard_set_count: number;
  has_syllabus?: boolean;
  lms_synced?: boolean;
};

export type Deadline = {
  id: string;
  course_id: string | null;
  course_name: string | null;
  course_code: string | null;
  date: string | null; // YYYY-MM-DD
  time: string | null;
  type: string | null;
  title: string | null;
  description: string | null;
  completed: boolean;
  source: string | null;
  recurring?: boolean | null;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type Conversation = { id: string; title: string | null; created_at: string };

export type CourseDeadline = {
  id: string;
  date: string | null;
  time: string | null;
  type: string | null;
  title: string | null;
  description: string | null;
  recurring: boolean | null;
  completed: boolean;
  saved_to_calendar: boolean;
  source?: string | null;
};

export type CourseInfo = {
  instructor?: { name?: string; email?: string; office?: string; office_hours?: string; phone?: string };
  logistics?: { meeting_times?: string; location?: string; attendance_policy?: string; late_work_policy?: string };
  grade_breakdown?: { component: string; weight: string }[];
  policies?: { participation?: string; academic_integrity?: string; extra_credit?: string; prerequisites?: string };
  materials?: { required_textbooks?: string[] | string; recommended_readings?: string[] | string; course_portal?: string; ta_info?: string };
};

export type CourseDetail = {
  id: string;
  name: string;
  code: string | null;
  semester: string | null;
  color: string | null;
  course_info: CourseInfo | null;
  note_count: number;
  deadlines: CourseDeadline[];
  flashcard_sets: { id: string; name: string; card_count: number; created_at: string }[];
  summaries: { id: string; title: string; content: string; created_at: string }[];
  quizzes: { id: string; name: string; question_count: number; created_at: string }[];
};

export type Note = { id: string; course_id: string; title: string; content: string; content_json: unknown; created_at: string; updated_at: string };
