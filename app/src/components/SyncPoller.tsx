import { useEffect } from "react";
import { useAppStore } from "../stores/appStore";

interface SyncPollerProps {
	interval?: number; // 서버 동기화 최소 간격 (ms)
	tick?: number;     // 타이머 체크 주기 (ms)
}

export function SyncPoller({ interval = 10_000, tick = 1_000 }: SyncPollerProps) {
	useEffect(() => {
		let cancelled = false;
		let timer: number;

		(async () => {
			// 마지막으로 저장된 스냅샷 로드 등...
			await useAppStore.getState().bootstrap();

			// Poll loop
			const loop = () => {
				const { lastLoadedAt, isLoading, loadChanges } = useAppStore.getState();

				if (!isLoading && Date.now() - lastLoadedAt >= interval) {
					loadChanges(lastLoadedAt === 0);
				}

				if (!cancelled) {
					timer = window.setTimeout(loop, tick);
				}
			};

			loop();
		})();

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [interval, tick]);

	return null;
}
