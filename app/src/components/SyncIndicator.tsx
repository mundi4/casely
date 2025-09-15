import { Affix, Loader, Paper } from '@mantine/core';
import { useAppStore } from '../stores/appStore';

export function SyncIndicator() {
    const isSyncing = useAppStore((s) => s.isSyncing);
    if (!isSyncing) return null;

    return (
        <Affix position={{ top: 16, right: 16 }}>
            <Paper shadow="sm" radius="md" p="xs" withBorder>
                <Loader size="sm" mr="xs" /> 밀당 중...
            </Paper>
        </Affix>
    );
}
