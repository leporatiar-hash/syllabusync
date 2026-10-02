// Mirrors the backend response models in Backend/main.py.

export type Me = {
  user_id: string;
  profile: {
    email: string;
    full_name: string | null;
    school_name: string | null;
    major: string | null;
    naming_style: string;
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
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type Conversation = { id: string; title: string | null; created_at: string };
