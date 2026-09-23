import { NextRequest, NextResponse } from 'next/server';
import { getClientsFromDatabaseOrApi, saveClient, deleteClient } from '@/lib/db';

export async function GET() {
  try {
    const clients = await getClientsFromDatabaseOrApi();
    return NextResponse.json({ status: 'success', clients });
  } catch (error) {
    console.error('API GET Clients Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.clientCode || !body.name) {
      return NextResponse.json(
        { status: 'error', message: 'clientCode and name are required' },
        { status: 400 }
      );
    }
    const saved = await saveClient(body);
    return NextResponse.json({ status: 'success', client: saved });
  } catch (error) {
    console.error('API POST Client Error:', error);
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Failed to save client' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientCode = searchParams.get('clientCode') || searchParams.get('client_code');
    if (!clientCode) {
      return NextResponse.json({ status: 'error', message: 'clientCode parameter is required' }, { status: 400 });
    }
    const success = await deleteClient(clientCode);
    return NextResponse.json({ status: success ? 'success' : 'error', message: success ? 'Client deleted' : 'Failed to delete client' });
  } catch (error) {
    console.error('API DELETE Client Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to delete client' },
      { status: 500 }
    );
  }
}

