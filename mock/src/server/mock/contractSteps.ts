// import type { ContractCreator, ContractHistory } from "../../types";
// import { ko, Faker, fa } from "@faker-js/faker";
// const faker = new Faker({ locale: ko });
// let historyIdCounter = 50000;

// function steps(creatorList: ContractCreator[]) {
	
//     const history: ContractHistory[] = [];
//     const createDate = faker.date.past({ years: 1 });



// 	function step1_createRequestHistory() {
// 		history.push({
// 			type: "workflow",
// 			actionText: "검토요청 등록",
// 			creator: creatorList[0].creator,
// 			creatorDept: creatorList[0].creatorDepartment,
// 			creatorPosition: creatorList[0].creatorPosition,
// 			createTime: formatYYYYMMDDHHMM(createDate),
// 			isShowComment: false,
// 			comment: ` [${faker.person.fullName().replaceAll(" ", "")}/${creatorList[0].creatorDepartment}님께 (요청 승인) 단계로 승인 요청 했습니다.]`,
// 			id: historyIdCounter++,
// 			extraInfo: {
// 				historyType: "history_itm_contract",
// 			},
// 		});
// 		for (let i = 0; i < faker.number.int({ min: 1, max: 3 }); i++) {
// 			history.push({
// 				type: "attachment",
// 				actionText: "파일등록",
// 				creator: creatorList[0].creator,
// 				creatorDept: creatorList[0].creatorDepartment,
// 				creatorPosition: creatorList[0].creatorPosition,
// 				createTime: formatYYYYMMDDHHMM(createDate),
// 				isShowComment: false,
// 				contractDocList: [
// 					{
// 						extension: "docx",
// 						fileId: faker.number.int({ min: 100000, max: 999999 }),
// 						fileName: `${faker.lorem.words({ min: 1, max: 3 }).replaceAll(" ", "_")}.docx`,
// 						filepath: "",
// 						id: faker.number.int({ min: 100000, max: 999999 }),
// 						type: "contractAttachmentReview",
// 						fileText: faker.lorem.sentences({ min: 1, max: 3 }, "\n"),
// 						isHide: false,
// 					},
// 				],
// 				comment: "",
// 				id: historyIdCounter++,
// 				extraInfo: {
// 					historyType: "history_itm_attach",
// 				},
// 			});
// 		}
// 		const theirTeamLeader = faker.person.fullName().replaceAll(" ", "");
// 		history.push({
// 			type: "workflow",
// 			actionText: "승인 요청",
// 			creator: creatorList[0].creator,
// 			creatorDept: creatorList[0].creatorDepartment,
// 			creatorPosition: creatorList[0].creatorPosition,
// 			createTime: formatYYYYMMDDHHMM(createDate),
// 			isShowComment: true,
// 			comment: ` [${theirTeamLeader}/${creatorList[0].creatorDepartment}님께 (요청 승인) 단계로 승인 요청 했습니다.]`,
// 			id: historyIdCounter++,
// 			extraInfo: {
// 				historyType: "history_itm_contract",
// 			},
// 		});
// 		return theirTeamLeader;
// 	}

// 	function step2_approvalHistory(theirTeamLeader: string) {
// 		if (!receptionDate) {
// 			if (faker.number.int({ min: 1, max: 10 }) < 8) {
// 				history.push({
// 					type: "workflow",
// 					actionText: "요청 승인",
// 					creator: theirTeamLeader,
// 					createTime: formatYYYYMMDDHHMM(createDate),
// 					isShowComment: true,
// 					comment: " [강캡틴/법률도움부,김일지/법률도움부님께 (접수) 단계로 요청 승인 했습니다.]",
// 					id: historyIdCounter++,
// 					creatorDept: creatorList[0].creatorDepartment,
// 					creatorPosition: creatorList[0].creatorPosition,
// 					extraInfo: {
// 						historyType: "history_itm_contract",
// 					},
// 				});
// 			}
// 			status = "APPROVAL_DEPT";
// 		}
// 	}

