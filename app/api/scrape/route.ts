import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8001"

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const body = await request.json()
    
    // Call Python backend for scraping
    let response: Response | null = null
    try {
      const url = `${BACKEND_URL}/scrape`
      const init: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      }

      const attempts = [0, 400, 1200]
      let lastError: unknown = null
      for (const delay of attempts) {
        if (delay) await sleep(delay)
        try {
          response = await fetch(url, init)
          lastError = null
          break
        } catch (e) {
          lastError = e
        }
      }
      if (lastError) throw lastError
      if (!response) throw new Error('No response from backend')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return NextResponse.json(
        { error: `Failed to reach scraping backend at ${BACKEND_URL}: ${message}`, backend_url: BACKEND_URL },
        { status: 502 }
      )
    }
    
    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }
    
    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Scraping error:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: "Internal server error", details: message }, 
      { status: 500 }
    )
  }
}
