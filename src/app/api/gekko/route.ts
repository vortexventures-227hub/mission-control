import { NextRequest, NextResponse } from 'next/server';

const GEKKO_WS_URL = process.env.GEKKO_WS_URL || 'ws://localhost:8765';
const GEKKO_HTTP_URL = process.env.GEKKO_HTTP_URL || 'http://localhost:8765';

// Helper to make requests to GekkoEngine
async function gekkoRequest(command: string, params?: Record<string, unknown>) {
  // For now, return mock data if engine is not running
  // In production, this would use WebSocket or HTTP proxy
  try {
    const response = await fetch(`${GEKKO_HTTP_URL}/api/${command}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    return response.json();
  } catch {
    return null;
  }
}

// GET /api/gekko - Get engine status
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const resource = searchParams.get('resource') || 'status';

  try {
    const data = await gekkoRequest(resource);
    
    if (!data) {
      // Return mock/offline status
      return NextResponse.json({
        state: 'offline',
        mode: 'paper',
        risk_level: 'unknown',
        is_trading_allowed: false,
        portfolio: null,
        strategies: {},
        message: 'GekkoEngine not connected',
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to connect to GekkoEngine' },
      { status: 503 }
    );
  }
}

// POST /api/gekko - Send control commands
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command, ...params } = body;

    if (!command) {
      return NextResponse.json(
        { error: 'Missing command' },
        { status: 400 }
      );
    }

    const data = await gekkoRequest(command, params);
    
    if (!data) {
      return NextResponse.json(
        { error: 'GekkoEngine not available' },
        { status: 503 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to execute command' },
      { status: 500 }
    );
  }
}
