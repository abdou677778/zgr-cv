import { oauthProtectedResourceMetadata } from '../../../lib/mcp-security';

export function GET(request: Request) {
  return oauthProtectedResourceMetadata(request);
}
