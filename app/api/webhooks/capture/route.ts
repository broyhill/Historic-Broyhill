import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const WEBHOOK_SECRET = process.env.CAPTURE_WEBHOOK_SECRET || 'nexus_secure_capture_token_2026';
const EMAIL_SIGNATURE = 'Warm regards,\nHistoric Broyhill Concierge Team\ned@broyhill.net';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('x-nexus-webhook-secret');
    if (authHeader !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const businessId = body.business_id || 'broyhill-01';
    const email = body.email?.trim().toLowerCase();
    const name = `${body.first_name || ''} ${body.last_name || ''}`.trim() || body.name || 'Valued Contact';
    const phone = body.phone || null;
    const company = body.company || name;
    const notes = body.notes || '';
    const tags = Array.isArray(body.tags) ? body.tags.join(', ') : (body.tags || '');

    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    const business = await prisma.businessProfile.findUnique({
      where: { id: businessId }
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Default fallback values
    let leadScore = 85;
    let primaryTrack = 'VIP';
    let suggestedDraft = `Subject: Your inquiry with Historic Broyhill\n\nDear ${name},\n\nThank you for reaching out to Historic Broyhill. We have received your inquiry and will follow up shortly with details.\n\n${EMAIL_SIGNATURE}`;

    // Direct OpenAI API Call with Structured JSON Mode
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your-openai-api-key')) {
      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `You are an executive outreach director for ${business.businessName}. Available tracks: ${business.marketingTracks.join(', ')}.

Venue facts (use ONLY these; they are the only verified details):
- ${business.businessName} is a 1920s school building in Clemmons, NC (3540 Clemmons Road), converted to offices and event space around 2006.
- Event spaces: Magnolia Room, The Boardrooms, The Dock, The Loft.
Do not state or imply capacities, room sizes, dimensions, seating layouts, amenities, pricing, dates, availability, or any other venue detail not listed above. If the lead asks about such details, say the team will follow up with specifics.

Content rules for the email:
- Never mention internal metadata, CRM tags, lead scores, tracks, scoring rules, or how the inquiry was captured. Never use the words or phrases "VIP", "High Net Worth", "lead score", "NFC", "tap", "webhook", or "track".
- Never include brackets or template placeholders such as "[Your Name]" or "[Phone Number]".
- Do not invent names, titles, or contact details for staff.

Analyze the incoming lead and respond with a JSON object matching this structure:
{
  "leadScore": <integer between 1 and 100 based on intent and commercial fit>,
  "primaryTrack": "<one of the available tracks>",
  "suggestedDraft": "<the complete email as one string, formatted exactly as described below>"
}

suggestedDraft format:
- Line 1 is exactly "Subject: " followed by a compelling, specific subject line.
- Line 2 is blank.
- Then a personalized 2-3 paragraph email body referencing the lead's notes, requested space, and company.
- End the email with exactly this signature and nothing after it:
${EMAIL_SIGNATURE}`
              },
              {
                role: 'user',
                content: `Lead Details:\nName: ${name}\nCompany: ${company}\nNotes: ${notes}\nInternal tags (for scoring only; never mention): ${tags}`
              }
            ],
            temperature: 0.7
          })
        });

        if (aiResponse.ok) {
          const data = await aiResponse.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed.leadScore) leadScore = Number(parsed.leadScore);
            if (parsed.primaryTrack) primaryTrack = parsed.primaryTrack;
            if (parsed.suggestedDraft) suggestedDraft = parsed.suggestedDraft;
          }
        }
      } catch (aiErr: any) {
        console.warn('AI call bypassed:', aiErr.message);
      }
    }

    // Save Lead Profile in Database
    const lead = await prisma.leadProfile.upsert({
      where: { email },
      update: {
        name,
        company,
        phone,
        leadScore,
        primaryTrack,
        notes,
        customFields: { tags }
      },
      create: {
        businessId: business.id,
        email,
        name,
        company,
        phone,
        leadScore,
        primaryTrack,
        leadSource: 'IN_PERSON_NFC',
        notes,
        customFields: { tags }
      }
    });

    // Stage Campaign in AiContentPipeline for Human-in-the-Loop review
    const campaign = await prisma.aiContentPipeline.create({
      data: {
        businessId: business.id,
        channel: 'EMAIL',
        suggestedDraft,
        status: 'PENDING_REVIEW',
        scheduledFor: new Date(),
        // AiContentPipeline has no lead relation; record the recipient for dispatch on approval
        metrics: { leadId: lead.id, recipientEmail: lead.email }
      }
    });

    return NextResponse.json({
      success: true,
      lead: { id: lead.id, email: lead.email, name: lead.name, score: lead.leadScore },
      stagedCampaignId: campaign.id
    }, { status: 200 });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
