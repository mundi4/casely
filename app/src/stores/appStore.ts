import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { formatISO, parse } from "date-fns";
import type { BaseEntity as BaseEntity, Contract as Contract, EntityCache, Label, Person, RefreshPolicy, Reviewer } from "../types";
import { cleanupSnapshots, loadLatestSnapshot, saveSnapshot, type SnapshotMeta } from "./snapshotDb";

export interface PendingChanges {
	contracts: EntityCache<Contract>;
	labels: EntityCache<Label>;
	lastUpdated: number;
}

interface AppState {
	bootstrapped: boolean;
	isOnline: boolean;
	isLoading: boolean;
	isSyncing: boolean;
	lastLoadedAt: number;
	lastUpdated: number; // timestamp
	currentSnapshotId?: number; // IndexedDB snapshot id
	currentSnapshotTimestamp?: number; // IndexedDB snapshot timestamp
	lastestSnapshotId?: number; // IndexedDB snapshot id
	lastestSnapshotTimestamp?: number; // IndexedDB snapshot timestamp
	currentSnapshot: SnapshotMeta | null;
	contracts: EntityCache<Contract>;
	labels: EntityCache<Label>;
	pendingChanges: PendingChanges;
	autoApplyChanges: boolean;

	bootstrap: () => Promise<void>;
	loadChanges: (autoApply?: boolean) => Promise<void>;
	applyPending: (opts?: { contractIds?: number[]; labelIds?: number[] }) => void;
	setRefreshPolicy: (id: number, policy: RefreshPolicy) => Promise<void>;
}

const apiBase = "http://localhost:8080"; // 개발용, 실제 배포시에는 빈 문자열로

type RawEntry = {
	id: number;
	updated_at: number;
	deleted_at: number | null;
};

type ContractRow = RawEntry & {
	detail: any;
	chats: any[];
	extra?: Record<string, any>;
	source_fetched_at: number;
	source_updated_at: number;
	user_updated_at: number;
	updated_at: number;
	deleted_at: number | null;
	refresh_policy?: RefreshPolicy;
};