// 	function step3_receptionHistory() {
// 		if (receptionDate) {
// 			history.push({
// 				type: "workflow",
// 				actionText: "접수 승인",
// 				creator: "강캡틴",
// 				createTime: formatYYYYMMDDHHMM(receptionDate),
// 				isShowComment: true,
// 				comment: " [강캡틴/법률도움부,김일지/법률도움부님께 (담당자 배정) 단계로 접수 승인 했습니다.]",
// 				id: historyIdCounter++,
// 				creatorDept: "법률도움부",
// 				creatorPosition: "/팀원",
// 				extraInfo: {
// 					historyType: "history_itm_contract",
// 				},
// 			});
// 			status = "RECEPTION";
// 			if (faker.number.int({ min: 1, max: 10 }) < 9) {
// 				const reviewerCount = faker.number.int({ min: 1, max: 2 });
// 				reviewers.push(...faker.helpers.shuffle(FIXED_REVIEWERS).slice(0, reviewerCount));
// 				for (const r of reviewers) {
// 					history.push({
// 						actionText: "담당자 배정",
// 						creator: "캡틴",
// 						createTime: formatYYYYMMDDHHMM(receptionDate),
// 						isShowComment: true,
// 						comment: `담당자가 지정 되었습니다. (법률도움부/팀원/${r.name}) `,
// 						id: historyIdCounter++,
// 						creatorDept: "법률도움부",
// 						creatorPosition: "/팀원",
// 						type: "workflow",
// 						extraInfo: {
// 							historyType: "history_itm_contract",
// 						},
// 					});
// 				}
// 				for (const r of reviewers) {
// 					history.push({
// 						actionText: "배정 완료",
// 						creator: "캡틴",
// 						createTime: formatYYYYMMDDHHMM(receptionDate),
// 						isShowComment: true,
// 						comment: ` [${r.name}/법률도움부님께 (검토중) 단계로 배정 완료 했습니다.]`,
// 						id: 149758,
// 						creatorDept: "법률도움부",
// 						creatorPosition: "/팀원",
// 						type: "workflow",
// 						extraInfo: {
// 							historyType: "history_itm_contract",
// 						},
// 					});
// 				}
// 				status = "REVIEW";
// 				for (const r of reviewers) {
// 					if (faker.number.int({ min: 1, max: 10 }) < 7) {
// 						history.push({
// 							actionText: "배정확인",
// 							creator: r.name,
// 							createTime: formatYYYYMMDDHHMM(faker.date.between({ from: receptionDate, to: addMinutes(receptionDate, 200) })),
// 							isShowComment: false,
// 							comment: "",
// 							id: historyIdCounter++,
// 							creatorDept: "법률도움부",
// 							creatorPosition: "/팀원",
// 							type: "workflow",
// 							extraInfo: {
// 								historyType: "history_itm_contract",
// 							},
// 						});
// 					}
// 				}
// 			}
// 		}
// 	}

// 	function step4_reviewHistory() {
// 		if (status === "REVIEW") {
// 			let any = false;
// 			for (const reviewer of reviewers) {
// 				if (faker.number.int({ min: 1, max: 3 }) < 3) {
// 					for (let i = 0; i < faker.number.int({ min: 0, max: 3 }); i++) {
// 						history.push({
// 							type: "attachment",
// 							actionText: "파일등록",
// 							creator: reviewer.name,
// 							createTime: formatYYYYMMDDHHMM(faker.date.between({ from: receptionDate!, to: refDate })),
// 							isShowComment: false,
// 							comment: "",
// 							id: historyIdCounter++,
// 							creatorDept: reviewer.department,
// 							creatorPosition: reviewer.position,
// 							extraInfo: {
// 								historyType: "history_itm_attach",
// 							},
// 						});
// 					}
// 				}
// 				if (faker.number.int({ min: 1, max: 3 }) < 3) {
// 					history.push({
// 						type: "workflow",
// 						actionText: "검토완료",
// 						creator: reviewer.name,
// 						createTime: formatYYYYMMDDHHMM(faker.date.between({ from: receptionDate!, to: refDate })),
// 						isShowComment: true,
// 						comment: ` [강캡틴/법률도움부님께 (검토 승인1) 단계로 검토완료 했습니다.]`,
// 						id: historyIdCounter++,
// 						creatorDept: reviewer.department,
// 						creatorPosition: reviewer.position,
// 						extraInfo: {
// 							historyType: "history_itm_contract",
// 						},
// 					});
// 					any = true;
// 				}
// 			}
// 			if (any && faker.number.int({ min: 1, max: 10 }) < 8) {
// 				status = "FINISH";
// 				replyDate = faker.date.between({ from: receptionDate!, to: addDays(receptionDate!, 3) });
// 				history.push({
// 					actionText: "검토 완료",
// 					creator: "강캡틴",
// 					createTime: formatYYYYMMDDHHMM(replyDate),
// 					isShowComment: false,
// 					comment: "",
// 					id: historyIdCounter++,
// 					creatorDept: "법률도움부",
// 					creatorPosition: "/팀원",
// 					type: "workflow",
// 					extraInfo: {
// 						historyType: "history_itm_contract",
// 					},
// 				});
// 			}
// 		}
// 	}

// 	// 단계별 함수 호출
// 	const theirTeamLeader = step1_createRequestHistory();
// 	step2_approvalHistory(theirTeamLeader);
// 	step3_receptionHistory();
// 	step4_reviewHistory();
// }
