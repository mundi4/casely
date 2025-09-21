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
		setContractCounters(parsed.contractIdCounter ?? 10000, parsed.contractTimeCounter ?? Date.now());
		setLabelCounters(parsed.labelIdCounter ?? 1000, parsed.labelTimeCounter ?? Date.now());
		return {
			contracts: parsed.contracts ?? [],
			labels: parsed.labels ?? [],
		};
	} catch (e) {
		// fallback: generate initial data
		let contractIdCounter = 10000;
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
			mockData.contracts = mockData.contracts.map((c) => (c.id === id ? { ...c, } : c));
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
