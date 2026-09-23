import { NextRequest, NextResponse } from 'next/server';
import { getCampaignsByClient, saveCampaign, deleteCampaign } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientCode = searchParams.get('clientCode') || searchParams.get('client_code');
    if (!clientCode) {
      return NextResponse.json({ status: 'error', message: 'clientCode parameter is required' }, { status: 400 });
    }
    const campaigns = await getCampaignsByClient(clientCode);
    return NextResponse.json({ status: 'success', campaigns });
  } catch (error) {
    console.error('API GET Campaigns Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.clientCode || !body.campaignCode || !body.campaignName) {
      return NextResponse.json(
        { status: 'error', message: 'clientCode, campaignCode, and campaignName are required' },
        { status: 400 }
      );
    }
    const saved = await saveCampaign(body);
    return NextResponse.json({ status: 'success', campaign: saved });
  } catch (error) {
    console.error('API POST Campaign Error:', error);
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Failed to save campaign' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignCode = searchParams.get('campaignCode') || searchParams.get('campaign_code');
    if (!campaignCode) {
      return NextResponse.json({ status: 'error', message: 'campaignCode parameter is required' }, { status: 400 });
    }
    const success = await deleteCampaign(campaignCode);
    return NextResponse.json({ status: success ? 'success' : 'error', message: success ? 'Campaign deleted' : 'Failed to delete campaign' });
  } catch (error) {
    console.error('API DELETE Campaign Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to delete campaign' },
      { status: 500 }
    );
  }
}
