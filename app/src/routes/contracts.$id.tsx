
import { createFileRoute } from '@tanstack/react-router';
import { useParams } from '@tanstack/react-router';
import { Box, Text, Card, Group, Stack, Divider, Badge, Grid } from '@mantine/core';
import { useAppStore } from '../stores/appStore';
import { ReviewersInline } from '../components/ReviewersInline';
import { RefreshPolicySwitch } from '../components/RefreshPolicySwitch';

export const Route = createFileRoute('/contracts/$id')({
    component: ContractDetail,
});

function ContractDetail() {
    const { id } = useParams({ from: '/contracts/$id', select: (p) => ({ id: Number(p.id) }) });
    const contract = useAppStore((state) => state.contracts.idMap[id]);

    if (!contract) {
        return (
            <Box p="md" maw={600} mx="auto">
                <Text fw={700} fz="xl" mb={8}>계약 상세</Text>
                <Text c="red">존재하지 않는 계약입니다.</Text>
            </Box>
        );
    }

    return (
        <Box p="lg" mx="auto" style={{ maxWidth: 900, width: '100%' }}>
            <Card shadow="sm" radius="md" withBorder>
                {/* 상단 요약 */}
                <Group justify="space-between" align="flex-start" mb="md">
                    <Stack gap={2}>
                        <Text fw={700} fz="xl">{contract.title}</Text>
                        <Group gap="xs">
                            <Badge color={contract.status === 'open' ? 'indigo' : 'green'}>
                                {contract.status === 'open' ? '진행중' : '완료'}
                            </Badge>
                            <Text size="sm" c="dimmed">ID: {contract.id}</Text>
                        </Group>
                    </Stack>
                    <Stack gap={2} align="flex-end">
                        <Text size="sm"><b>의뢰일</b> {contract.requestedDate}</Text>
                        <Text size="sm"><b>시행일</b> {contract.effectiveDate || 'TBD'}</Text>
                    </Stack>
                </Group>
                <Divider my="sm" />
                <Grid>
                    <Grid.Col span={9}>
                        <Stack gap={8} style={{ flex: 2, minWidth: 240 }}>
                            <Text><b>작성자</b> {contract.creators.map(c => `${c.name}${c.department ? `(${c.department})` : ''}`).join(', ')}</Text>
                            <Text><b>검토자</b> <ReviewersInline reviewers={contract.reviewers} /></Text>
                            <Text><b>설명</b> {contract.description || '-'}</Text>
                        </Stack>
                    </Grid.Col>
                    <Grid.Col span={3}>
                        <Stack gap={4}>
                            <Text size="sm" c="dimmed"><code>{contract.viewcode}</code></Text>
                            <RefreshPolicySwitch contractId={contract.id} value={contract.refreshPolicy} />
                        </Stack>
                    </Grid.Col>
                </Grid>

            </Card>
        </Box>
    );
}
