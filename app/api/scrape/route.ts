import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8001"

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
    
    const body = await request.json()
    
    // Call Python backend for scraping
    let response: Response
    try {
      response = await fetch(`${BACKEND_URL}/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(body),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return NextResponse.json(
        { error: `Failed to reach scraping backend at ${BACKEND_URL}: ${message}` },
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
