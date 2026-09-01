import { requireAdmin } from '@/lib/admin-auth';
import { jsonResponse } from '@/lib/order-model';
import { listOrders } from '@/lib/order-repository';

export async function GET(request: Request) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  return jsonResponse({ orders: await listOrders() });
}
