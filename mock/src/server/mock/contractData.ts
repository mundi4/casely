// 고정 리뷰어는 reviewerData.ts에서 import
import { FIXED_REVIEWERS } from "./reviewerData";
import { positionTitles } from "./positionTitles";
// ContractCreator mock generator
import type { ContractAttachment, ContractCreator, ContractHistory, ContractHistoryAttachment, ContractReviewer } from "../../types";

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
import { ko, Faker, fa } from "@faker-js/faker";
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

let contractIdCounter = 14881;
let contractTimeCounter = Date.now() - 1000 * 60 * 60 * 24 * 10;

let historyIdCounter = 50000;

export function setContractCounters(id: number, time: number) {
	contractIdCounter = id;
	contractTimeCounter = time;
}

export function getContractCounters() {
	return { contractIdCounter, contractTimeCounter };
}
const faker = new Faker({ locale: ko });

function daysAgoFromNow(days: number): Date {
	const date = new Date();
	date.setDate(date.getDate() - days);
	return date;
}

function addDays(date: Date, days: number): Date {
	const newDate = new Date(date);
	newDate.setDate(newDate.getDate() + days);
	return newDate;
}

function addMinutes(date: Date, minutes: number): Date {
	const newDate = new Date(date);
	newDate.setMinutes(newDate.getMinutes() + minutes);
	return newDate;
}

