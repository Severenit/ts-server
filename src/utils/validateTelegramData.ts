export async function validateTelegramData(initData: string) {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) {
      console.error('No user data in initData');
      return false;
    }

    const user = JSON.parse(decodeURIComponent(userStr));
    console.log('Parsed user data:', user);
    return user;
  } catch (error) {
    console.error('Error validating Telegram data:', error);
    return false;
  }
}