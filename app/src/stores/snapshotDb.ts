import type { EntityCache, Contract, Label } from "../types";

// -------------------------
// 스키마 정의
// -------------------------

// Meta 스토어에 저장할 데이터
export interface SnapshotMeta {
	id: number; // autoIncrement PK
	timestamp: number; // 저장 시각
	contractLastUpdated: number;
	labelLastUpdated: number;
}

// Data 스토어에 저장할 데이터
export interface SnapshotData {
	id: number; // meta와 동일
	contracts: EntityCache<Contract>;
	labels: EntityCache<Label>;
}

// -------------------------
// DB 설정
// -------------------------
const DB_NAME = "casely-db";
const META_STORE = "snapshot_meta";
const DATA_STORE = "snapshot_data";
const DB_VERSION = 1;

// -------------------------
// DB 열기
// -------------------------
export async function openSnapshotDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = () => {
			const db = req.result;

			if (!db.objectStoreNames.contains(META_STORE)) {
				db.createObjectStore(META_STORE, { keyPath: "id", autoIncrement: true });
			}
			if (!db.objectStoreNames.contains(DATA_STORE)) {
				db.createObjectStore(DATA_STORE, { keyPath: "id" });
			}
		};

		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

// -------------------------
// 스냅샷 저장
// -------------------------
export async function saveSnapshot(snapshot: Omit<SnapshotData, "id"> & { timestamp: number }): Promise<SnapshotMeta> {
	const db = await openSnapshotDB();

	// 최신 메타 불러오기
	const latest = await loadLatestSnapshotMeta();
	if (latest && latest.contractLastUpdated === snapshot.contracts.lastUpdated && latest.labelLastUpdated === snapshot.labels.lastUpdated) {
		if (import.meta.env.DEV) {
			console.debug("Snapshot unchanged, skip save");
		}
		return latest;
	}

	return new Promise((resolve, reject) => {
		const tx = db.transaction([META_STORE, DATA_STORE], "readwrite");
		const metaStore = tx.objectStore(META_STORE);
		const dataStore = tx.objectStore(DATA_STORE);

		const metaWithoutId: Omit<SnapshotMeta, "id"> = {
			timestamp: snapshot.timestamp,
			contractLastUpdated: snapshot.contracts.lastUpdated,
			labelLastUpdated: snapshot.labels.lastUpdated,
		};

		const metaReq = metaStore.add(metaWithoutId);

		metaReq.onsuccess = () => {
			const id = metaReq.result as number;
			dataStore.put({
				id,
				contracts: snapshot.contracts,
				labels: snapshot.labels,
			});
		};

		tx.oncomplete = () => {
			const id = metaReq.result as number;
			resolve({ id, ...metaWithoutId });
		};

		tx.onerror = () => reject(tx.error);
	});
}

// -------------------------
// 메타 목록 가져오기
// -------------------------
export async function listSnapshotMetas(): Promise<SnapshotMeta[]> {
	const db = await openSnapshotDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(META_STORE, "readonly");
		const store = tx.objectStore(META_STORE);
		const req = store.getAll();

		req.onsuccess = () => {
			const all = req.result as SnapshotMeta[];
			all.sort((a, b) => a.timestamp - b.timestamp);
			resolve(all);
		};
		req.onerror = () => reject(req.error);
	});
}

// -------------------------
// 특정 스냅샷 로드
// -------------------------
export async function loadSnapshotById(id: number): Promise<SnapshotData | null> {
	const db = await openSnapshotDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(DATA_STORE, "readonly");
		const store = tx.objectStore(DATA_STORE);
		const req = store.get(id);

		req.onsuccess = () => resolve((req.result as SnapshotData) || null);
		req.onerror = () => reject(req.error);
	});
}

// -------------------------
// 가장 최근 스냅샷 불러오기
// -------------------------
export async function loadLatestSnapshot(): Promise<(SnapshotData & SnapshotMeta) | null> {
	const db = await openSnapshotDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction([META_STORE, DATA_STORE], "readonly");
		const metaStore = tx.objectStore(META_STORE);
		const dataStore = tx.objectStore(DATA_STORE);

		// id 내림차순 커서 → 가장 최신 snapshot 하나만
		const req = metaStore.openCursor(null, "prev");

		req.onsuccess = () => {
			const cursor = req.result;
			if (!cursor) {
				resolve(null);
				return;
			}

			const meta = cursor.value as SnapshotMeta;
			const dataReq = dataStore.get(meta.id);

			dataReq.onsuccess = () => {
				const data = dataReq.result as SnapshotData | undefined;
				if (!data) {
					resolve(null);
					return;
				}
				resolve({ ...meta, ...data });
			};

			dataReq.onerror = () => reject(dataReq.error);
		};

		req.onerror = () => reject(req.error);
	});
}

// -------------------------
// 스냅샷 정리
// -------------------------
export async function cleanupSnapshots(): Promise<void> {
	const db = await openSnapshotDB();
	const tx = db.transaction([META_STORE, DATA_STORE], "readwrite");
	const metaStore = tx.objectStore(META_STORE);
	const dataStore = tx.objectStore(DATA_STORE);

	const req = metaStore.getAll();

	return new Promise((resolve, reject) => {
		req.onsuccess = () => {
			const all = req.result as SnapshotMeta[];
			if (all.length <= 1) return resolve();

			const now = Date.now();
			const survivors = new Set<number>();

			// 최신 1개는 무조건 유지
			const latest = all.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
			survivors.add(latest.id);

			// 하루 기준 마지막만 유지 (최근 30일 이내)
			const perDay = new Map<string, SnapshotMeta>();
			for (const snap of all) {
				const age = now - snap.timestamp;
				if (age > 30 * 24 * 60 * 60 * 1000) {
					continue; // 30일 이상 → 삭제
				}
				const dayKey = new Date(snap.timestamp).toISOString().slice(0, 10);
				const prev = perDay.get(dayKey);
				if (!prev || prev.timestamp < snap.timestamp) {
					perDay.set(dayKey, snap);
				}
			}
			for (const snap of perDay.values()) {
				survivors.add(snap.id);
			}

			// 삭제 처리
			for (const snap of all) {
				if (!survivors.has(snap.id)) {
					metaStore.delete(snap.id);
					dataStore.delete(snap.id);
				}
			}

			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		};
		req.onerror = () => reject(req.error);
	});
}

// -------------------------
// 최신 메타 불러오기
// -------------------------
export async function loadLatestSnapshotMeta(): Promise<SnapshotMeta | null> {
	const db = await openSnapshotDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(META_STORE, "readonly");
		const store = tx.objectStore(META_STORE);
		const req = store.openCursor(null, "prev"); // timestamp 기준 역순

		req.onsuccess = () => {
			const cursor = req.result;
			resolve(cursor ? (cursor.value as SnapshotMeta) : null);
		};
		req.onerror = () => reject(req.error);
	});
}
