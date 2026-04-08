'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Star } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface EventFeedbackFormProps {
  eventId: string
  canLeaveFeedback: boolean
  existingRating: number | null
  existingComment: string | null
  averageRating: number | null
  feedbackCount: number
}

export function EventFeedbackForm({
  eventId,
  canLeaveFeedback,
  existingRating,
  existingComment,
  averageRating,
  feedbackCount,
}: EventFeedbackFormProps) {
  const router = useRouter()
  const [rating, setRating] = useState<number>(existingRating ?? 5)
  const [comment, setComment] = useState<string>(existingComment ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ratingLabel = useMemo(() => {
    if (feedbackCount <= 0 || averageRating == null) return 'Fără recenzii încă'
    return `${averageRating.toFixed(1)} / 5 (${feedbackCount})`
  }, [averageRating, feedbackCount])

  const canSubmit = canLeaveFeedback && !loading

  const handleSubmit = async () => {
    setError(null)

    if (rating < 3 && !comment.trim()) {
      setError('Te rog scrie un comentariu pentru rating sub 3 stele.')
      return
    }

    const supabase = createClient()
    setLoading(true)

    try {
      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes.user) {
        setError('Trebuie să fii autentificat.')
        return
      }

      const { error: insertError } = await supabase.from('event_feedback').insert({
        event_id: eventId,
        user_id: userRes.user.id,
        rating,
        comment: comment.trim() ? comment.trim() : null,
      })

      if (insertError) {
        throw insertError
      }

      router.refresh()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating & feedback</CardTitle>
        <CardDescription>{ratingLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {existingRating != null ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-5 w-5"
                  fill={i < existingRating ? 'currentColor' : 'none'}
                />
              ))}
            </div>
            {existingComment && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{existingComment}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Ai trimis deja feedback pentru acest eveniment.
            </p>
          </div>
        ) : canLeaveFeedback ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Alege rating-ul</p>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const value = i + 1
                  const active = value <= rating
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className="p-1"
                      aria-label={`${value} stele`}
                    >
                      <Star className="h-6 w-6" fill={active ? 'currentColor' : 'none'} />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">
                Comentariu{rating < 3 ? ' (obligatoriu sub 3 stele)' : ' (opțional)'}
              </p>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Scrie câteva detalii despre experiența ta..."
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="w-full" onClick={handleSubmit} disabled={!canSubmit}>
              {loading ? 'Se trimite...' : 'Trimite feedback'}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Feedback-ul este disponibil doar pentru participanți, după terminarea evenimentului.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
