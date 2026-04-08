-- Add participation mode to events

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS participation_mode TEXT CHECK (participation_mode IN ('in_person', 'online', 'hybrid'));
