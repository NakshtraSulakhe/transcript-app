import { NextRequest, NextResponse } from 'next/server';
import { getLeadsFromDatabaseOrApi, saveProcessedLead, getClientsFromDatabaseOrApi } from '@/lib/db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parameter Aliases as defined in DemandFlow Bridge API specification
    const clientCode = searchParams.get('client_code') || searchParams.get('clientCode') || searchParams.get('client_id') || searchParams.get('clientId') || searchParams.get('client') || undefined;
    const campaignCode = searchParams.get('campaign_id') || searchParams.get('campaignCode') || undefined;
    const search = searchParams.get('search') || searchParams.get('q') || undefined;
    const qaStatus = searchParams.get('qa_status') || searchParams.get('qaStatus') || searchParams.get('status') || undefined;
    const clientDeliveryStatus = searchParams.get('client_delivery_status') || searchParams.get('delivery_status') || undefined;
    
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limitParam = searchParams.get('limit') || '50';
    const limit = limitParam === 'all' ? 1000 : Math.min(parseInt(limitParam, 10) || 50, 1000);

    const allLeads = await getLeadsFromDatabaseOrApi({ campaignCode, clientCode, search, qaStatus });
    
    // Filter delivery status if passed
    const filteredLeads = clientDeliveryStatus && clientDeliveryStatus !== 'All Status' && clientDeliveryStatus !== 'all'
      ? allLeads.filter(l => l.clientDeliveryStatus?.toLowerCase() === clientDeliveryStatus.toLowerCase())
      : allLeads;

    // Pagination calculation
    const total = filteredLeads.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedLeads = filteredLeads.slice(startIndex, startIndex + limit);

    // Client Info metadata
    const allClients = await getClientsFromDatabaseOrApi();
    const matchedClient = clientCode ? allClients.find(c => c.clientCode.toLowerCase() === clientCode.toLowerCase()) : undefined;
    const clientInfo = matchedClient
      ? { id: 101, client_code: matchedClient.clientCode, name: matchedClient.name }
      : clientCode
      ? { id: 101, client_code: clientCode, name: `Client ${clientCode}` }
      : undefined;

    return NextResponse.json(
      {
        status: 'success',
        ...(clientInfo ? { client: clientInfo } : {}),
        total,
        count: paginatedLeads.length,
        page,
        limit,
        total_pages: totalPages,
        leads: paginatedLeads
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('API GET Leads Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch leads from database' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.firstName || !body.email) {
      return NextResponse.json(
        { status: 'error', message: 'firstName and email are required fields' },
        { status: 400, headers: corsHeaders }
      );
    }
    const saved = await saveProcessedLead(body);
    return NextResponse.json({ status: 'success', lead: saved }, { headers: corsHeaders });
  } catch (error) {
    console.error('API POST Lead Error:', error);
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Failed to save lead' },
      { status: 500, headers: corsHeaders }
    );
  }
}


