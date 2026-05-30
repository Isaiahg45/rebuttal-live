import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audio = formData.get('audio') as File
    if (!audio || audio.size < 1000) {
      return NextResponse.json({ transcript: '' })
    }
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
      language: 'en',
    })
    return NextResponse.json({ transcript: transcription.text })
  } catch (e) {
    console.error('Transcribe error:', e)
    return NextResponse.json({ transcript: '' })
  }
}
