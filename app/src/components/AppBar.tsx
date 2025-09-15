import { ActionIcon, Indicator, Tooltip, Group, Box } from "@mantine/core";
import { IconBriefcase,IconRefresh } from "@tabler/icons-react";
import { useAppStore } from "../stores/appStore";
import { useCallback } from "react";
import clsx from "clsx";

interface AppBarProps {
	autoSync?: boolean;
}

export function AppBar({ autoSync }: AppBarProps) {
	const pendingCount = useAppStore(
		(state) => state.pendingChanges.contracts.count + state.pendingChanges.labels.count
	);
	const lastLoadedAt = useAppStore((state) => state.lastLoadedAt);
	const applyPending = useAppStore((state) => state.applyPending);
	const isLoading = useAppStore((state) => state.isLoading);

	const apply = useCallback(() => {
		applyPending();
	}, [applyPending]);

	return (
		<Group justify="space-between" align="center" h="100%" px="md">
			{/* App icon and name */}
			<Group align="center" gap={8}>
				<ActionIcon variant="light" color="indigo" size="lg" radius="xl">
					<IconBriefcase stroke={2} />
					{/* You can change the icon below to any Tabler icon you like */}
				</ActionIcon>
				<Box fw={700} fz="lg" style={{ letterSpacing: 1 }}>어떤 의미 있는 이름?</Box>
			</Group>
			{/* Action buttons */}
			<Group justify="flex-end" align="center" gap={0}>
				{autoSync ? (
					<Tooltip
						label={
							lastLoadedAt
								? `마지막 확인: ${new Date(lastLoadedAt).toLocaleString()}`
								: "아직 확인 기록 없음"
						}
						withArrow
					>
						<ActionIcon variant="subtle" disabled>
							<IconRefresh size={20} />
						</ActionIcon>
					</Tooltip>
				) : (
					<Tooltip
						label={
							pendingCount > 0
								? `${pendingCount}건의 변경사항 대기 중`
								: "변경사항 없음"
						}
						withArrow
					>
						<Indicator
							disabled={pendingCount === 0}
							color="red"
							offset={4}
							size={10}
							processing
						>
							<ActionIcon
								variant="subtle"
								color={pendingCount > 0 ? "orange" : "gray"}
								size="lg"
								onClick={apply}
							>
								<IconRefresh size={22} className={clsx({ spin: isLoading })} />
							</ActionIcon>
						</Indicator>
					</Tooltip>
				)}
			</Group>
		</Group>
	);
}
