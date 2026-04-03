-- =====================================================
-- Seed Data - Categorii si Surse Scraping
-- =====================================================

-- Categorii de evenimente
INSERT INTO categories (name, description, color, icon) VALUES
  ('Academic', 'Conferinte, seminarii, cursuri si alte evenimente academice', '#3B82F6', 'GraduationCap'),
  ('Cultural', 'Concerte, expozitii, spectacole si evenimente culturale', '#8B5CF6', 'Music'),
  ('Sport', 'Competitii sportive, antrenamente si activitati fizice', '#10B981', 'Trophy'),
  ('Workshop', 'Ateliere practice, training-uri si sesiuni interactive', '#F59E0B', 'Wrench'),
  ('Cariera', 'Targuri de joburi, intalniri cu angajatori, orientare profesionala', '#EF4444', 'Briefcase'),
  ('Social', 'Evenimente de networking, petreceri, intalniri studentesti', '#EC4899', 'Users'),
  ('Voluntariat', 'Actiuni de voluntariat si proiecte comunitare', '#14B8A6', 'Heart'),
  ('Tehnologie', 'Hackathoane, prezentari tech, meetup-uri IT', '#6366F1', 'Laptop')
ON CONFLICT (name) DO NOTHING;

-- Surse pentru scraping
INSERT INTO scraped_sources (name, url, is_active, scrape_frequency_hours) VALUES
  ('Primaria Suceava - Evenimente', 'https://www.primariasv.ro/portal/suceava/portal.nsf/AllByUNID/evenimente', TRUE, 24),
  ('USV - Evenimente', 'https://www.usv.ro/index.php/ro/evenimente', TRUE, 12),
  ('Monitorul de Suceava', 'https://www.monitorulsv.ro/Local', TRUE, 6)
ON CONFLICT (url) DO NOTHING;

-- Trigger pentru creare automata profil la signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Functie pentru actualizarea numarului de participanti
CREATE OR REPLACE FUNCTION update_event_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events 
    SET current_participants = current_participants + 1 
    WHERE id = NEW.event_id AND NEW.status = 'registered';
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events 
    SET current_participants = GREATEST(0, current_participants - 1) 
    WHERE id = OLD.event_id AND OLD.status = 'registered';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'registered' AND NEW.status != 'registered' THEN
      UPDATE events 
      SET current_participants = GREATEST(0, current_participants - 1) 
      WHERE id = NEW.event_id;
    ELSIF OLD.status != 'registered' AND NEW.status = 'registered' THEN
      UPDATE events 
      SET current_participants = current_participants + 1 
      WHERE id = NEW.event_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_participants_on_registration ON event_registrations;
CREATE TRIGGER update_participants_on_registration
  AFTER INSERT OR UPDATE OR DELETE ON event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_event_participants();
