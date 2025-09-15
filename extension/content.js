// AccessTokenSnifferForCasely content script
function normalize(_alias, v) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

function readAuthMeta() {
  const access_token = localStorage.getItem("access_token");
  if (!access_token) return null;

  let userId = null;
  try {
    userId = JSON.parse(localStorage.getItem("vuex") || "{}")?.SESSION_STORE?.data?.id;
  } catch {}
  if (!userId) {
    try {
      const checkData = JSON.parse(localStorage.getItem("checkData") || "{}");
      userId = checkData?.teamTask || checkData?.myTask;
    } catch {}
  }
  if (!userId) return null;

  return { access_token, userId };
}

function tick() {
  try {
    const meta = readAuthMeta();
    if (!meta) return;
    chrome.runtime.sendMessage({ type: "setAuthMeta", payload: meta }, function(response) {
      if (response && response.ok) {
        // 성공적으로 전송됨
      } else {
        // 실패 또는 응답 없음
        // console.warn("[Sniffer] Auth meta send failed", response && response.error);
      }
    });
  } catch {}
}

setInterval(tick, 10000);
