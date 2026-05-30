import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audio = formData.get('audio') as File
    console.log('Transcribe hit — size:', audio?.size, 'type:', audio?.type)
    if (!audio || audio.size < 100) return NextResponse.json({ transcript: '' })
    const audioFile = new File([await audio.arrayBuffer()], 'audio.mp4', { type: 'audio/mp4' })
    const result = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    })
    console.log('Whisper result:', result.text)
    return NextResponse.json({ transcript: result.text })
  } catch (e) {
    console.error('Transcribe error:', e)
    return NextResponse.json({ transcript: '' })
  }
}
