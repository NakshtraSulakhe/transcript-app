import { NextRequest } from 'next/server';
import { GET as getLeadsHandler, POST as postLeadHandler, OPTIONS as optionsHandler } from '../leads/route';

export async function GET(request: NextRequest) {
  return getLeadsHandler(request);
}

export async function POST(request: NextRequest) {
  return postLeadHandler(request);
}

export async function OPTIONS() {
  return optionsHandler();
}

