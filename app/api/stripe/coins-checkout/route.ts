import { NextRequest, NextResponse } from 'next/server'
// @ts-ignore
import Stripe from 'stripe'

const stripe = new (Stripe as any)(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' })

export async function POST(req: NextRequest) {
  try {
    const { userId, username, priceId, coins } = await req.json()
    if (!userId || !priceId || !coins) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/shop?success=true&coins=${coins}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/shop?cancelled=true`,
      metadata: { userId, username, coins: String(coins) },
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}