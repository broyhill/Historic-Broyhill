import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const WEBHOOK_SECRET = process.env.CAPTURE_WEBHOOK_SECRET || 'nexus_secure_capture_token_2026';

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
    let suggestedDraft = `Dear ${name},\n\nThank you for connecting regarding ${company}. We are preparing details on our opportunities.\n\nBest regards,\nHistoric Broyhill Team`;

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
Analyze the incoming lead and respond with a JSON object matching this structure:
{
  "leadScore": <integer between 1 and 100 based on intent and commercial fit>,
  "primaryTrack": "<one of the available tracks>",
  "suggestedDraft": "<a highly personalized 2-3 paragraph outreach email referencing their specific notes, venue requirements, and company>"
}`
              },
              {
                role: 'user',
                content: `Lead Details:\nName: ${name}\nCompany: ${company}\nNotes: ${notes}\nTags: ${tags}`
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
    const campaign = await prisma.AiContentPipeline.create({
      data: {
        businessId: business.id,
        channel: 'EMAIL',
        suggestedDraft,
        status: 'PENDING_REVIEW',
        scheduledFor: new Date()
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
