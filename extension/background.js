// MV3 SW: chrome 타입 억제
// AccessTokenSnifferForCasely background script
const SERVER_BASE = "http://localhost:8080";
const SERVER_ENDPOINTS = {
  authData: "/api/auth",
  ping: "/api/ping",
};

async function sendAuthDataToPythonServer(authData) {
  try {
    const response = await fetch(`${SERVER_BASE}${SERVER_ENDPOINTS.authData}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authData),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const result = await response.json();
      console.log("🔐 Auth 데이터 Python 서버로 전송 완료:", result);
      return true;
    } else {
      console.error("❌ Auth 데이터 전송 실패:", response.status);
      return false;
    }
  } catch (error) {
    console.error("❌ Auth 데이터 전송 오류:", error);
    return false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg && msg.type === "setAuthMeta" && msg.payload && (msg.payload.access_token || msg.payload.userId)) {
        await sendAuthDataToPythonServer({
          access_token: msg.payload.access_token,
          userId: msg.payload.userId,
        });
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: "Invalid or missing auth data" });
      }
    } catch (e) {
      console.error("[RPC_ERROR]", msg && msg.type, e);
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
  })();
  return true;
});
