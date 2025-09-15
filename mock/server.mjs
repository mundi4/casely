import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public")); // 정적 파일 제공

// JSON 파일 경로
const DATA_FILE = path.join(__dirname, "mockData.json");

// 인증 관련 상태 관리
let currentAuthMeta = {
	access_token: generateRandomToken(),
	userId: 1001,
	checkData: { teamTask: 1001 },
	_updatedAt: Date.now(),
};

// 랜덤 토큰 생성
function generateRandomToken() {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 5분마다 토큰 갱신
setInterval(
	() => {
		currentAuthMeta.access_token = generateRandomToken();
		currentAuthMeta._updatedAt = Date.now();
		console.log("[TOKEN_REFRESH]", currentAuthMeta.access_token);
	},
	5 * 60 * 1000,
);

// 메모리 데이터 저장소
let dataStore = {
	contracts: new Map(), // contractId -> contract detail
	chats: new Map(), // contractId -> chat list
	nextContractId: 14951, // 새 계약 ID용
};

// 데이터 로드
function loadData() {
	try {
		if (fs.existsSync(DATA_FILE)) {
			const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
			dataStore.contracts = new Map(data.contracts || []);
			dataStore.chats = new Map(data.chats || []);
			dataStore.nextContractId = data.nextContractId || 14951;
			console.log(`📂 저장된 데이터를 불러왔습니다 (계약: ${dataStore.contracts.size}개, 채팅: ${dataStore.chats.size}개)`);
		}
	} catch (error) {
		console.error("데이터 로드 실패:", error);
	}
}

// 데이터 저장
function saveData() {
	try {
		const data = {
			contracts: Array.from(dataStore.contracts.entries()),
			chats: Array.from(dataStore.chats.entries()),
			nextContractId: dataStore.nextContractId,
		};
		fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
		console.log("💾 데이터가 저장되었습니다");
	} catch (error) {
		console.error("데이터 저장 실패:", error);
	}
}

// 랜덤 데이터 생성기
const pad = n => String(n).padStart(2, "0");

function toHistoryDateString(d) {
	return d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

const generateRandomData = () => {
	const now = new Date();
	const createdAt = new Date(now.getTime() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)); // 최대 30일 전
	const receiveAt = new Date(createdAt.getTime() + Math.floor(Math.random() * 5 * 24 * 60 * 60 * 1000)); // 생성 후 최대 5일 이내
	const enforcementDate =
		Math.random() < 0.8
			? new Date(receiveAt.getTime() + Math.floor(Math.random() * 15 * 24 * 60 * 60 * 1000)).toISOString().split("T")[0].replace(/-/g, "/")
			: null;
	const closed = Math.random() < 0.3;
	const replyDate = closed ? new Date(receiveAt.getTime() + Math.floor(Math.random() * 10 * 24 * 60 * 60 * 1000)) : null;

	const titles = ["신규 서비스 계약", "유지보수 계약", "라이선스 계약", "컨설팅 계약", "개발 용역 계약"];
	const descriptions = [
		"검토 요청합니다.\n빠른 검토 부탁드립니다.",
		"수정사항이 있어 연락드립니다.\n완전 급합니다...",
		"검토가 필요합니다.\n내일 시행",
		"잘 부탁합니다.\n\n감사합니다.",
		"긴급 검토 요청드립니다.\n오늘 중으로 회신 바랍니다.",
	];

	const allCreators = [
		{
			creator: "김철수",
			creatorDepartment: "정보개발부",
			creatorPosition: "팀장",
			positionNameAndRankName: "팀원[L3]",
			creatorEmail: "12345678@XXX.COM",
			displayName: "김철수 팀원[L2]",
		},
		{
			creator: "이영희",
			creatorDepartment: "기업제품부",
			creatorPosition: "팀원",
			positionNameAndRankName: "팀원[L1]",
			creatorEmail: "2345678@XXX.COM",
			displayName: "이영희 팀원[L1]",
		},
		{
			creator: "박민수",
			creatorDepartment: "개인여신1부",
			creatorPosition: "팀원",
			positionNameAndRankName: "팀원[L2]",
			creatorEmail: "3456789@XXX.COM",
			displayName: "박민수 팀원[L2]",
		},
	];

	const allReviewers = [
		{
			name: "안미라",
			position: "과장",
			department: "법률지원부",
			employeeNo: "1111111",
			email: "1111111@XXX.COM",
			memberId: 811111,
		},
		{
			name: "이상민",
			position: "대리",
			department: "법률지원부",
			employeeNo: "2222222",
			email: "2222222@XXX.COM",
			memberId: 822222,
		},
		{
			name: "김영지",
			position: "변호사",
			department: "법률지원부",
			employeeNo: "3333333",
			email: "3333333@XXX.COM",
			memberId: 833333,
		},
	];

	const numReviewers = Math.min(2, Math.max(1, Math.floor(Math.random() * allReviewers.length)));
	const reviewers = allReviewers.sort(() => 0.5 - Math.random()).slice(0, numReviewers);

	const numCreators = Math.random() > 0.8 ? 2 : 1;
	const creators = allCreators.sort(() => 0.5 - Math.random()).slice(0, numCreators);

	// 랜덤 ID, viewcode 등 생성
	const id = Math.floor(Math.random() * 100000) + 10000;

	// YYYY/MM/DD 형식
	const createDate = createdAt.toISOString().split("T")[0].replace(/-/g, "/");
	// YYYYMMDD-00000001 형식
	const viewcode = `${createDate.replaceAll("/", "")}-${String(id).padStart(8, "0")}`;

	// 라벨 예시
	const labels =
		Math.random() < 0.5
			? []
			: [
					{
						color: "rgb(0, 255, 255, 255)",
						name: "검토완료",
						type: "PRIVATE",
						userId: 101664,
					},
				];

	// 히스토리 예시
	const contractHistory = [
		{
			id: 1,
			actionText: "접수",
			createTime: toHistoryDateString(createdAt),
			contractDocList: [],
		},
	];

	if (closed) {
		contractHistory.unshift({
			actionText: "검토완료",
			creator: reviewers[0].name,
			createTime: toHistoryDateString(replyDate),
			isShowComment: true,
			comment: ` [강종필/법률지원부님께 (검토 승인1) 단계로 검토완료 했습니다.]`,
			id: 149799,
			creatorDept: "법률지원부",
			creatorPosition: "/팀원",
			type: "workflow",
			extraInfo: {
				historyType: "history_itm_contract",
			},
		});
	}

	// actions 예시
	const actionsArr = [
		{
			id: "ACTION_REVIEW",
			text: "검토",
			enabled: !closed,
		},
	];

	const isSecurity = Math.random() < 0.1;
	const businessWorkDstic = Math.random() < 0.5 ? "2" : "3"; // 2 or 3 랜덤

	let status;
	if (closed) {
		status = "FINISH";
	} else {
		status = "REVIEW";
	}
	// APPROVAL_DEPT // 현업부서 팀장에서 승인 요청
	// RECEPTION // 현업부서 팀장 승인.
	// REVIEW // 법률지원부 검토 중
	// FINISH // 검토 완료

	const APPROVAL_LINES = ["LESS", "EQUAL", "GREATER"]; // GREATER의 오타 아닐까? 암튼 좀...

	return {
		id,
		title: titles[Math.floor(Math.random() * titles.length)] + ` ${Math.floor(Math.random() * 1000)}`,
		description: descriptions[Math.floor(Math.random() * descriptions.length)],
		approvalLine: APPROVAL_LINES[Math.floor(Math.random() * APPROVAL_LINES.length)],
		status,
		businessWorkDstic, // "2" or "3"
		businessWorkDsticText: businessWorkDstic === "2" ? "매뉴얼" : "규정지침 + 매뉴얼",
		viewcode,
		viewCode: viewcode, // 리스트결과에서는 viewCode 필드가 사용됨. 묻지마...
		creatorList: creators,
		creator: creators[0].creatorName,
		creatorPosition: creators[0].creatorPosition,
		creatorDepartment: creators[0].creatorDepartment,
		creatorEmail: creators[0].creatorEmail,
		reviewers,
		createDate,
		labels,
		reviewRequestDate: createDate,
		enforcementDate: enforcementDate,
		receptionDate: receiveAt.toISOString(), // 접수 승인(by 팀장)된 시각
		replyDate: replyDate, // 검토 완료(by 팀장)된 시각
		contractHistory,
		isSecurity,
		documentReviewList: [],
		documentTargetList: [],
	};
};

// 더미 데이터 생성기 - 실제 저장된 계약 기반으로 변경
const generateContractList = (pageNum = 1, pageSize = 100) => {
	// 실제 저장된 계약들을 먼저 확인
	const storedContractIds = Array.from(dataStore.contracts.keys()).sort((a, b) => Number(b) - Number(a)); // 높은 ID부터(역순)

	// 저장된 계약이 없으면 빈 배열 반환
	if (storedContractIds.length === 0) {
		//console.log("[CONTRACT_LIST] No stored contracts found");
		return [];
	}

	// 페이징 처리
	const startIndex = (pageNum - 1) * pageSize;
	const endIndex = startIndex + pageSize;
	const pagedIds = storedContractIds.slice(startIndex, endIndex);

	// 원본 contract 객체 그대로 반환
	const contracts = pagedIds.map((id) => dataStore.contracts.get(id)).filter(Boolean);

	//console.log(`[CONTRACT_LIST] Page ${pageNum}: ${contracts.length} contracts (from ${storedContractIds.length} total)`);
	return contracts;
};

const generateContractDetail = (id) => {
	const contractId = Number(id);

	if (!contractId || contractId <= 0) {
		return null;
	}

	// 메모리에 저장된 데이터가 있으면 그것을 사용
	if (dataStore.contracts.has(contractId)) {
		return dataStore.contracts.get(contractId);
	}

	// 존재하지 않는 계약 ID에 대해서는 null 반환 (새로 생성하지 않음)
	console.log(`[CONTRACT_NOT_FOUND] Contract ID ${contractId} does not exist`);
	return null;
};

const generateChatList = (contractId) => {
	const id = Number(contractId);

	// 메모리에 저장된 채팅이 있으면 그것을 사용
	if (dataStore.chats.has(id)) {
		return dataStore.chats.get(id);
	}

	// 해당 계약이 존재하지 않으면 빈 배열 반환
	if (!dataStore.contracts.has(id)) {
		console.log(`[CHAT_NOT_FOUND] Contract ID ${id} does not exist, returning empty chat list`);
		return [];
	}

	// 계약이 존재하지만 채팅이 없으면 빈 배열로 초기화
	const chats = [];
	dataStore.chats.set(id, chats);
	return chats;
};

const generateLabelList = () => {
	return [
		{ color: "rgb(0, 255, 255, 255)", name: "검토완료", id: 745, type: "PRIVATE" },
		{ color: "rgb(0, 170, 0, 255)", name: "작업완료", id: 744, type: "PRIVATE" },
		{ color: "rgb(255, 165, 0, 255)", name: "보류", id: 746, type: "PRIVATE" },
		{ color: "rgb(255, 0, 0, 255)", name: "긴급", id: 747, type: "PRIVATE" },
	];
};

// 관리자 대시보드 HTML
const adminDashboardHTML = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Casely Mock API 관리자 대시보드</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        .section { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .section h2 { margin-top: 0; color: #333; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
        .form-group input, .form-group select, .form-group textarea { 
            width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px; 
        }
        .btn { padding: 8px 16px; margin: 2px; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; }
        .btn-primary { background: #007bff; color: white; }
        .btn-success { background: #28a745; color: white; }
        .btn-warning { background: #ffc107; color: black; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-sm { padding: 4px 8px; font-size: 11px; }
        .btn:hover { opacity: 0.8; }
        .status { padding: 10px; margin: 10px 0; border-radius: 3px; }
        .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .contract-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .contract-table th, .contract-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .contract-table th { background: #f8f9fa; }
        .contract-table tr:nth-child(even) { background: #f9f9f9; }
        .two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .three-columns { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
        .random-btn { background: #6c757d; color: white; padding: 4px 8px; font-size: 11px; }
        @media (max-width: 768px) { 
            .two-columns, .three-columns { grid-template-columns: 1fr; } 
            .contract-table { font-size: 12px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Casely Mock API 관리자 대시보드</h1>
        
        <div id="status" class="status" style="display: none;"></div>
        
        <!-- 서버 상태 -->
        <div class="section">
            <h2>📊 서버 상태</h2>
            <div id="server-status">로딩 중...</div>
            <button class="btn btn-primary" onclick="loadServerStatus()">상태 새로고침</button>
        </div>
        
        <!-- 토큰 관리 -->
        <div class="section">
            <h2>🔐 인증 토큰 관리</h2>
            <div class="two-columns">
                <div>
                    <h3>현재 토큰 정보</h3>
                    <div id="current-token-info" style="background: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 12px;">
                        로딩 중...
                    </div>
                </div>
                <div>
                    <h3>토큰 관리</h3>
                    <div class="form-group">
                        <label>사용자 ID</label>
                        <input type="number" id="token-user-id" value="1001" min="1" max="9999">
                    </div>
                    <button class="btn btn-warning" onclick="generateNewToken()">🔄 새 토큰 발급</button>
                    <button class="btn btn-success" onclick="applyTokenToLocalStorage()">💾 localStorage에 적용</button>
                    <button class="btn btn-primary" onclick="loadCurrentToken()">🔍 현재 토큰 확인</button>
                </div>
            </div>
        </div>
        
        <div class="three-columns">
            <!-- 새 계약 추가 -->
            <div class="section">
                <h2>➕ 새 계약 추가</h2>
                <form id="create-contract-form">
                    <div class="form-group">
                        <label>제목 * <button type="button" class="btn random-btn btn-sm" onclick="generateRandomContract()">랜덤</button></label>
                        <input type="text" id="new-title" required>
                    </div>
                    <div class="form-group">
                        <label>작성자</label>
                        <input type="text" id="new-creator" placeholder="새작성자">
                    </div>
                    <div class="form-group">
                        <label>부서</label>
                        <input type="text" id="new-department" placeholder="새부서">
                    </div>
                    <button type="submit" class="btn btn-success">계약 추가</button>
                </form>
            </div>
            
            <!-- 채팅 추가 -->
            <div class="section">
                <h2>� 채팅 메시지 추가</h2>
                <form id="add-chat-form">
                    <div class="form-group">
                        <label>계약 ID *</label>
                        <input type="number" id="chat-contract-id" required>
                    </div>
                    <div class="form-group">
                        <label>사용자명</label>
                        <input type="text" id="chat-username" placeholder="관리자">
                    </div>
                    <div class="form-group">
                        <label>메시지 * <button type="button" class="btn random-btn btn-sm" onclick="generateRandomChat()">랜덤</button></label>
                        <textarea id="chat-message" rows="2" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">채팅 추가</button>
                </form>
            </div>
            
            <!-- 히스토리 추가 -->
            <div class="section">
                <h2>� 히스토리 엔트리 추가</h2>
                <form id="add-history-form">
                    <div class="form-group">
                        <label>계약 ID *</label>
                        <input type="number" id="history-contract-id" required>
                    </div>
                    <div class="form-group">
                        <label>액션 텍스트 * <button type="button" class="btn random-btn btn-sm" onclick="generateRandomHistory()">랜덤</button></label>
                        <input type="text" id="history-action" required placeholder="예: 최종 검토 완료">
                    </div>
                    <button type="submit" class="btn btn-success">히스토리 추가</button>
                </form>
            </div>
        </div>
        
        <!-- 계약 목록 테이블 -->
        <div class="section">
            <h2>� 계약 관리 테이블</h2>
            <button class="btn btn-primary" onclick="loadContractsTable()">목록 새로고침</button>
            <button class="btn btn-success" onclick="saveAllData()">데이터 저장</button>
            <div style="overflow-x: auto; margin-top: 10px;">
                <table class="contract-table" id="contracts-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>제목</th>
                            <th>상태</th>
                            <th>단계</th>
                            <th>작성자</th>
                            <th>부서</th>
                            <th>등록일</th>
                            <th>액션</th>
                        </tr>
                    </thead>
                    <tbody id="contracts-tbody">
                        <tr><td colspan="8">로딩 중...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- 채팅 조회 -->
        <div class="section">
            <h2>💬 채팅 조회</h2>
            <div class="form-group">
                <label>계약 ID</label>
                <input type="number" id="view-chat-id" placeholder="채팅을 조회할 계약 ID">
                <button class="btn btn-primary" onclick="loadChats()">채팅 조회</button>
            </div>
            <div id="chat-list" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px;"></div>
        </div>
    </div>

    <script>
        // 랜덤 데이터 생성 함수들
        async function getRandomData() {
            try {
                const response = await fetch('/api/mock/random');
                return await response.json();
            } catch (error) {
                console.error('랜덤 데이터 가져오기 실패:', error);
                return {
                    title: '랜덤 계약 ' + Math.floor(Math.random() * 1000),
                    creator: '랜덤작성자',
                    department: '랜덤부서',
                    action: '랜덤 액션',
                    message: '랜덤 메시지입니다.'
                };
            }
        }

        async function generateRandomContract() {
            const data = await getRandomData();
            document.getElementById('new-title').value = data.title;
            document.getElementById('new-creator').value = data.creator;
            document.getElementById('new-department').value = data.department;
        }

        async function generateRandomChat() {
            const data = await getRandomData();
            document.getElementById('chat-message').value = data.message;
        }

        async function generateRandomHistory() {
            const data = await getRandomData();
            document.getElementById('history-action').value = data.action;
        }

        // 상태 메시지 표시
        function showStatus(message, isError = false) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = 'status ' + (isError ? 'error' : 'success');
            status.style.display = 'block';
            setTimeout(() => status.style.display = 'none', 3000);
        }

        // 서버 상태 로드
        async function loadServerStatus() {
            try {
                const response = await fetch('/api/mock/status');
                const data = await response.json();
                document.getElementById('server-status').innerHTML = \`
                    <p><strong>계약 개수:</strong> \${data.appData.contractsCount}</p>
                    <p><strong>채팅 개수:</strong> \${data.appData.chatsCount}</p>
                    <p><strong>다음 계약 ID:</strong> \${data.appData.nextContractId}</p>
                    <p><strong>저장된 계약 ID:</strong> [\${data.appData.contractIds.slice(0, 10).join(', ')}\${data.appData.contractIds.length > 10 ? '...' : ''}]</p>
                \`;
            } catch (error) {
                showStatus('서버 상태 로드 실패: ' + error.message, true);
            }
        }

        // 토큰 관리 함수들
        async function loadCurrentToken() {
            try {
                const tokenInfo = {
                    서버_현재_토큰: '${currentAuthMeta.access_token}',
                    서버_사용자ID: ${currentAuthMeta.userId},
                    localStorage_access_token: localStorage.getItem('access_token'),
                    localStorage_userId: localStorage.getItem('userId'),
                    localStorage_checkData: localStorage.getItem('checkData'),
                    마지막_갱신: new Date(${currentAuthMeta._updatedAt}).toLocaleString()
                };
                
                document.getElementById('current-token-info').innerHTML = JSON.stringify(tokenInfo, null, 2);
                showStatus('현재 토큰 정보를 불러왔습니다');
            } catch (error) {
                showStatus('토큰 정보 로드 실패: ' + error.message, true);
            }
        }

        async function generateNewToken() {
            try {
                const userId = parseInt(document.getElementById('token-user-id').value) || 1001;
                
                const response = await fetch('/api/mock/token/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
                
                const data = await response.json();
                
                if (data.returnCode === 0) {
                    showStatus(\`새 토큰이 생성되었습니다: \${data.appData.access_token.substring(0, 20)}...\`);
                    loadCurrentToken(); // 토큰 정보 새로고침
                } else {
                    showStatus('토큰 생성 실패: ' + data.returnMessage, true);
                }
            } catch (error) {
                showStatus('토큰 생성 실패: ' + error.message, true);
            }
        }

        async function applyTokenToLocalStorage() {
            try {
                const response = await fetch('/api/mock/token/current');
                const data = await response.json();
                
                if (data.returnCode === 0) {
                    const authData = data.appData;
                    
                    // 실제 서버 방식으로 localStorage에 저장
                    localStorage.setItem('access_token', authData.access_token);
                    localStorage.setItem('userId', authData.userId.toString());
                    localStorage.setItem('checkData', JSON.stringify(authData.checkData));
                    localStorage.setItem('auth_meta', JSON.stringify(authData));
                    
                    showStatus('현재 토큰이 localStorage에 적용되었습니다');
                    loadCurrentToken(); // 토큰 정보 새로고침
                } else {
                    showStatus('토큰 적용 실패: ' + data.returnMessage, true);
                }
            } catch (error) {
                showStatus('토큰 적용 실패: ' + error.message, true);
            }
        }

        // 계약 테이블 로드
        async function loadContractsTable() {
            try {
                const response = await fetch('/api/mock/status');
                const data = await response.json();
                const contractIds = data.appData.contractIds;
                
                const tbody = document.getElementById('contracts-tbody');
                
                if (contractIds.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8">저장된 계약이 없습니다.</td></tr>';
                    return;
                }

                let html = '';
                for (const id of contractIds) {
                    try {
                        const detailResponse = await fetch('/api/contract/detail', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ contract: { id } })
                        });
                        const detailData = await detailResponse.json();
                        const contract = detailData.appData;
                        
                        html += \`
                            <tr>
                                <td>\${contract.id}</td>
                                <td>\${contract.title}</td>
                                <td>
                                    <select onchange="updateStatus(\${contract.id}, this.value)">
                                        <option value="진행 중" \${contract.status === '진행 중' ? 'selected' : ''}>진행 중</option>
                                        <option value="완료" \${contract.status === '완료' ? 'selected' : ''}>완료</option>
                                    </select>
                                </td>
                                <td>\${contract.stepText}</td>
                                <td>\${contract.creator}</td>
                                <td>\${contract.creatorDepartment}</td>
                                <td>\${contract.reviewRequestDate}</td>
                                <td>
                                    <button class="btn btn-primary btn-sm" onclick="viewDetails(\${contract.id})">상세</button>
                                    <button class="btn btn-warning btn-sm" onclick="addChatToContract(\${contract.id})">채팅</button>
									<button class="btn btn-warning btn-sm" onclick="touch(\${contract.id})">Touch</button>
                                </td>
                            </tr>
                        \`;
                    } catch (err) {
                        console.error('계약 상세 로드 실패:', id, err);
                    }
                }
                
                tbody.innerHTML = html;
            } catch (error) {
                showStatus('계약 테이블 로드 실패: ' + error.message, true);
            }
        }

        // 테이블에서 상태 변경
        async function updateStatus(contractId, newStatus) {
            try {
                const response = await fetch('/api/mock/contract/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        contractId: contractId, 
						replyDate: newStatus === '완료' ? new Date().toISOString() : null,
                        status: newStatus,
                        stepText: newStatus === '완료' ? '완료' : '검토중'
                    })
                });
                const data = await response.json();
                
                if (data.returnCode === 0) {
                    showStatus(\`계약 \${contractId}의 상태가 '\${newStatus}'로 변경되었습니다\`);
                    loadContractsTable(); // 테이블 새로고침
                } else {
                    showStatus('상태 변경 실패: ' + data.returnMessage, true);
                }
            } catch (error) {
                showStatus('상태 변경 실패: ' + error.message, true);
            }
        }

		async function touch(contractId) {
			try {
				const response = await fetch('/api/mock/contract/touch', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ contractId })
				});
				const data = await response.json();
				
				if (data.returnCode === 0) {
					showStatus(\`계약 \${contractId}가 터치되었습니다\`);
					loadContractsTable(); // 테이블 새로고침
				} else {
					showStatus('터치 실패: ' + data.returnMessage, true);
				}
			} catch (error) {
				showStatus('터치 실패: ' + error.message, true);
			}
		}

        // 테이블에서 상세보기
        function viewDetails(contractId) {
            window.open(\`/api/contract/detail?id=\${contractId}\`, '_blank');
        }

        // 테이블에서 채팅 추가
        function addChatToContract(contractId) {
            document.getElementById('chat-contract-id').value = contractId;
            document.getElementById('chat-message').focus();
        }

        // 데이터 저장
        async function saveAllData() {
            try {
                const response = await fetch('/api/mock/save', { method: 'POST' });
                const data = await response.json();
                
                if (data.returnCode === 0) {
                    showStatus('모든 데이터가 저장되었습니다');
                } else {
                    showStatus('데이터 저장 실패: ' + data.returnMessage, true);
                }
            } catch (error) {
                showStatus('데이터 저장 실패: ' + error.message, true);
            }
        }

        // 채팅 로드
        async function loadChats() {
            const contractId = document.getElementById('view-chat-id').value;
            if (!contractId) {
                showStatus('계약 ID를 입력하세요', true);
                return;
            }

            try {
                const response = await fetch('/api/chat/list', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tempMap: { entityId: contractId } })
                });
                const data = await response.json();
                const chats = data.appData.chatList;
                
                let html = '';
                chats.forEach(chat => {
                    html += \`
                        <div style="padding: 8px; margin: 3px 0; background: #e9ecef; border-radius: 3px;">
                            <strong>\${chat.userName}</strong> (\${chat.createTime})<br>
                            \${chat.message}
                        </div>
                    \`;
                });
                
                document.getElementById('chat-list').innerHTML = html || '<p>채팅이 없습니다.</p>';
            } catch (error) {
                showStatus('채팅 로드 실패: ' + error.message, true);
            }
        }

        // 폼 이벤트 리스너들
        document.getElementById('create-contract-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const title = document.getElementById('new-title').value;
            const creator = document.getElementById('new-creator').value;
            const department = document.getElementById('new-department').value;
            
            try {
                const response = await fetch('/api/mock/contract/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, creator, department })
                });
                const data = await response.json();
                
                if (data.returnCode === 0) {
                    showStatus(\`새 계약이 추가되었습니다 (ID: \${data.appData.contractId})\`);
                    document.getElementById('create-contract-form').reset();
                    generateRandomContract(); // 새 랜덤 값 생성
                    loadServerStatus();
                    loadContractsTable();
                } else {
                    showStatus('계약 추가 실패: ' + data.returnMessage, true);
                }
            } catch (error) {
                showStatus('계약 추가 실패: ' + error.message, true);
            }
        });

        document.getElementById('add-chat-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const contractId = document.getElementById('chat-contract-id').value;
            const userName = document.getElementById('chat-username').value;
            const message = document.getElementById('chat-message').value;
            
            try {
                const response = await fetch('/api/mock/chat/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contractId: Number(contractId), userName, message })
                });
                const data = await response.json();
                
                if (data.returnCode === 0) {
                    showStatus(\`계약 \${contractId}에 채팅이 추가되었습니다\`);
                    document.getElementById('add-chat-form').reset();
                    generateRandomChat(); // 새 랜덤 값 생성
                    if (document.getElementById('view-chat-id').value == contractId) {
                        loadChats();
                    }
                } else {
                    showStatus('채팅 추가 실패: ' + data.returnMessage, true);
                }
            } catch (error) {
                showStatus('채팅 추가 실패: ' + error.message, true);
            }
        });

        document.getElementById('add-history-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const contractId = document.getElementById('history-contract-id').value;
            const actionText = document.getElementById('history-action').value;
            
            try {
                const response = await fetch('/api/mock/contract/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contractId: Number(contractId), actionText })
                });
                const data = await response.json();
                
                if (data.returnCode === 0) {
                    showStatus(\`계약 \${contractId}에 히스토리가 추가되었습니다\`);
                    document.getElementById('add-history-form').reset();
                    generateRandomHistory(); // 새 랜덤 값 생성
                } else {
                    showStatus('히스토리 추가 실패: ' + data.returnMessage, true);
                }
            } catch (error) {
                showStatus('히스토리 추가 실패: ' + error.message, true);
            }
        });

        // 페이지 로드시 초기 데이터 로드
        window.addEventListener('load', () => {
            loadServerStatus();
            loadContractsTable();
            loadCurrentToken(); // 토큰 정보 로드 추가
            generateRandomContract();
            generateRandomChat();
            generateRandomHistory();
        });
    </script>
</body>
</html>
`;

// 관리자 대시보드 페이지
app.get("/admin", (req, res) => {
	res.send(adminDashboardHTML);
});

// 루트 페이지 - 토큰 설정 및 리다이렉트
app.get("/", (req, res) => {
	const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Mock Server - Auth Setup</title>
    <meta charset="utf-8">
    <style>
        body { font-family: monospace; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .status { margin: 10px 0; padding: 10px; background: #e8f5e9; border-radius: 4px; }
        .redirect { color: #666; margin-top: 20px; }
        pre { background: #f0f0f0; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Mock Server Auth Setup</h1>
        <div class="status" id="status">토큰 설정 중...</div>
        
        <h3>인증 정보</h3>
        <pre id="authInfo">로딩 중...</pre>
        
        <div class="redirect">
            <p>3초 후 관리자 대시보드로 이동합니다...</p>
        </div>
    </div>

    <script>
        // 실제 서버와 동일한 localStorage 구조로 저장
        const authData = ${JSON.stringify(currentAuthMeta)};
        
        // 개별 키로 저장 (실제 서버 방식)
        localStorage.setItem('access_token', authData.access_token);
        localStorage.setItem('userId', authData.userId.toString());
        localStorage.setItem('checkData', JSON.stringify(authData.checkData));
        
        // 기존 통합 키도 호환성을 위해 유지
        localStorage.setItem('auth_meta', JSON.stringify(authData));
        
        // 화면 업데이트
        document.getElementById('status').innerHTML = '✅ 토큰이 localStorage에 저장되었습니다!';
        
        const displayInfo = {
          access_token: authData.access_token,
          userId: authData.userId,
          checkData: authData.checkData,
          저장된_키들: ['access_token', 'userId', 'checkData', 'auth_meta']
        };
        document.getElementById('authInfo').textContent = JSON.stringify(displayInfo, null, 2);
        
        console.log('[MOCK_AUTH_SETUP]', {
          access_token: localStorage.getItem('access_token'),
          userId: localStorage.getItem('userId'),
          checkData: localStorage.getItem('checkData'),
          auth_meta: localStorage.getItem('auth_meta')
        });
        
        // 3초 후 리다이렉트
        setTimeout(() => {
            window.location.href = '/admin';
        }, 3000);
    </script>
</body>
</html>`;

	res.send(html);
});

// 랜덤 데이터 API
app.get("/api/mock/random", (req, res) => {
	res.json(generateRandomData());
});

// 데이터 저장 API
app.post("/api/mock/save", (req, res) => {
	try {
		saveData();
		res.json({
			returnCode: 0,
			returnMessage: "success",
			appData: { saved: true },
		});
	} catch (error) {
		res.status(500).json({
			returnCode: -1,
			returnMessage: error.message,
			appData: null,
		});
	}
});

// 토큰 검증 미들웨어 (mock에서는 관대하게 처리)
function validateAuth(req, res, next) {
	const token = req.body?._bak_t || req.headers["authorization"]?.replace("Bearer ", "");
	const userId = req.body?.checkData?.teamTask || req.body?.userId;

	// Mock 서버에서는 토큰이 없어도 현재 토큰으로 자동 보정
	if (!token || !userId) {
		// console.log("[AUTH_AUTO_PATCH]", {
		// 	provided_token: token,
		// 	provided_userId: userId,
		// 	using_token: currentAuthMeta.access_token,
		// 	using_userId: currentAuthMeta.userId,
		// });
	}

	// request에 인증 정보 첨부 (실제 값 또는 mock 기본값)
	req.authMeta = {
		access_token: token || currentAuthMeta.access_token,
		userId: userId || currentAuthMeta.userId,
		checkData: req.body?.checkData || currentAuthMeta.checkData,
	};

	next();
}

// 계약 리스트 API (GET, POST 둘 다 지원)
const handleContractList = (req, res) => {
	//console.log("[CONTRACT_LIST]", req.method, req.body || req.query, req.authMeta);

	const { pageNum = 1, numberPerPage = 100 } = req.method === "GET" ? req.query : req.body;
	const contracts = generateContractList(pageNum, numberPerPage);

	// 실제 저장된 계약 개수
	const totalCount = dataStore.contracts.size;

	res.json({
		returnCode: 0,
		returnMessage: "success",
		viewName: null,
		appData: {
			contractList: contracts,
			totalCount,
			pageNum,
		},
	});
};

app.post("/api/contract/list", validateAuth, handleContractList);
app.get("/api/contract/list", handleContractList);

// 계약 상세 API (GET, POST 둘 다 지원)
const handleContractDetail = (req, res) => {
	//console.debug("[CONTRACT_DETAIL]", req.method, req.body || req.query, req.authMeta);

	const contractId = req.method === "GET" ? req.query.id : req.body?.contract?.id;

	if (!contractId) {
		return res.status(400).json({
			returnCode: -1,
			returnMessage: "Contract ID is required",
			appData: null,
		});
	}

	const detail = generateContractDetail(contractId);

	if (!detail) {
		return res.status(404).json({
			returnCode: -1,
			returnMessage: `Contract with ID ${contractId} not found`,
			appData: null,
		});
	}

	res.json({
		returnCode: 0,
		returnMessage: "success",
		viewName: null,
		appData: detail,
	});
};

app.post("/api/contract/detail", validateAuth, handleContractDetail);
app.get("/api/contract/detail", handleContractDetail);

// 채팅 리스트 API (GET, POST 둘 다 지원)
const handleChatList = (req, res) => {
	//console.log("[CHAT_LIST]", req.method, req.body || req.query, req.authMeta);

	const entityId = req.method === "GET" ? req.query.entityId : req.body?.tempMap?.entityId;

	if (!entityId) {
		return res.status(400).json({
			returnCode: -1,
			returnMessage: "Entity ID is required",
			appData: null,
		});
	}

	const chatList = generateChatList(Number(entityId));

	res.json({
		returnCode: 0,
		returnMessage: "success",
		viewName: null,
		appData: {
			chatList,
		},
	});
};

app.post("/api/chat/list", validateAuth, handleChatList);
app.get("/api/chat/list", handleChatList);

// 라벨 데이터 API (GET, POST 둘 다 지원)
const handleLabelList = (req, res) => {
	//console.log("[LABEL_LIST]", req.method, req.body || req.query);

	const labels = generateLabelList();

	res.json({
		returnCode: 0,
		returnMessage: "success",
		viewName: null,
		appData: {
			list: labels,
		},
	});
};

app.post("/api/label/data/list", handleLabelList);
app.get("/api/label/data/list", handleLabelList);

// 문서 다운로드 API (시뮬레이션)
app.post("/api/contract/docdown", validateAuth, (req, res) => {
	console.log("[DOC_DOWNLOAD]", req.body, req.authMeta);

	const { contractId, fileId } = req.body;

	if (!contractId || !fileId) {
		return res.status(400).json({
			returnCode: -1,
			returnMessage: "Contract ID and File ID are required",
		});
	}

	// 더미 PDF 생성 (실제로는 바이너리 데이터)
	const dummyPdf = Buffer.from(
		"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000079 00000 n \n0000000173 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n253\n%%EOF",
	);

	res.setHeader("Content-Type", "application/pdf");
	res.setHeader("Content-Disposition", `attachment; filename="contract_${contractId}_doc_${fileId}.pdf"`);
	res.send(dummyPdf);
});

// 첨부파일 다운로드 API (시뮬레이션)
app.post("/api/contract/attdown", validateAuth, (req, res) => {
	console.log("[ATT_DOWNLOAD]", req.body, req.authMeta);

	const { contractId, fileId } = req.body;

	if (!contractId || !fileId) {
		return res.status(400).json({
			returnCode: -1,
			returnMessage: "Contract ID and File ID are required",
		});
	}

	// 더미 텍스트 파일
	const dummyText = `첨부파일 ${fileId} (계약 ID: ${contractId})\n생성일시: ${new Date().toISOString()}\n\n이것은 테스트용 더미 파일입니다.`;

	res.setHeader("Content-Type", "text/plain");
	res.setHeader("Content-Disposition", `attachment; filename="attachment_${contractId}_${fileId}.txt"`);
	res.send(dummyText);
});

// =========================
// 동적 데이터 수정 API들 (GET, POST 둘 다 지원)
// =========================

// 새 계약 추가
const handleContractCreate = (req, res) => {
	console.log("[CREATE_CONTRACT]", req.method, req.body || req.query);

	const { title, description } = req.method === "GET" ? req.query : req.body;

	// generateRandomData로 기본 생성 후, 입력값으로 덮어쓰기
	let randomData = generateRandomData();
	const newId = dataStore.nextContractId++;
	// id, viewcode 등은 고정값으로 덮어쓰기
	randomData.id = newId;
	const now = new Date();
	const dateStr = now.toISOString().split("T")[0].replace(/-/g, "/");
	randomData.viewcode = `${now.toISOString().slice(0, 10).replace(/-/g, "")}-${String(newId).padStart(8, "0")}`;
	randomData.viewCode = randomData.viewcode;
	randomData.createDate = dateStr;
	randomData.reviewRequestDate = dateStr;

	if (title) randomData.title = title;
	if (description) randomData.description = description;

	dataStore.contracts.set(newId, randomData);
	saveData(); // 자동 저장

	res.json({
		returnCode: 0,
		returnMessage: "success",
		appData: {
			contractId: newId,
			contract: randomData,
		},
	});
};

app.post("/api/mock/contract/create", handleContractCreate);
app.get("/api/mock/contract/create", handleContractCreate);

// 계약 상태 변경
const handleContractStatus = (req, res) => {
	console.log("[UPDATE_STATUS]", req.method, req.body || req.query);

	const { contractId, status, stepText } = req.method === "GET" ? req.query : req.body;

	if (!contractId || !status) {
		return res.status(400).json({
			returnCode: -1,
			returnMessage: "Contract ID and status are required",
		});
	}

	// 계약 상세 정보 가져오기 (없으면 생성됨)
	const contract = generateContractDetail(contractId);

	// 상태 업데이트
	contract.status = status;
	if (stepText) contract.stepText = stepText;

	// 완료 상태로 변경시 날짜 설정
	if (status === "완료") {
		const now = new Date();
		contract.receptionDate = contract.receptionDate || now.toISOString();
		contract.replyDate = now.toISOString();

		// 히스토리에 완료 엔트리 추가
		const maxId = Math.max(...contract.contractHistory.map((h) => h.id), 0);
		contract.contractHistory.push({
			id: maxId + 1,
			actionText: "검토 완료",
			createTime: now.toLocaleString("ko-KR").replace(/\. /g, "/").replace(/:/g, ":").slice(0, -3),
			contractDocList: [],
		});
	}

	saveData(); // 자동 저장

	res.json({
		returnCode: 0,
		returnMessage: "success",
		appData: contract,
	});
};

const handleContractTouch = (req, res) => {
	console.log("[UPDATE_STATUS]", req.method, req.body || req.query);

	const { contractId } = req.method === "GET" ? req.query : req.body;

	if (!contractId) {
		return res.status(400).json({
			returnCode: -1,
			returnMessage: "Contract ID and status are required",
		});
	}

	// 계약 상세 정보 가져오기 (없으면 생성됨)
	const contract = generateContractDetail(contractId);
	const now = new Date();
	// 상태 업데이트
	if (contract.replyDate) {
		contract.replyDate = null;
			// 히스토리에 완료 엔트리 추가
		const maxId = Math.max(...contract.contractHistory.map((h) => h.id), 0);
		contract.contractHistory.push({
			id: maxId + 1,
			actionText: "반려",
			createTime: now.toLocaleString("ko-KR").replace(/\. /g, "/").replace(/:/g, ":").slice(0, -3),
			contractDocList: [],
		});
	} else {
		const now = new Date();
		contract.receptionDate = contract.receptionDate || now.toISOString();
		contract.replyDate = now.toISOString();
		// 히스토리에 완료 엔트리 추가
		const maxId = Math.max(...contract.contractHistory.map((h) => h.id), 0);
		contract.contractHistory.push({
			id: maxId + 1,
			actionText: "검토 완료",
			createTime: now.toLocaleString("ko-KR").replace(/\. /g, "/").replace(/:/g, ":").slice(0, -3),
			contractDocList: [],
		});
	}

	saveData(); // 자동 저장

	res.json({
		returnCode: 0,
		returnMessage: "success",
		appData: contract,
	});
};

app.post("/api/mock/contract/touch", handleContractTouch);
app.get("/api/mock/contract/touch", handleContractTouch);
app.post("/api/mock/contract/status", handleContractStatus);
app.get("/api/mock/contract/status", handleContractStatus);

// 채팅 메시지 추가
const handleChatAdd = (req, res) => {
	console.log("[ADD_CHAT]", req.method, req.body || req.query);

	const { contractId, message, userName } = req.method === "GET" ? req.query : req.body;

	if (!contractId || !message) {
		return res.status(400).json({
			returnCode: -1,
			returnMessage: "Contract ID and message are required",
		});
	}

	// 기존 채팅 가져오기 (없으면 생성됨)
	const chatList = generateChatList(contractId);

	// 새 채팅 추가
	const maxId = Math.max(...chatList.map((c) => c.id), 0);
	const newChat = {
		id: maxId + 1,
		contractId: Number(contractId),
		userId: 101664,
		userName: userName || "관리자",
		message: message,
		createTime: new Date().toLocaleString("ko-KR").replace(/\. /g, "/").replace(/:/g, ":").slice(0, -3),
		type: "COMMENT",
	};

	chatList.push(newChat);
	saveData(); // 자동 저장

	res.json({
		returnCode: 0,
		returnMessage: "success",
		appData: {
			chatList,
			newChat,
		},
	});
};

app.post("/api/mock/chat/add", handleChatAdd);
app.get("/api/mock/chat/add", handleChatAdd);

// ===========================
// 토큰 관리 API
// ===========================

// 새 토큰 생성
app.post("/api/mock/token/generate", (req, res) => {
	console.log("[TOKEN_GENERATE]", req.body);

	const { userId = 1001 } = req.body;

	// 새 토큰 생성
	currentAuthMeta.access_token = generateRandomToken();
	currentAuthMeta.userId = Number(userId);
	currentAuthMeta.checkData.teamTask = Number(userId);
	currentAuthMeta._updatedAt = Date.now();

	console.log("[NEW_TOKEN_GENERATED]", currentAuthMeta.access_token);

	res.json({
		returnCode: 0,
		returnMessage: "success",
		appData: currentAuthMeta,
	});
});

// 현재 토큰 조회
app.get("/api/mock/token/current", (req, res) => {
	console.log("[TOKEN_CURRENT]", req.query);

	res.json({
		returnCode: 0,
		returnMessage: "success",
		appData: currentAuthMeta,
	});
});

// 계약 히스토리 엔트리 추가
const handleHistoryAdd = (req, res) => {
	console.log("[ADD_HISTORY]", req.method, req.body || req.query);

	const { contractId, actionText } = req.method === "GET" ? req.query : req.body;

	if (!contractId || !actionText) {
		return res.status(400).json({
			returnCode: -1,
			returnMessage: "Contract ID and action text are required",
		});
	}

	// 계약 상세 정보 가져오기 (없으면 생성됨)
	const contract = generateContractDetail(contractId);

	// 새 히스토리 엔트리 추가
	const maxId = Math.max(...contract.contractHistory.map((h) => h.id), 0);
	const newEntry = {
		id: maxId + 1,
		actionText: actionText,
		createTime: new Date().toLocaleString("ko-KR").replace(/\. /g, "/").replace(/:/g, ":").slice(0, -3),
		contractDocList: [],
	};

	contract.contractHistory.push(newEntry);
	saveData(); // 자동 저장

	res.json({
		returnCode: 0,
		returnMessage: "success",
		appData: {
			contract,
			newEntry,
		},
	});
};

app.post("/api/mock/contract/history", handleHistoryAdd);
app.get("/api/mock/contract/history", handleHistoryAdd);

// 현재 메모리 데이터 상태 확인
const handleMockStatus = (req, res) => {
	res.json({
		returnCode: 0,
		returnMessage: "success",
		appData: {
			contractsCount: dataStore.contracts.size,
			chatsCount: dataStore.chats.size,
			nextContractId: dataStore.nextContractId,
			contractIds: Array.from(dataStore.contracts.keys()),
			chatContractIds: Array.from(dataStore.chats.keys()),
		},
	});
};

app.get("/api/mock/status", handleMockStatus);
app.post("/api/mock/status", handleMockStatus);

// 에러 핸들링
app.use((err, req, res, next) => {
	console.error("Server error:", err);
	res.status(500).json({
		returnCode: -1,
		returnMessage: "Internal server error",
		appData: null,
	});
});

const PORT = 8000; // 고정 포트

// 서버 시작시 데이터 로드
loadData();

// 기본 테스트 데이터가 없으면 generateRandomData()로 몇 개 생성
if (dataStore.contracts.size === 0) {
	console.log("📝 기본 테스트 데이터 생성 중...");
	const testContracts = [
		{ title: "신규 서비스 계약 검토", creator: "김철수", department: "IT부서" },
		{ title: "유지보수 계약 갱신", creator: "이영희", department: "법무팀" },
		{ title: "라이선스 계약 검토", creator: "박민수", department: "기획팀" },
		{ title: "컨설팅 계약 체결", creator: "정수연", department: "영업부" },
		{ title: "개발 용역 계약", creator: "홍길동", department: "개발팀" },
	];

	const now = new Date();
	for (let i = 0; i < 5; i++) {
		const newId = dataStore.nextContractId++;
		const contract = generateRandomData();
		contract.id = newId;
		dataStore.contracts.set(newId, contract);

				const chats = [
			{
				id: 1,
				contractId: newId,
				userId: 101664,
				userName: "담당자",
				message: `${contract.title} 검토를 시작합니다.`,
				createTime: toHistoryDateString(now),
				type: "COMMENT",
			},
		];
		dataStore.chats.set(newId, chats);
	}

	// testContracts.forEach(({ title, creator, department }) => {
	// 	const newId = dataStore.nextContractId++;
	// 	let contract = generateRandomData();
	// 	contract.id = newId;
	// 	const now = new Date();
	// 	contract.viewcode = `${now.toISOString().slice(0, 10).replace(/-/g, "")}-${String(newId).padStart(8, "0")}`;
	// 	contract.viewCode = contract.viewcode;
	// 	contract.createDate = now.toISOString().split("T")[0].replace(/-/g, "/");
	// 	contract.reviewRequestDate = contract.createDate;
	// 	contract.title = title;
	// 	contract.creator = creator;
	// 	contract.creatorDepartment = department;
	// 	dataStore.contracts.set(newId, contract);
	// 	// 기본 채팅 메시지도 추가
	// 	const chats = [
	// 		{
	// 			id: 1,
	// 			contractId: newId,
	// 			userId: 101664,
	// 			userName: "담당자",
	// 			message: `${title} 검토를 시작합니다.`,
	// 			createTime: now.toLocaleString("ko-KR").replace(/\. /g, "/").replace(/:/g, ":").slice(0, -3),
	// 			type: "COMMENT",
	// 		},
	// 	];
	// 	dataStore.chats.set(newId, chats);
	// });
	saveData();
	console.log(`✅ 기본 테스트 데이터 ${testContracts.length}개 생성 완료`);
}

app.listen(PORT, () => {
	console.log(`🚀 Casely Mock API Server running at http://localhost:${PORT}`);
	console.log(`🎛️  Admin Dashboard: http://localhost:${PORT}/admin`);
	console.log(`💾 JSON 파일 저장 활성화: ${DATA_FILE}`);
	console.log(`📊 현재 데이터: 계약 ${dataStore.contracts.size}개, 채팅 ${dataStore.chats.size}개`);
	console.log(`\n📋 Main API endpoints (GET/POST 둘 다 지원):`);
	console.log(`   /api/contract/list           - 계약 목록`);
	console.log(`   /api/contract/detail         - 계약 상세`);
	console.log(`   /api/chat/list               - 채팅 목록`);
	console.log(`   /api/label/data/list         - 라벨 목록`);
	console.log(`\n🔧 Dynamic modification endpoints (GET/POST 둘 다 지원):`);
	console.log(`   /api/mock/contract/create    - 새 계약 추가`);
	console.log(`   /api/mock/contract/status    - 계약 상태 변경`);
	console.log(`   /api/mock/chat/add           - 채팅 메시지 추가`);
	console.log(`   /api/mock/contract/history   - 히스토리 엔트리 추가`);
	console.log(`   /api/mock/status             - 메모리 데이터 상태 확인`);
	console.log(`   /api/mock/random             - 랜덤 데이터 생성`);
	console.log(`   /api/mock/save               - 데이터 수동 저장`);
});

export default app;
