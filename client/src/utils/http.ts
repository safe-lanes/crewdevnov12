/**
 * Normalized HTTP client for making API requests
 * Provides consistent error handling and response parsing
 */

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
}

export interface ApiError extends Error {
  status?: number;
  statusText?: string;
  response?: any;
}

/**
 * Makes HTTP requests with consistent error handling
 * @param input - URL or Request object
 * @param init - Request initialization options
 * @returns Promise that resolves to parsed JSON response
 * @throws ApiError with detailed information on failure
 */
export async function api<T = any>(
  input: string | URL | Request,
  init?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(input, {
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      ...init,
    });

    let responseData: any;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      const error = new Error(
        responseData?.message || 
        responseData?.error || 
        `HTTP ${response.status}: ${response.statusText}`
      ) as ApiError;
      
      error.status = response.status;
      error.statusText = response.statusText;
      error.response = responseData;
      throw error;
    }

    return responseData;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const networkError = new Error('Network error - please check your connection') as ApiError;
      networkError.status = 0;
      throw networkError;
    }
    throw error;
  }
}

/**
 * GET request helper
 */
export async function get<T = any>(url: string, init?: RequestInit): Promise<T> {
  return api<T>(url, { ...init, method: 'GET' });
}

/**
 * POST request helper
 */
export async function post<T = any>(
  url: string, 
  data?: any, 
  init?: RequestInit
): Promise<T> {
  return api<T>(url, {
    ...init,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PATCH request helper
 */
export async function patch<T = any>(
  url: string, 
  data?: any, 
  init?: RequestInit
): Promise<T> {
  return api<T>(url, {
    ...init,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request helper
 */
export async function del<T = any>(url: string, init?: RequestInit): Promise<T> {
  return api<T>(url, { ...init, method: 'DELETE' });
}