// ContractDetail type for /api/mock/contract/detail
export type ContractDetail = {
	id: number;
	businessWorkDstic: "1" | "2" | "3";
	approvalLine: "LESS" | "EQUAL" | "GRATER";
	positionNameAndRankName: string;
	isSigned: boolean | null;
	elecApprovalDocNo: string | null;
	creatorEmail: string;
	contractMemo: string | null;
	creatorPosition: string;
	validFrom: string | null;
	type: string | null;
	isMultiSignStep: boolean;
	signMemberList: any[];
	opponent: string | null;
	directorsDate: string | null;
	isIndividualTypeAutoUpdate: boolean | null;
	isInOwner: boolean;
	documentReviewList: any[];
	lastReviewDoc: any;
	replyDate: string; // ISO string ex. "2025-09-03T08:13:21.792+00:00".  "FINISH" 상태일때는 이 값이 있음.
	relatedDepartment: string | null;
	opponentList: any[];
	isOpen: boolean | null;
	isTemp: boolean;
	name: string;
	isDomesticOrAbroad: boolean;
	oppositeList: any[];
	isCreateUser: boolean;
	actions: any[];
	isAffiliateTrade: boolean | null;
	isContainSignStep: boolean;
	status: "FINISH" | "REVIEW" | "RECEPTION" | "APPROVAL_DEPT";
	isSecurity: boolean;
	provisionClassification: string | null;
	resultReviewDate: string | null;
	creatorDepartment: string;
	contry: string | null; // 원본서버의 오타. 그대로 둘 것.
	alarmData: any[];
	description: string;
	enforcementDate: string; // YYYY/MM/DD | ""
	elecApprovalDate: string | null;
	commissionReport: string | null;
	contractHistory: ContractHistory[];
	creator: string;
	contractAttachment: any[];
	reviewRequestDate: string;
	lawyerList: any[];
	reviewers: ContractReviewer[];
	labelList: Label[];
	documentTargetList: any[];
	creatorList: ContractCreator[]; // 대부분 한명. 간간히 두명까지만.
	validEnd: string | null;
	relations: any[];
	category: ContractCategory;
	is_multi: boolean;
	createDate: string; // YYYY/MM/DD
	viewcode: string; // YYYY/MM/DD-XXXXXXXX => XXXXXXXX은 0으로 패드된 id
	receptionDate: string; // ISO string ex. "2025-09-03T08:13:21.792+00:00",
	writeDocNo: string; // 최종 시행문서 이름. "여신관리부 3231", "준법부 942", ...
};

interface ContractHistoryBase {
	type: string;
	actionText: string;
	creator: string;
	createTime: string;
	isShowComment: boolean;
	comment: string;
	id: number;
	creatorDept: string;
	creatorPosition: string;
	extraInfo: {
		historyType: string;
	};
}

export interface ContractHistoryMemo extends ContractHistoryBase {
	type: "mymemo";
	actionText: string;
}

export interface ContractHistoryWorkflow extends ContractHistoryBase {
	type: "workflow";
	actionText: "검토 완료" | "검토완료" | "배정확인" | "배정 완료" | "담당자 배정" | "접수 승인" | "요청 승인" | "검토요청 등록" | "승인 요청";
}

// 파일등록(첨부)
export interface ContractHistoryAttachment extends ContractHistoryBase {
	actionText: "파일등록";
	type: "attachment";
	contractDocList?: (ContractAttachment | DocumentReviewFile)[];
}

export type ContractHistory = ContractHistoryMemo | ContractHistoryWorkflow | ContractHistoryAttachment;

// 의뢰인
export type ContractCreator = {
	creator: string; // 이름. 예: "홍길동"
	creatorDepartment: string; // 의뢰인의 부서. 예: "법무팀"
	positionNameAndRankName: string; // 직급 및 직책. 예: "팀원[L2]"   팀원|팀장[L0|L1|L2|L3|L4]
	creatorEmail: string; // 의뢰인의 이메일.
	displayName: string; // "${creator} ${positionNameAndRankName}" 예: "홍길동 팀원[L2]"
	creatorPosition: string; // 직책. 예: "팀원", "팀장"
};

export type ContractReviewer = {
	reviewerId: number;
	telNumber: null;
	name: string; // 이름
	position: string; // 직책. 예: "팀원" | "팀장"
	type: "REVIEWER";
	department: string; // 가짜 부서명으로 "법률도움부"로 고정해서 만들 것
	employeeNo: string; // 사번이지만 문자열의 형태로 "2328323"
	email: string; // 사번@XXX.COM
	companyReg: null; // 모르겠으니가 null 유지
	memberId: number; // 사번과는 다른 내부 사이트 멤버 아이디. 숫자.
};

export type Label = {
	id: number; //
	name: string; // 예: "주의 요망", "긴급 처리 요망" 등...
	color: string; // 예: rgb(0, 255, 255, 255)
	type: string; // PRIVATE | PUBLIC
};

export type DocumentReviewFile = {
	fileText: string; // 파일에서 텍스트만 추출한건데 간단히 두세줄 문장 만들든지..
	fileName: string; // 파일명. 예: "계약서_초안_v1.docx"
	filepath: string; // base64로 인코딩된 파일명?
	type: "REVIEW" | "TARGET" | "contractAttachmentReview"; // REVIEW | TARGET
	fileId: number; // 파일 아이디. 숫자.
	isHide: boolean; //
};

export type ContractAttachment = {
	path: string; // base64로 인코딩된 파일명?
	fileText: string; // 파일에서 텍스트만 추출한건데 간단히 두세줄 문장 만들든지..
	fileName: string; // 파일명. 예: "계약서_초안_v1.docx"
	extension: string; // 확장자. 예: "docx", "pdf"
	type: "REVIEW" | "TARGET" | "contractAttachmentReview";
	id: number | string; // 파일 아이디. 숫자.
};

export type ContractCategory = {
	text: "규정지침" | "매뉴얼" | "규정지침/매뉴얼";
	childId: null;
	type: "GUIDELINE"; // | "MANUAL" | "GUIDELINE/MANUAL"; // ???
	parentId: 65;
};
