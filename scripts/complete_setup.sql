-- =====================================================
-- USV EVENTS PLATFORM - COMPLETE DATABASE SETUP
-- Rulează acest script în Supabase SQL Editor
-- Project: USV Platform (floarea.pitu10@student.usv.ro)
-- =====================================================

-- =====================================================
-- 1. CREATE TABLES
-- =====================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('student', 'organizer', 'admin')) DEFAULT 'student',
  avatar_url TEXT,
  faculty TEXT,
  year_of_study INT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  location TEXT,
  location_details TEXT,
  participation_mode TEXT CHECK (participation_mode IN ('in_person', 'online', 'hybrid')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  image_url TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  organizer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  max_participants INT,
  is_public BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  status TEXT CHECK (status IN ('draft', 'published', 'cancelled', 'completed')) DEFAULT 'published',
  registration_deadline TIMESTAMPTZ,
  tags TEXT[],
  external_url TEXT,
  is_scraped BOOLEAN DEFAULT false,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event registrations table
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('registered', 'waitlist', 'cancelled', 'attended')) DEFAULT 'registered',
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(event_id, user_id)
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  organizer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('new_event', 'event_update', 'event_reminder', 'registration_confirmed', 'event_cancelled')) NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scraped sources table
CREATE TABLE IF NOT EXISTS public.scraped_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  scrape_selector TEXT,
  is_active BOOLEAN DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scrape logs table
CREATE TABLE IF NOT EXISTS public.scrape_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.scraped_sources(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('success', 'failed', 'partial')) NOT NULL,
  events_found INT DEFAULT 0,
  events_added INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================

-- Profiles policies
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Categories policies (public read)
CREATE POLICY "categories_select_all" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories_insert_admin" ON public.categories FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "categories_update_admin" ON public.categories FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "categories_delete_admin" ON public.categories FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Events policies
CREATE POLICY "events_select_public" ON public.events FOR SELECT USING (is_public = true OR organizer_id = auth.uid());
CREATE POLICY "events_insert_organizer" ON public.events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('organizer', 'admin'))
);
CREATE POLICY "events_update_own" ON public.events FOR UPDATE USING (
  organizer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "events_delete_own" ON public.events FOR DELETE USING (
  organizer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Registrations policies
CREATE POLICY "registrations_select_own" ON public.event_registrations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "registrations_select_organizer" ON public.event_registrations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = event_registrations.event_id AND events.organizer_id = auth.uid())
);
CREATE POLICY "registrations_insert_own" ON public.event_registrations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "registrations_update_own" ON public.event_registrations FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "registrations_delete_own" ON public.event_registrations FOR DELETE USING (user_id = auth.uid());

-- Subscriptions policies
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "subscriptions_insert_own" ON public.subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "subscriptions_delete_own" ON public.subscriptions FOR DELETE USING (user_id = auth.uid());

-- Notifications policies
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE USING (user_id = auth.uid());

