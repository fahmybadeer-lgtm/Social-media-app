import { NextResponse } from 'next/server';

export async function GET() {
    const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 });
    const url = `https://graph.facebook.com/v20.0/105882838879341?fields=connected_instagram_account&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data);
}
