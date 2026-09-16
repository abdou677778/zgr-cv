import { requireAdmin } from '@/lib/admin-auth';
import {
  JsonVersionError,
  saveJsonVersion,
} from '@/lib/json-version-service';
import { jsonResponse } from '@/lib/order-model';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const denial = requireAdmin(request);
  if (denial) return denial;

  const { id } = await context.params;
  const formData = await request.formData();
  const candidate = formData.get('file');
  const promptVersionValue = formData.get('promptVersion');
  const promptVersion = (
    typeof promptVersionValue === 'string' ? promptVersionValue : '1.1'
  ).slice(0, 30);
  if (!(candidate instanceof File)) {
    return jsonResponse({ error: 'Sélectionnez un fichier JSON.' }, 400);
  }
  if (candidate.size <= 0 || candidate.size > 5_000_000) {
    return jsonResponse({ error: 'Le JSON doit être inférieur à 5 Mo.' }, 413);
  }

  const source = await candidate.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return jsonResponse(
      { error: 'Le fichier ne contient pas un JSON valide.' },
      422,
    );
  }
  try {
    const result = await saveJsonVersion({
      orderId: id,
      parsed,
      originalName: candidate.name,
      promptVersion,
      source: 'admin',
    });
    return jsonResponse(result, 201);
  } catch (error) {
    if (error instanceof JsonVersionError) {
      return jsonResponse(
        { error: error.message, validation: error.details },
        error.status,
      );
    }
    throw error;
  }
}
