export type UserRole = 'student' | 'organizer' | 'admin'

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed'

export type ParticipationMode = 'in_person' | 'online' | 'hybrid'

export type RegistrationStatus = 'registered' | 'waitlist' | 'cancelled' | 'attended'

export type NotificationType = 'new_event' | 'event_update' | 'event_reminder' | 'registration_confirmed' | 'event_cancelled'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  faculty: string | null
  year_of_study: number | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  color: string
  icon: string | null
  created_at: string
}

export interface Event {
  id: string
  title: string
  description: string | null
  short_description: string | null
  location: string | null
  location_details: string | null
  start_date: string
  end_date: string | null
  image_url: string | null
  category_id: string | null
  organizer_id: string
  organizer_name: string | null
  source_name: string | null
  participation_mode: ParticipationMode | null
  max_participants: number | null
  is_public: boolean
  is_featured: boolean
  status: EventStatus
  registration_deadline: string | null
  tags: string[] | null
  external_url: string | null
  is_scraped: boolean
  source_url: string | null
  created_at: string
  updated_at: string
  // Joined fields
  category?: Category
  organizer?: Profile
  registrations_count?: number
}

export interface EventRegistration {
  id: string
  event_id: string
  user_id: string
  status: RegistrationStatus
  registered_at: string
  cancelled_at: string | null
  notes: string | null
  // Joined fields
  event?: Event
  user?: Profile
}

export interface Subscription {
  id: string
  user_id: string
  category_id: string | null
  organizer_id: string | null
  created_at: string
  // Joined fields
  category?: Category | null
  organizer?: Profile | null
}

export interface Notification {
  id: string
  user_id: string
  event_id: string | null
  type: NotificationType
  title: string
  message: string | null
  is_read: boolean
  created_at: string
  // Joined fields
  event?: Event
}

export interface ScrapedSource {
  id: string
  name: string
  url: string
  scrape_selector: string | null
  is_active: boolean
  last_scraped_at: string | null
  created_at: string
}

export interface ScrapeLog {
  id: string
  source_id: string
  status: 'success' | 'failed' | 'partial'
  events_found: number
  events_added: number
  error_message: string | null
  created_at: string
  // Joined fields
  source?: ScrapedSource
}

export interface EventFeedback {
  id: string
  event_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
  updated_at: string
  // Joined fields
  user?: Profile
}

// Form types
export interface CreateEventInput {
  title: string
  description?: string
  short_description?: string
  location?: string
  location_details?: string
  start_date: string
  end_date?: string
  image_url?: string
  category_id?: string
  max_participants?: number
  is_public?: boolean
  is_featured?: boolean
  status?: EventStatus
  registration_deadline?: string
  tags?: string[]
  external_url?: string
}

export interface UpdateEventInput extends Partial<CreateEventInput> {}

export interface SignUpInput {
  email: string
  password: string
  full_name: string
  role?: UserRole
  faculty?: string
  year_of_study?: number
}

export interface UpdateProfileInput {
  full_name?: string
  avatar_url?: string
  faculty?: string
  year_of_study?: number
  phone?: string
}

// Dashboard stats
export interface DashboardStats {
  totalEvents: number
  upcomingEvents: number
  totalRegistrations: number
  totalUsers: number
  eventsByCategory: { category: string; count: number }[]
  registrationsTrend: { date: string; count: number }[]
}