function formatYYYYMMDDHHMM(date: Date): string {
	return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function mockContractDetail(refDate?: Date): ContractDetail {
	refDate = refDate ?? new Date();
	let status = "APPROVAL_DEPT"; // = faker.helpers.arrayElement(["FINISH", "REVIEW", "RECEPTION", "APPROVAL_DEPT"]);
	const createDate = faker.date.recent({ days: 10, refDate });
	let reviewRequestDate = faker.date.between({ from: createDate, to: addDays(createDate, 1) });
	const creatorCount = faker.number.int({ min: 1, max: 10 }) === 1 ? 2 : 1;
	const creatorList = Array.from({ length: creatorCount }, () => createContractCreator());
	// receptionDate = closed || faker.number.int({ min: 1, max: 10 }) > 1 ? faker.date.between({ from: createDate, to: addDays(createDate, 1) }) : null;
	const enforcementDate = faker.number.int({ min: 1, max: 10 }) < 7 ? faker.date.between({ from: createDate, to: addDays(createDate, 10) }) : null;
	let replyDate: Date | undefined = undefined; // closed || faker.number.int({ min: 1, max: 10 }) > 1 ? faker.date.between({ from: createDate, to: addDays(createDate, 3) }) : null;
	const history: ContractHistory[] = [];

	const theirTeamLeader = faker.person.fullName().replaceAll(" ", "");
	let current = createDate;
	let receptionDate: Date | undefined = undefined;

	const reviewerCount = faker.number.int({ min: 1, max: 2 });
	const reviewers = faker.helpers.shuffle(FIXED_REVIEWERS).slice(0, reviewerCount);

	// 단계별 함수 정의
	function step1() {
		status = "APPROVAL_DEPT";

		history.push({
			type: "workflow",
			actionText: "검토요청 등록",
			creator: creatorList[0].creator,
			creatorDept: creatorList[0].creatorDepartment,
			creatorPosition: creatorList[0].creatorPosition,
			createTime: formatYYYYMMDDHHMM(current),
			isShowComment: false,
			comment: ` [${faker.person.fullName().replaceAll(" ", "")}/${creatorList[0].creatorDepartment}님께 (요청 승인) 단계로 승인 요청 했습니다.]`,
			id: historyIdCounter++,
			extraInfo: {
				historyType: "history_itm_contract",
			},
		});
		for (let i = 0; i < faker.number.int({ min: 1, max: 3 }); i++) {
			history.push({
				type: "attachment",
				actionText: "파일등록",
				creator: creatorList[0].creator,
				creatorDept: creatorList[0].creatorDepartment,
				creatorPosition: creatorList[0].creatorPosition,
				createTime: formatYYYYMMDDHHMM(current),
				isShowComment: false,
				contractDocList: [
					{
						extension: "docx",
						fileId: faker.number.int({ min: 100000, max: 999999 }),
						fileName: `${faker.lorem.words({ min: 1, max: 3 }).replaceAll(" ", "_")}.docx`,
						filepath: "",
						id: faker.number.int({ min: 100000, max: 999999 }),
						type: "contractAttachmentReview",
						fileText: faker.lorem.sentences({ min: 1, max: 3 }, "\n"),
						isHide: false,
					},
				],
				comment: "",
				id: historyIdCounter++,
				extraInfo: {
					historyType: "history_itm_attach",
				},
			});
		}
		history.push({
			type: "workflow",
			actionText: "승인 요청",
			creator: creatorList[0].creator,
			creatorDept: creatorList[0].creatorDepartment,
			creatorPosition: creatorList[0].creatorPosition,
			createTime: formatYYYYMMDDHHMM(current),
			isShowComment: true,
			comment: ` [${theirTeamLeader}/${creatorList[0].creatorDepartment}님께 (요청 승인) 단계로 승인 요청 했습니다.]`,
			id: historyIdCounter++,
			extraInfo: {
				historyType: "history_itm_contract",
			},
		});

		current = reviewRequestDate = faker.date.between({ from: current, to: addMinutes(createDate, 100) });
		return true;
	}

	function step2() {
		if (faker.number.int({ min: 1, max: 10 }) >= 8) return false;

		status = "RECEPTION";
		history.push({
			type: "workflow",
			actionText: "요청 승인",
			creator: theirTeamLeader,
			createTime: formatYYYYMMDDHHMM(current),
			isShowComment: true,
			comment: " [강캡틴/법률도움부,김일지/법률도움부님께 (접수) 단계로 요청 승인 했습니다.]",
			id: historyIdCounter++,
			creatorDept: creatorList[0].creatorDepartment,
			creatorPosition: creatorList[0].creatorPosition,
			extraInfo: {
				historyType: "history_itm_contract",
			},
		});
		return true;
	}

	function step3() {
		if (faker.number.int({ min: 1, max: 10 }) >= 8) {
			return false;
		}

		status = "REVIEW";
		receptionDate = current = faker.date.between({ from: current, to: addDays(current, 1) });

		history.push({
			type: "workflow",
			actionText: "접수 승인",
			creator: "강캡틴",
			createTime: formatYYYYMMDDHHMM(current),
			isShowComment: true,
			comment: " [강캡틴/법률도움부,김일지/법률도움부님께 (담당자 배정) 단계로 접수 승인 했습니다.]",
			id: historyIdCounter++,
			creatorDept: "법률도움부",
			creatorPosition: "/팀원",
			extraInfo: {
				historyType: "history_itm_contract",
			},
		});

		for (const r of reviewers) {
			history.push({
				actionText: "담당자 배정",
				creator: "캡틴",
				createTime: formatYYYYMMDDHHMM(current),
				isShowComment: true,
				comment: `담당자가 지정 되었습니다. (법률도움부/팀원/${r.name}) `,
				id: historyIdCounter++,
				creatorDept: "법률도움부",
				creatorPosition: "/팀원",
				type: "workflow",
				extraInfo: {
					historyType: "history_itm_contract",
				},
			});
		}
		for (const r of reviewers) {
			history.push({
				actionText: "배정 완료",
				creator: "캡틴",
				createTime: formatYYYYMMDDHHMM(current),
				isShowComment: true,
				comment: ` [${r.name}/법률도움부님께 (검토중) 단계로 배정 완료 했습니다.]`,
				id: 149758,
				creatorDept: "법률도움부",
				creatorPosition: "/팀원",
				type: "workflow",
				extraInfo: {
					historyType: "history_itm_contract",
				},
			});
		}

		if (faker.number.int({ min: 1, max: 10 }) < 9) {
			for (const r of reviewers) {
				current = faker.date.between({ from: current, to: addMinutes(current, 30) });
				if (faker.number.int({ min: 1, max: 10 }) < 9) {
					history.push({
						actionText: "배정확인",
						creator: r.name,
						createTime: formatYYYYMMDDHHMM(current),
						isShowComment: false,
						comment: "",
						id: historyIdCounter++,
						creatorDept: "법률도움부",
						creatorPosition: "/팀원",
						type: "workflow",
						extraInfo: {
							historyType: "history_itm_contract",
						},
					});
				}
			}
		}

		return receptionDate;
	}

	function step4() {
		let any = false;

		for (const reviewer of reviewers) {
			if (faker.number.int({ min: 1, max: 3 }) < 3) {
				current = faker.date.between({ from: current!, to: addMinutes(current!, 2000) });
				for (let i = 0; i < faker.number.int({ min: 0, max: 3 }); i++) {
					history.push({
						type: "attachment",
						actionText: "파일등록",
						creator: reviewer.name,
						createTime: formatYYYYMMDDHHMM(current),
						isShowComment: false,
						comment: "",
						id: historyIdCounter++,
						creatorDept: reviewer.department,
						creatorPosition: reviewer.position,
						extraInfo: {
							historyType: "history_itm_attach",
						},
					});
				}
			}

			history.push({
				type: "workflow",
				actionText: "검토완료",
				creator: reviewer.name,
				createTime: formatYYYYMMDDHHMM(current),
				isShowComment: true,
				comment: ` [강캡틴/법률도움부님께 (검토 승인1) 단계로 검토완료 했습니다.]`,
				id: historyIdCounter++,
				creatorDept: reviewer.department,
				creatorPosition: reviewer.position,
				extraInfo: {
					historyType: "history_itm_contract",
				},
			});
			any = true;
		}

		if (any) {
			status = "FINISH";
			replyDate = current = faker.date.between({ from: current!, to: addMinutes(current!, 300) });
			history.push({
				actionText: "검토 완료",
				creator: "강캡틴",
				createTime: formatYYYYMMDDHHMM(current),
				isShowComment: false,
				comment: "",
				id: historyIdCounter++,
				creatorDept: "법률도움부",
				creatorPosition: "/팀원",
				type: "workflow",
				extraInfo: {
					historyType: "history_itm_contract",
				},
			});
			return replyDate;
		}
	}

	// what the actual hell? 다음 값들을 ts가 never로만 추론함.
	if (step1() && step2()) {
		receptionDate = step3() || undefined;
		if (receptionDate) {
			replyDate = step4();
		}
	}

	// contract 객체 생성
	const contract: ContractDetail = {
		id: ++contractIdCounter,
		approvalLine: faker.helpers.arrayElement(["LESS", "EQUAL", "GRATER"]),
		positionNameAndRankName: creatorList[0].positionNameAndRankName,
		creatorEmail: creatorList[0].creatorEmail,
		creatorPosition: creatorList[0].creatorPosition,
		creatorDepartment: creatorList[0].creatorDepartment,
		creator: creatorList[0].creator,

		elecApprovalDocNo: null,
		replyDate: replyDate ? replyDate.toISOString() : "",

		isSigned: null,
		contractMemo: null,
		validFrom: null,
		type: null,
		isMultiSignStep: false,
		signMemberList: [],
		opponent: null,
		opponentList: [],
		directorsDate: null,
		isIndividualTypeAutoUpdate: null,
		isInOwner: false,
		documentReviewList: [], // TODO
		lastReviewDoc: {}, // TODO
		relatedDepartment: null,
		isOpen: null,
		isTemp: false,
		name: faker.lorem.words({ min: 3, max: 6 }),
		description: faker.lorem.sentence(),
		isDomesticOrAbroad: true,
		oppositeList: [],
		isCreateUser: false,
		actions: [], // Ignore for now
		isAffiliateTrade: null,
		isContainSignStep: false,
		status: status as ContractDetail["status"],
		isSecurity: faker.number.int({ min: 1, max: 10 }) === 1,
		provisionClassification: null,
		resultReviewDate: null,
		contry: "",
		alarmData: [],
		enforcementDate: enforcementDate ? enforcementDate.toISOString().slice(0, 10).replace(/-/g, "/") : "",
		elecApprovalDate: null,
		commissionReport: null,
		contractHistory: [],
		contractAttachment: [],
		reviewRequestDate: reviewRequestDate.toISOString().slice(0, 10).replace(/-/g, "/"),
		lawyerList: reviewers.map((r) => {
			return {
				name: r.name,
				id: r.memberId,
				department: r.department,
			};
		}),
		reviewers,
		labelList: [], // ignore for now
		documentTargetList: [], // TODO
		creatorList,
		validEnd: null,
		relations: [],
		category: {
			text: "규정지침/매뉴얼",
			childId: null,
			type: "GUIDELINE",
			parentId: 65,
		},
		businessWorkDstic: String(faker.number.int({ min: 1, max: 3 })) as ContractDetail["businessWorkDstic"],
		is_multi: false,
		createDate: createDate.toISOString().slice(0, 10).replace(/-/g, "/"),
		receptionDate: receptionDate ? receptionDate.toISOString() : "",
		viewcode: `${faker.date.recent().toISOString().slice(0, 10).replace(/-/g, "/")}-${faker.string.numeric(8)}`,
		writeDocNo: `${faker.company.name()} ${faker.number.int({ min: 1000, max: 9999 })}`,
	};
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