// 서버 API 호출 함수들
const serverAPI = {
	// 서버 상태 확인
	// ping: async () => {
	// 	const response = await fetch(apiBase + "/api/ping");
	// 	if (!response.ok) throw new Error("Server not responding");
	// 	return response.json();
	// },

	sync: async ({ contracts, labels }: { contracts: number; labels: number }) => {
		console.log("Syncing since", contracts, labels);
		const response = await fetch(apiBase + "/api/sync", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				contracts: contracts ?? 0,
				labels: labels ?? 0,
			}),
		});
		if (!response.ok) throw new Error("Failed to sync");
		return response.json();
	},

	getContracts: async (updatedSince: number = 0) => {
		let url = apiBase + "/api/contracts";
		if (updatedSince) {
			url += `?updated_since=${encodeURIComponent(updatedSince)}`;
		}
		const response = await fetch(url);
		if (!response.ok) throw new Error("Failed to fetch contracts");
		return response.json();
	},

	getLabels: async (updatedSince: number = 0) => {
		let url = apiBase + "/api/labels";
		if (updatedSince) {
			url += `?updated_since=${encodeURIComponent(updatedSince)}`;
		}
		const response = await fetch(url);
		if (!response.ok) throw new Error("Failed to fetch labels");
		return response.json();
	},

	updateContract: async (id: number, updates: Partial<{ refresh_policy?: 0 | 100; notes?: string }>) => {
		const response = await fetch(apiBase + `/api/contracts/${id}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(updates),
		});
		if (!response.ok) throw new Error("Failed to update contract");
		return response.json();
	},
};

export const useAppStore = create<AppState>()(
	devtools((set, get) => ({
		bootstrapped: false,
		isOnline: false,
		isLoading: false,
		isSyncing: false,
		lastLoadedAt: 0,
		lastUpdated: 0,
		contracts: { idMap: {}, count: 0, lastUpdated: 0 },
		labels: { idMap: {}, count: 0, lastUpdated: 0 },
		pendingChanges: {
			contracts: { idMap: {}, count: 0, lastUpdated: 0 },
			labels: { idMap: {}, count: 0, lastUpdated: 0 },
			lastUpdated: 0,
		},
		autoApplyChanges: false,

		bootstrap: async () => {
			if (get().bootstrapped) return;
			try {
				const snap = await loadLatestSnapshot();
				if (snap) {
					set({
						contracts: snap.contracts,
						labels: snap.labels,
						lastLoadedAt: snap.timestamp,
						pendingChanges: {
							contracts: { idMap: {}, count: 0, lastUpdated: snap.contracts.lastUpdated },
							labels: { idMap: {}, count: 0, lastUpdated: snap.labels.lastUpdated },
							lastUpdated: 0,
						},
					});
				}
			} catch (e) {
				console.warn("Failed to load snapshot", e);
				set({
					lastLoadedAt: 0,
				});
			} finally {
				set({ bootstrapped: true });
			}
		},

		loadChanges: async (autoApply?: boolean) => {
			if (get().isLoading) return;

			set({ isLoading: true });
			try {
				autoApply = autoApply ?? get().autoApplyChanges;
				const { pendingChanges } = get();
				const contractsResult = await updateCacheFromServer(serverAPI.getContracts, pendingChanges.contracts, toContract, true);
				const labelsResult = await updateCacheFromServer(serverAPI.getLabels, pendingChanges.labels, toLabel, true);

				let newPending;
				if (contractsResult !== pendingChanges.contracts || labelsResult !== pendingChanges.labels) {
					newPending = {
						contracts: contractsResult,
						labels: labelsResult,
						lastUpdated: Math.max(contractsResult.lastUpdated, labelsResult.lastUpdated),
					};
					set({ pendingChanges: newPending });
				} else {
					newPending = pendingChanges;
				}

				if (autoApply && (newPending.contracts.count || newPending.labels.count)) {
					get().applyPending();
				}
			} finally {
				set({
					isLoading: false,
					lastLoadedAt: Date.now(),
				});
			}
		},

		applyPending: (opts) => {
			const { contracts, labels, pendingChanges } = get();
			const { newBase: newContracts, newPending: remainingContracts } = applyPendingChangesToEntityCache(
				contracts,
				pendingChanges.contracts,
				opts?.contractIds,
			);

			const { newBase: newLabels, newPending: remainingLabels } = applyPendingChangesToEntityCache(labels, pendingChanges.labels, opts?.labelIds);
			if (
				newContracts === contracts &&
				newLabels === labels &&
				remainingContracts === pendingChanges.contracts &&
				remainingLabels === pendingChanges.labels
			) {
				return;
			}

			const lastUpdated = Math.max(remainingContracts.lastUpdated, remainingLabels.lastUpdated);
			set({
				contracts: newContracts,
				labels: newLabels,
				pendingChanges: {
					contracts: remainingContracts,
					labels: remainingLabels,
					lastUpdated,
				},
			});

			if (lastUpdated && remainingContracts.count === 0 && remainingLabels.count === 0) {
				saveSnapshot({
					timestamp: lastUpdated,
					contracts: newContracts,
					labels: newLabels,
				}).then((meta) => {
					cleanupSnapshots();
					set({
						currentSnapshot: meta,
					});
				});
			}
		},

		setRefreshPolicy: async (id: number, policy: RefreshPolicy) => {
			// Optimistic update: 먼저 로컬 상태 변경
			let prevPolicy: RefreshPolicy;
			set((state) => {
				const contract = state.contracts.idMap[id];
				if (contract) {
					prevPolicy = contract.refreshPolicy;
					return {
						contracts: {
							...state.contracts,
							idMap: {
								...state.contracts.idMap,
								[id]: {
									...contract,
									refreshPolicy: policy,
								},
							},
						},
					};
				}
				return {};
			});
			try {
				const result = await serverAPI.updateContract(id, { refresh_policy: policy });
				return result;
			} catch (e) {
				// 서버 반영 실패 시 롤백
				set((state) => {
					const contract = state.contracts.idMap[id];
					if (contract) {
						return {
							contracts: {
								...state.contracts,
								idMap: {
									...state.contracts.idMap,
									[id]: {
										...contract,
										refreshPolicy: prevPolicy,
									},
								},
							},
						};
					}
					return {};
				});
				throw e;
			}
		},
	})),
);

function toContract(raw: ContractRow): Contract {
	const { id, detail } = raw;
	let extra = raw.extra || {};

	const history = detail.contractHistory || [];
	const reviewers: Reviewer[] = [];

	for (const reviewerRow of detail.reviewers) {
		const reviewer: Partial<Reviewer> = {
			name: reviewerRow.name,
			email: reviewerRow.email,
			department: reviewerRow.department,
			approvedAt: null,
		};

		const approveAction = history.find((h: any) => {
			return h.actionText === "검토완료" && h.creator === reviewer.name;
		});
		if (approveAction) {
			reviewer.approvedAt = formatISO(parse(approveAction.createTime, "yyyy/MM/dd HH:mm", new Date()));
		}

		reviewers.push(reviewer as Reviewer);
	}

	for (const entry of history) {
		//@ts-ignore
		const _actor = {
			name: entry.creator,
			department: entry.creatorDepart,
			position: entry.creatorPosition,
		};

		switch (entry.actionText) {
			case "검토요청 등록":
				// created. 무시...
				break;

			case "승인 요청":
				// 의뢰자가 의뢰부서의 캡틴에게 승인요청
				break;

			case "요청 승인":
				// 의뢰부서 캡틴이 승인
				break;

			case "접수 승인":
				// 캡틴이 승인/접수
				break;

			case "담당자 배정":
				// 캡틴이 담당자 배정
				break;

			case "담당자 삭제": // 정확한 이름 확인 필요
				// 캡틴이 담당자 삭제
				break;

			case "배정 완료":
				// 담당자(reviewer) 배정 완료
				break;

			case "배정 확인":
				// 담당자가 배정 확인
				break;

			case "검토완료":
				// 검토자가 검토완료
				break;

			case "검토 완료":
				// 캡틴이 완료.
				break;

			case "내 메모":
				// personal note
				break;

			case "파일 등록":
				break;
		}
	}

	let contract: Partial<Contract> = {
		id: raw.id,
		status: detail.replyDate ? "closed" : "open",
		title: detail.name || "",
		description: detail.description || "",
		fetchedAt: raw.source_fetched_at,
		updatedAt: raw.updated_at,
		refreshPolicy: raw.refresh_policy || 0,
		creators: detail.creatorList.map((c: any) =>
			toPerson({
				name: c.creator,
				email: c.creatorEmail,
				department: c.creatorDepartment,
			}),
		),
		reviewers,
		viewcode: detail.viewcode || `vc-${id}`,
		requestedDate: (detail.reviewRequestDate || detail.createDate).replaceAll("/", "-"),
		effectiveDate: detail.enforcementDate ? detail.enforcementDate.replaceAll("/", "-") : null,
	};
	contract.labels = extra.labels || [];
	(contract as any)._source = raw;

	return contract as Contract;
}

function toPerson({ name, email, department }: { name: string; email: string; department: string }): Person {
	return { name, email, department };
}

function toLabel(raw: any): Label {
	return {
		id: raw.id,
		name: raw.name,
		color: raw.color,
		orderRank: raw.order_rank,
		updatedAt: raw.updated_at,
		deletedAt: raw.deleted_at,
	};
}

async function updateCacheFromServer<TSource extends RawEntry, TEntity>(
	fetchFunc: (since: number) => Promise<{ items: TSource[]; max_updated_at: number }>,
	current: EntityCache<TEntity>,
	toItem: (row: TSource) => TEntity,
	keepDeleted: boolean = false,
) {
	const data = await fetchFunc(current.lastUpdated);
	if (current.lastUpdated < data.max_updated_at) {
		const newCache = {
			lastUpdated: data.max_updated_at,
			count: current.count,
			idMap: { ...current.idMap },
		};
		for (const row of data.items) {
			const id = row.id;
			if (!keepDeleted && row.deleted_at) {
				if (newCache.idMap[id]) {
					delete newCache.idMap[id];
				}
				continue;
			}
			const item = toItem(row);
			newCache.idMap[id] = item;
		}
		newCache.count = Object.keys(newCache.idMap).length;
		return newCache;
	}
	return current;
}

function applyPendingChangesToEntityCache<T extends BaseEntity>(
	base: EntityCache<T>,
	pending: EntityCache<T>,
	idsToApply?: number[],
): { newBase: EntityCache<T>; newPending: EntityCache<T> } {
	if (pending.count === 0) {
		return { newBase: base, newPending: pending };
	}

	let newBase = base;
	let newPending = pending;
	let changed = false;

	for (const id of Object.keys(pending.idMap).map(Number)) {
		if (idsToApply && !idsToApply.includes(id)) continue;

		const item = pending.idMap[id];
		if (!changed) {
			newBase = {
				idMap: { ...base.idMap },
				count: base.count,
				lastUpdated: base.lastUpdated,
			};
			newPending = {
				idMap: { ...pending.idMap },
				count: pending.count,
				lastUpdated: pending.lastUpdated,
			};
			changed = true;
		}

		if (item.deletedAt) {
			delete newBase.idMap[id];
		} else {
			newBase.idMap[id] = item;
		}
		delete newPending.idMap[id];
	}

	if (changed) {
		newBase.count = Object.keys(newBase.idMap).length;
		newPending.count = Object.keys(newPending.idMap).length;
		if (newPending.count === 0) {
			newBase.lastUpdated = Math.max(base.lastUpdated, pending.lastUpdated);
			//newPending.lastUpdated = 0; 이걸 0으로 돌려버리면 매번 전체 데이터를 로드해버리게 됨.
		}
	}

	return { newBase, newPending };
}
