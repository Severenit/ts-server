import { ResponseToolkit } from '@hapi/hapi';

export function errorHandler({
  h,
  details,
  error,
  code = 500,
}: {
  h: ResponseToolkit,
  details: string,
  error: unknown,
  code?: number
})
{
  return h.response({
    error: details || 'Unknown error',
    details: error instanceof Error ? error.message : 'Unknown error',
  }).code(code);
}