-- Scraped sources policies (public read for now, admin write)
CREATE POLICY "scraped_sources_select_all" ON public.scraped_sources FOR SELECT USING (true);
CREATE POLICY "scraped_sources_insert_admin" ON public.scraped_sources FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "scraped_sources_update_admin" ON public.scraped_sources FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Scrape logs policies
CREATE POLICY "scrape_logs_select_admin" ON public.scrape_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "scrape_logs_insert_admin" ON public.scrape_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =====================================================
-- 4. TRIGGER FOR AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email),
    COALESCE(new.raw_user_meta_data ->> 'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 5. SEED DATA - CATEGORIES
-- =====================================================

INSERT INTO public.categories (name, description, color, icon) VALUES
  ('Academic', 'Conferinte, seminarii, cursuri', '#3B82F6', 'graduation-cap'),
  ('Cultural', 'Concerte, expozitii, spectacole', '#EC4899', 'music'),
  ('Sport', 'Competitii, antrenamente, evenimente sportive', '#22C55E', 'trophy'),
  ('Social', 'Intalniri, networking, petreceri', '#F59E0B', 'users'),
  ('Cariera', 'Job fairs, workshop-uri, internship-uri', '#8B5CF6', 'briefcase'),
  ('Voluntariat', 'Actiuni sociale, caritabile', '#EF4444', 'heart'),
  ('Tech', 'Hackathoane, meetup-uri IT', '#06B6D4', 'code')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 6. SEED DATA - SCRAPING SOURCES
-- =====================================================

INSERT INTO public.scraped_sources (name, url, is_active) VALUES
  ('Primaria Suceava', 'https://suceava.ro/evenimente', true),
  ('USV Events', 'https://usv.ro/evenimente', true),
  ('Monitorul de Suceava', 'https://monitorulsv.ro/cultura', true)
ON CONFLICT (url) DO NOTHING;

-- =====================================================
-- 7. SEED DATA - DEMO EVENTS (fara organizer pentru demo)
-- =====================================================

-- Mai intai facem organizer_id optional pentru evenimente demo
ALTER TABLE public.events ALTER COLUMN organizer_id DROP NOT NULL;

-- Inserare evenimente demo
INSERT INTO public.events (title, description, short_description, location, start_date, end_date, category_id, is_public, is_featured, status, tags) VALUES
(
  'Conferinta Nationala de Informatica 2026',
  'Eveniment de referinta pentru comunitatea IT din Romania. Vorbitori invitati din Google, Microsoft si startup-uri locale. Teme: AI, Cloud Computing, Cybersecurity.',
  'Conferinta IT cu speakeri de top din industrie',
  'Aula Magna USV, Corp A',
  '2026-04-15 09:00:00+03',
  '2026-04-15 18:00:00+03',
  (SELECT id FROM public.categories WHERE name = 'Tech'),
  true, true, 'published',
  ARRAY['IT', 'conferinta', 'AI', 'networking']
),
(
  'Targul de Cariere USV 2026',
  'Peste 50 de companii locale si nationale recruteaza studenti si absolventi. CV-uri, interviuri on-spot, workshop-uri de pregatire.',
  'Conecteaza-te cu angajatorii de top',
  'Sala Polivalenta USV',
  '2026-04-20 10:00:00+03',
  '2026-04-20 16:00:00+03',
  (SELECT id FROM public.categories WHERE name = 'Cariera'),
  true, true, 'published',
  ARRAY['cariere', 'joburi', 'recrutare', 'CV']
),
(
  'Concert Aniversar 60 Ani USV',
  'Concert simfonic extraordinar cu Orchestra Filarmonicii din Suceava. Program: Beethoven, Mozart, Enescu.',
  'Sarbatorim 60 de ani de excelenta academica',
  'Teatrul Municipal Suceava',
  '2026-05-01 19:00:00+03',
  '2026-05-01 21:30:00+03',
  (SELECT id FROM public.categories WHERE name = 'Cultural'),
  true, true, 'published',
  ARRAY['concert', 'muzica clasica', 'aniversare']
),
(
  'Hackathon USV 2026',
  '48 de ore de coding intens! Echipe de 3-5 membri, premii in valoare de 10.000 EUR, mentorat de la experti din industrie.',
  '48h de coding pentru premii de 10.000 EUR',
  'Facultatea de Inginerie Electrica, Sala 201',
  '2026-04-25 18:00:00+03',
  '2026-04-27 18:00:00+03',
  (SELECT id FROM public.categories WHERE name = 'Tech'),
  true, true, 'published',
  ARRAY['hackathon', 'programare', 'competitie', 'premii']
),
(
  'Cupa Universitatilor la Fotbal',
  'Competitie sportiva intre universitatile din Nord-Est. Echipe din Iasi, Bacau, Botosani, Suceava.',
  'Fotbal universitar - finala regionala',
  'Stadionul Areni',
  '2026-05-10 14:00:00+03',
  '2026-05-10 20:00:00+03',
  (SELECT id FROM public.categories WHERE name = 'Sport'),
  true, false, 'published',
  ARRAY['fotbal', 'sport', 'competitie', 'universitati']
),
(
  'Workshop: Cum sa-ti scrii CV-ul perfect',
  'Invata tehnici de redactare CV care atrag atentia recruiterilor. Feedback personalizat inclus.',
  'Pregateste-te pentru piata muncii',
  'Biblioteca Centrala USV, Sala de Conferinte',
  '2026-04-10 14:00:00+03',
  '2026-04-10 17:00:00+03',
  (SELECT id FROM public.categories WHERE name = 'Cariera'),
  true, false, 'published',
  ARRAY['CV', 'workshop', 'cariera', 'recrutare']
),
(
  'Seara de Board Games',
  'Relaxeaza-te cu colegii la o seara de jocuri de societate. Catan, Ticket to Ride, Codenames si multe altele!',
  'Distractie si socializare cu jocuri de societate',
  'Caminul 4 USV, Sala Comuna',
  '2026-04-08 19:00:00+03',
  '2026-04-08 23:00:00+03',
  (SELECT id FROM public.categories WHERE name = 'Social'),
  true, false, 'published',
  ARRAY['board games', 'socializare', 'distractie']
),
(
  'Actiune de Impadurire - Padurea Zamca',
  'Voluntariat pentru mediu! Plantam 500 de puieti de brad in zona Zamca. Transport si echipament asigurat.',
  'Planteaza un copac, salveaza planeta',
  'Padurea Zamca (transport de la USV)',
  '2026-04-22 08:00:00+03',
  '2026-04-22 14:00:00+03',
  (SELECT id FROM public.categories WHERE name = 'Voluntariat'),
  true, false, 'published',
  ARRAY['voluntariat', 'mediu', 'ecologie', 'impadurire']
),
(
  'Seminarul de Inteligenta Artificiala',
  'Prof. Dr. Ion Popescu prezinta ultimele cercetari in Machine Learning aplicat in medicina.',
  'Cercetare de frontiera in AI medical',
  'Amfiteatrul Facultatii de Informatica',
  '2026-04-12 11:00:00+03',
  '2026-04-12 13:00:00+03',
  (SELECT id FROM public.categories WHERE name = 'Academic'),
  true, false, 'published',
  ARRAY['AI', 'cercetare', 'medicina', 'seminar']
),
(
  'Expozitie Foto: Bucovina Necunoscuta',
  'Fotografii inedite din locuri mai putin cunoscute ale Bucovinei. Vernisaj cu artistul Mihai Ionescu.',
  'Descopera Bucovina prin obiectivul camerei',
  'Muzeul de Istorie Suceava',
  '2026-04-18 17:00:00+03',
  '2026-04-18 20:00:00+03',
  (SELECT id FROM public.categories WHERE name = 'Cultural'),
  true, false, 'published',
  ARRAY['expozitie', 'foto', 'Bucovina', 'arta']
);

-- =====================================================
-- SETUP COMPLET!
-- Acum poti folosi aplicatia cu date demo.
-- =====================================================
