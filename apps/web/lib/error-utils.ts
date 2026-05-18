import axios from 'axios';

export const extractAxiosMessage = (error: unknown): string | null => {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const responseData = error.response?.data as { message?: string | string[] } | undefined;

  if (typeof responseData?.message === 'string') {
    return responseData.message;
  }

  if (Array.isArray(responseData?.message) && responseData.message[0]) {
    return responseData.message[0];
  }

  return null;
};

/** True for client errors (4xx) — input validation, not real API outage. */
export const isAxiosClientError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
};
