import { errorHandler } from "./error.js";

// Версия API
export const API_VERSION = '1.0.0';
export const MIN_SUPPORTED_VERSION = '1.0.0';

// Функция проверки версии клиента
function checkClientVersion(clientVersion: string | undefined): boolean {
  if (!clientVersion) return false;
  
  const [majorClient, minorClient, patchClient] = clientVersion.split('.').map(Number);
  const [majorMin, minorMin, patchMin] = MIN_SUPPORTED_VERSION.split('.').map(Number);
  
  if (majorClient < majorMin) return false;
  if (majorClient === majorMin && minorClient < minorMin) return false;
  if (majorClient === majorMin && minorClient === minorMin && patchClient < patchMin) return false;
  
  return true;
}


// Middleware для проверки версии
export function versionCheck(request: any, h: any) {
    const clientVersion = request.headers['x-client-version'];
    
    if (!checkClientVersion(clientVersion)) {
      return errorHandler({
        h,
        details: 'Пожалуйста, обновите приложение до последней версии',
        error: 'Outdated client version',
        code: 426, // Upgrade Required
        meta: {
          currentVersion: API_VERSION,
          minSupported: MIN_SUPPORTED_VERSION
        }
      });
    }
    
    return null;
  }