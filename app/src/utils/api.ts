// API 서버 연동 유틸리티 (localhost:8080 고정)

const API_SERVER_BASE = 'http://localhost:8080';

/**
 * 서버로부터 auth 데이터를 가져옵니다
 */
export async function getAuthData(): Promise<{ access_token?: string; userId?: string; last_updated?: string } | null> {
  try {
    const response = await fetch(`${API_SERVER_BASE}/api/auth`);
    
    if (response.ok) {
      return await response.json();
    } else {
      console.error('❌ Auth 데이터 조회 실패:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ Auth 데이터 조회 오류:', error);
    return null;
  }
}

/**
 * 서버에 데이터를 전송합니다
 */
export async function sendToServer(endpoint: string, data: any, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST'): Promise<any> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (method !== 'GET' && data) {
    options.body = JSON.stringify(data);
  }
  
  // endpoint가 절대 URL이 아니면 API_SERVER_BASE를 앞에 붙임
  const url = endpoint.startsWith('http') ? endpoint : `${API_SERVER_BASE}${endpoint}`;
  
  try {
    const response = await fetch(url, options);
    
    if (response.ok) {
      return await response.json();
    } else {
      throw new Error(`API 요청 실패: ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ API 요청 오류 (${method} ${url}):`, error);
    throw error;
  }
}

/**
 * 서버 연결 상태를 확인합니다
 */
export async function checkServerConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_SERVER_BASE}/api/ping`);
    return response.ok;
  } catch (error) {
    return false;
  }
}
