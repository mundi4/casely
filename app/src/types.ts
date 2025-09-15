// --- Sync API Types ---

export interface SyncRequest {
	since: {
		contract: number; // ms timestamp
		label: number;    // ms timestamp
	};
}

// contracts/labels: snapshot rows (updated_at > since), including deleted_at
export interface ContractSyncRow {
	[key: string]: any; // for now, allow any fields (should match DB)
	id: number;
	updated_at: number;
	deleted_at: number | null;
}

export interface LabelSyncRow {
	[key: string]: any;
	id: number;
	updated_at: number;
	deleted_at: number | null;
}

export interface SyncResponse {
	contracts: ContractSyncRow[];
	labels: LabelSyncRow[];
}
// Global type definitions for the contract review application

export interface BaseEntity {
	id: number;
	updatedAt: number;
	deletedAt: number | null;
}

export interface Contract extends BaseEntity {
	viewcode: string; // 20250903-00014929
	creators: Person[];
	reviewers: Reviewer[];
	title: string;
	description: string;
	status: "open" | "closed";
	fetchedAt: number;
	requestedDate: string; // YYYY-MM-DD
	effectiveDate: string | null; // YYYY-MM-DD
	labels: number[];
	_source: any;
}

export interface Person {
	name: string;
	email?: string;
	employeeId?: string | number;
	memberId?: number;
	position?: string;
	positionNameAndRankName?: string;
	department?: string;
}

export interface Reviewer extends Person {
	approvedAt: string | null; // ISO 8601 string or null
}

export interface Label extends BaseEntity {
	name: string;
	color: string;
	orderRank: number;
}

export type EntityCache<T> = {
	lastUpdated: number;
	idMap: Record<number, T>;
	count: number;
};

const ReviewStatus = {
	APPROVAL_DEPT: "APPROVAL_DEPT", // 현업부서 팀장에서 승인 요청
	RECEPTION: "RECEPTION", // 현업부서 팀장 승인.
	REVIEW: "REVIEW", // 법률지원부 검토 중
	FINISH: "FINISH", // 검토 완료
} as const;

export type ReviewStatus = typeof ReviewStatus[keyof typeof ReviewStatus];