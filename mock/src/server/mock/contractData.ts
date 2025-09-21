// 고정 리뷰어는 reviewerData.ts에서 import
import { FIXED_REVIEWERS } from "./reviewerData";
import { positionTitles } from "./positionTitles";
// ContractCreator mock generator
import type { ContractCreator } from "../../types";

export function createContractCreator(): ContractCreator {
	const name = faker.person.fullName().replaceAll(" ", "");
	const position = faker.helpers.arrayElement(positionTitles);
	const rank = faker.number.int({ min: 1, max: 4 });
	const department = faker.helpers.arrayElement(["인사부", "인력관리부", "여신관리심사부", "여신개인부", "전략기획부"]);
	const positionNameAndRankName = `${position}[${rank}]`;
	const email = faker.internet.email();
	return {
		creator: name,
		creatorDepartment: department,
		positionNameAndRankName,
		creatorEmail: email,
		displayName: `${name} ${positionNameAndRankName}`,
		creatorPosition: position,
	};
}
// contractData.ts
import { ko, Faker } from "@faker-js/faker";
import type { ContractDetail } from "../../types";

export type Contract = {
	id: number;
	title: string;
	creator: string;
	status: string;
	createdAt: number;
	updatedAt: number;
	deleted?: boolean;
};

let contractIdCounter = 10000;
let contractTimeCounter = Date.now() - 1000 * 60 * 60 * 24 * 10;

export function setContractCounters(id: number, time: number) {
	contractIdCounter = id;
	contractTimeCounter = time;
}

export function getContractCounters() {
	return { contractIdCounter, contractTimeCounter };
}
const faker = new Faker({ locale: ko });

export function mockContractDetail(): ContractDetail {
	// 10% 확률로 두 명, 그 외에는 한 명
	const creatorCount = faker.number.int({ min: 1, max: 10 }) === 1 ? 2 : 1;
	const creatorList = Array.from({ length: creatorCount }, () => createContractCreator());
	// reviewers: FIXED_REVIEWERS에서 1~2명 랜덤 선택
	const reviewerCount = faker.number.int({ min: 1, max: 2 });
	const reviewers = faker.helpers.shuffle(FIXED_REVIEWERS).slice(0, reviewerCount);
	const createDate = faker.date.recent();
	const contract: ContractDetail = {
		approvalLine: faker.helpers.arrayElement(["LESS", "EQUAL", "GRATER"]),
		positionNameAndRankName: creatorList[0].positionNameAndRankName,
		isSigned: faker.datatype.boolean(),
		elecApprovalDocNo: faker.datatype.boolean() ? faker.string.alphanumeric(10) : null,
		creatorEmail: creatorList[0].creatorEmail,
		contractMemo: faker.lorem.sentence(),
		creatorPosition: creatorList[0].creatorPosition,
		validFrom: faker.date.past().toISOString(),
		type: faker.helpers.arrayElement(["TYPE1", "TYPE2", null]),
		isMultiSignStep: faker.datatype.boolean(),
		signMemberList: [],
		opponent: faker.company.name(),
		directorsDate: faker.date.past().toISOString(),
		isIndividualTypeAutoUpdate: faker.datatype.boolean(),
		isInOwner: faker.datatype.boolean(),
		documentReviewList: [],
		lastReviewDoc: {},
		replyDate: faker.date.recent().toISOString(),
		relatedDepartment: faker.company.name(),
		opponentList: [],
		isOpen: faker.datatype.boolean(),
		isTemp: faker.datatype.boolean(),
		name: faker.lorem.words(3),
		isDomesticOrAbroad: faker.datatype.boolean(),
		oppositeList: [],
		isCreateUser: faker.datatype.boolean(),
		actions: [],
		isAffiliateTrade: faker.datatype.boolean(),
		isContainSignStep: faker.datatype.boolean(),
		status: faker.helpers.arrayElement(["FINISH", "REVIEW", "RECEPTION", "APPROVAL_DEPT"]),
		isSecurity: faker.datatype.boolean(),
		provisionClassification: faker.lorem.word(),
		resultReviewDate: faker.date.recent().toISOString(),
		creatorDepartment: creatorList[0].creatorDepartment,
		contry: "",
		alarmData: [],
		description: faker.lorem.sentence(),
		enforcementDate: faker.date.future().toISOString().slice(0, 10).replace(/-/g, "/"),
		elecApprovalDate: faker.date.future().toISOString(),
		commissionReport: faker.lorem.sentence(),
		contractHistory: [],
		creator: creatorList[0].creator,
		contractAttachment: [],
		reviewRequestDate: faker.date.recent().toISOString().slice(0, 10).replace(/-/g, "/"),
		lawyerList: [],
		reviewers,
		labelList: [],
		documentTargetList: [],
		creatorList,
		validEnd: faker.date.future().toISOString(),
		relations: [],
		category: {
			text: faker.helpers.arrayElement(["규정지침", "매뉴얼", "규정지침/매뉴얼"]),
			childId: null,
			type: "GUIDELINE",
			parentId: 65,
		},
		is_multi: faker.datatype.boolean(),
		createDate: createDate.toISOString().slice(0, 10).replace(/-/g, "/"),
		viewcode: `${faker.date.recent().toISOString().slice(0, 10).replace(/-/g, "/")}-${faker.string.numeric(8)}`,
		receptionDate: faker.date.recent().toISOString(),
		writeDocNo: `${faker.company.name()} ${faker.number.int({ min: 1000, max: 9999 })}`,
	};

	let historyIdCounter = 50000;
	contract.contractHistory.unshift({
		type: "workflow",
		actionText: "승인 요청",
		creator: contract.creatorList[0].creator,
		createTime: formatYYYYMMDDHHMM(createDate),
		isShowComment: true,
		comment: " [채상재/의뢰부서명님께 (요청 승인) 단계로 승인 요청 했습니다.]",
		id: historyIdCounter++,
		creatorDept: contract.creatorList[0].creatorDepartment,
		creatorPosition: contract.creatorList[0].creatorPosition,
		extraInfo: {
			historyType: "history_itm_contract",
		},
	});
	// contract.contractHistory.unshift({
	// 	type: "workflow",
	// 	actionText: "승인 요청",
	// 	creator: contract.creatorList[0].creator,
	// 	createTime: formatYYYYMMDDHHMM(createDate),
	// 	isShowComment: true,
	// 	comment: " [채상재/의뢰부서명님께 (요청 승인) 단계로 승인 요청 했습니다.]",
	// 	id: historyIdCounter++,
	// 	creatorDept: contract.creatorList[0].creatorDepartment,
	// 	creatorPosition: contract.creatorList[0].creatorPosition,
	// 	extraInfo: {
	// 		historyType: "history_itm_contract",
	// 	},
	// });

	return contract;
}

function formatYYYYMMDDHHMM(date: Date): string {
	return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
