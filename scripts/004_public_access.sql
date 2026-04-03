-- =====================================================
-- PERMITE ACCES PUBLIC PENTRU CITIRE (fara autentificare)
-- Ruleaza in SQL Editor din Supabase
-- =====================================================

-- Sterge politica veche pentru evenimente (daca exista)
DROP POLICY IF EXISTS "events_select_public" ON public.events;

-- Creeaza politica noua care permite citirea publica
-- Oricine poate vedea evenimentele publicate si publice
CREATE POLICY "events_select_public" ON public.events 
FOR SELECT 
USING (status = 'published' AND is_public = true);

-- Permite organizatorilor sa vada propriile evenimente (indiferent de status)
CREATE POLICY "events_select_own" ON public.events
FOR SELECT
USING (organizer_id = auth.uid());

-- Permite adminilor sa vada toate evenimentele
CREATE POLICY "events_select_admin" ON public.events
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Sterge si recreeaza politica pentru categorii (public read)
DROP POLICY IF EXISTS "categories_select_all" ON public.categories;
CREATE POLICY "categories_select_all" ON public.categories 
FOR SELECT 
USING (true);

-- Verifica ca tabelele au RLS activat
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
