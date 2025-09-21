import type { Connect } from "vite";
import fs from "fs";
import path from "path";
import { setContractCounters, getContractCounters, mockContractDetail } from "./src/server/mock/contractData";
import { createLabel, setLabelCounters, getLabelCounters } from "./src/server/mock/labelData";
import type { ContractDetail, Label } from "./src/types";

const DATA_PATH = path.resolve(__dirname, "mockData.json");

type ContractDetailWithId = ContractDetail & { id: number; deleted?: boolean };
interface MockData {
	contracts: ContractDetailWithId[];
	labels: Label[];
}

function loadData(): MockData {
	try {
		const raw = fs.readFileSync(DATA_PATH, "utf-8");
		const parsed = JSON.parse(raw);
		setContractCounters(parsed.contractIdCounter ?? 14881, parsed.contractTimeCounter ?? Date.now());
		setLabelCounters(parsed.labelIdCounter ?? 1000, parsed.labelTimeCounter ?? Date.now());
		return {
			contracts: parsed.contracts ?? [],
			labels: parsed.labels ?? [],
		};
	} catch (e) {
		// fallback: generate initial data
		let contractIdCounter = 14881;
		const contracts: ContractDetailWithId[] = Array.from({ length: 10 }, () => {
			const detail = mockContractDetail();
			return { ...detail, id: contractIdCounter++ };
		});
		const labels = Array.from({ length: 5 }, () => createLabel());
		saveData({ contracts, labels });
		return { contracts, labels };
	}
}

function saveData(data: MockData) {
	const contractCounters = getContractCounters();
	const labelCounters = getLabelCounters();
	fs.writeFileSync(
		DATA_PATH,
		JSON.stringify(
			{
				...data,
				contractIdCounter: contractCounters.contractIdCounter,
				contractTimeCounter: contractCounters.contractTimeCounter,
				labelIdCounter: labelCounters.labelIdCounter,
				labelTimeCounter: labelCounters.labelTimeCounter,
			},
			null,
			2,
		),
	);
}

let mockData: MockData = loadData();

export function apiHandlers(): Connect.NextHandleFunction {
	return (req, res, next) => {
		console.log(`[mock api] ${req.method} ${req.url}`);

		if (req.url?.startsWith("/api/contract/detail")) {
			res.setHeader("Content-Type", "application/json");
			let id: number | undefined;
			if (req.method === "GET") {
				const url = new URL(req.url!, "http://localhost");
				id = Number(url.searchParams.get("id"));
			} else if (req.method === "POST") {
				try {
					const chunks: Buffer[] = [];
					req.on("data", (chunk) => chunks.push(chunk));
					req.on("end", () => {
						try {
							const body = JSON.parse(Buffer.concat(chunks).toString());
							// payload 예시: { _bak_t, schEpicId, checkData, contract: { id } }
							if (body.contract && typeof body.contract.id === "number") {
								id = body.contract.id;
							} else if (typeof body.id === "number") {
								id = body.id;
							} else {
								// 혹시 contractId 등 다른 이름이 들어올 경우
								id = Number(body.contractId ?? body.id);
							}
						} catch {}
						sendDetail();
					});
					return;
				} catch {}
			}
			function sendDetail() {
				const contract = mockData.contracts.find((c) => c.id === id);
				if (!contract) {
					res.statusCode = 404;
					res.end(JSON.stringify({ error: "Not found" }));
					return;
				}

				res.end(
					JSON.stringify({
						returnCode: 0,
						returnMessage: "success",
						viewName: null,
						appData: contract,
					}),
				);
			}
			if (req.method === "GET") {
				sendDetail();
			}
			return;
		}

		if (req.url?.startsWith("/api/chat/list")) {
			res.setHeader("Content-Type", "application/json");
			let contractId: number | undefined;
			if (req.method === "GET") {
				const url = new URL(req.url!, "http://localhost");
				contractId = Number(url.searchParams.get("contractId") ?? url.searchParams.get("entityId") ?? url.searchParams.get("id"));
			} else if (req.method === "POST") {
				try {
					const chunks: Buffer[] = [];
					req.on("data", (chunk) => chunks.push(chunk));
					req.on("end", () => {
						try {
							const body = JSON.parse(Buffer.concat(chunks).toString());
							// tempMap.entityId 우선 추출
							if (body.tempMap && typeof body.tempMap.entityId === "number") {
								contractId = body.tempMap.entityId;
							} else {
								contractId = Number(
									body.contractId ??
									body.entityId ??
									body.id
								);
							}
						} catch {}
						sendChats();
					});
					return;
				} catch {}
			}
			function sendChats() {
				// 간단한 mock chat 리스트 생성
				const ret = {
					returnCode: 0,
					returnMessage: "success",
					viewName: null,
					appData: {
						chatList: [],
					},
				};
				res.end(JSON.stringify(ret));
			}
			if (req.method === "GET") {
				sendChats();
			}
			return;
		}

		if (req.url?.startsWith("/api/contract/list")) {
			// /api/contract/list: 전체 목록 반환 (GET/POST)

			res.setHeader("Content-Type", "application/json");

			const list = mockData.contracts
				.map((c) => {
					const item = { ...c } as any;
					if (item.businessWorkDstic === "1") {
						item.businessWorkDsticText = "규정지침";
					} else if (item.businessWorkDstic === "2") {
						item.businessWorkDsticText = "매뉴얼";
					} else {
						item.businessWorkDsticText = "규정지침 + 매뉴얼";
					}
					return item;
				})
				.sort((a, b) => b.id - a.id);

			const ret = {
				returnCode: 0,
				returnMessage: "success",
				viewName: null,
				appData: {
					contractList: list,
					totalCount: list.length,
					pageNum: 1,
				},
			};

			res.end(JSON.stringify(ret));
			return;
		}

		// /api/mock/contract/list: 모든 contract 반환 (GET/POST)
		if (req.url?.startsWith("/api/mock/contract/list")) {
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify(mockData.contracts));
			return;
		}
		// contract create (mockContractDetail 사용)
		if (req.url?.startsWith("/api/mock/contract/create")) {
			// id는 마지막 contract의 id+1 또는 10000부터 시작
			const nextId = mockData.contracts.length > 0 ? Math.max(...mockData.contracts.map((c) => c.id ?? 10000)) + 1 : 10000;
			const contract: ContractDetailWithId = { ...mockContractDetail(), id: nextId };
			mockData.contracts.push(contract);
			saveData(mockData);
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify(contract));
			return;
		}
		// contract delete (soft delete)
		if (req.url?.startsWith("/api/mock/contract/delete")) {
			const url = new URL(req.url!, "http://localhost");
			const id = Number(url.searchParams.get("id"));
			mockData.contracts = mockData.contracts.map((c) => (c.id === id ? { ...c } : c));
			saveData(mockData);
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify({ success: true }));
			return;
		}
		// label list
		if (req.url?.startsWith("/api/mock/label/list")) {
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify(mockData.labels));
			return;
		}
		// label create
		if (req.url?.startsWith("/api/mock/label/create")) {
			const label = createLabel();
			mockData.labels.push(label);
			saveData(mockData);
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify(label));
			return;
		}
		// label delete (soft delete)
		if (req.url?.startsWith("/api/mock/label/delete")) {
			const url = new URL(req.url!, "http://localhost");
			const id = Number(url.searchParams.get("id"));
			mockData.labels = mockData.labels.map((l) => (l.id === id ? { ...l, deleted: true, updatedAt: Date.now() } : l));
			saveData(mockData);
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify({ success: true }));
			return;
		}
		next();
	};
}
