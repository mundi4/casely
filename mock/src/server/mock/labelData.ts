// labelData.ts
import { ko, Faker } from "@faker-js/faker";
import type { Label } from "../../types";

let labelIdCounter = 1000;
let labelTimeCounter = Date.now() - 1000 * 60 * 60 * 24 * 10;

export function setLabelCounters(id: number, time: number) {
	labelIdCounter = id;
	labelTimeCounter = time;
}

export function getLabelCounters() {
	return { labelIdCounter, labelTimeCounter };
}
const faker = new Faker({ locale: ko });

export function createLabel(): Label {
	labelIdCounter++;
	labelTimeCounter += 1000 * 60 * 60 * 3; // 3시간씩 증가
	return {
		id: labelIdCounter,
		name: faker.word.noun(),
		color: faker.color.rgb(),
		type: "PRIVATE",
	};
}
