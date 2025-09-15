import { Text, Button, Group, Menu, SegmentedControl, Stack, TextInput, Box, Indicator, Anchor } from "@mantine/core";
import { useAppStore } from "../stores/appStore";
import classes from './ContractList.module.css';
import { RelativeDate } from "./RelativeDate";
import { ReviewersInline } from "./ReviewersInline";
import { IconCheck, IconCircleCheck, IconCircleDot, IconSearch, IconSelector } from "@tabler/icons-react";
import { useState } from "react";
import type { Contract } from "../types";

type ContractListProps = {



};

function ContractListItem({ contract }: { contract: Contract }) {
    const hasChanges = useAppStore((state) => !!state.pendingChanges.contracts.idMap[contract.id]);
    //const hasChanges = contract.id % 3 === 0;
    const StatusIcon = (() => {
        if (contract.status === "open") {
            return <IconCircleDot size={24} stroke={2} color="indigo" />;
        }
        if (contract.status === "closed") {
            return <IconCircleCheck size={24} stroke={2} color="green" />;
        }
        return <IconCircleDot size={24} stroke={2} color="gray" />;
    })();



    return (
        <Box key={contract.id} className={classes.listItem} p="sm">
            <div className={classes.status}>{StatusIcon}</div>
            <div className={classes.title}>
                <Anchor href={`/contracts/${contract.id}`} fw={500} underline="hover">
                    {contract.title}
                </Anchor>
            </div>

            <div className={classes.content}>
                <Text size="sm" c="dimmed">
                    #{contract.id}{' '}·{' '}
                    {contract.creators[0].name} <small>{contract.creators[0].department}</small> ·
                    의뢰일 <RelativeDate date={contract.requestedDate} /> · 시행일 {contract.effectiveDate} · <ReviewersInline reviewers={contract.reviewers} />
                </Text>
            </div>
            <div className={classes.metadata}>
                {hasChanges ? (
                    <Indicator color="red" offset={-2} size={7} processing onClick={() => {
                        useAppStore.getState().applyPending({ contractIds: [contract.id] });
                    }}>
                        <Anchor component="button" type="button" c="orange">
                            <Text size="sm">
                                <RelativeDate date={contract.updatedAt} />
                            </Text>
                        </Anchor>
                    </Indicator>
                ) : <Text size="sm" c="dimmed">
                    <RelativeDate date={contract.updatedAt} />
                </Text>}

            </div>
        </Box>
    )
}

export function ContractList({ }: ContractListProps) {
    const contractCache = useAppStore((state) => state.contracts);
    const contractMap = contractCache.idMap;
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<'all' | 'open' | 'closed'>('all');
    const [sort, setSort] = useState<'updated' | 'newest' | 'effectiveDate'>('newest');

    let contracts = Object.values(contractMap);

    // 검색어 필터링 (제목, 작성자)
    const searchLower = search.trim().toLowerCase();
    if (searchLower) {
        contracts = contracts.filter((c) =>
            c.title.toLowerCase().includes(searchLower) ||
            c.creators.some((cr) => cr.name.toLowerCase().includes(searchLower)) ||
            c.creators.some((cr) => cr.department!.toLowerCase().includes(searchLower)) ||
            c.reviewers.some((rv) => rv.name.toLowerCase().includes(searchLower))
        );
    }

    if (status !== 'all') {
        contracts = contracts.filter((c) => (status === 'open' ? c.status === 'open' : c.status === 'closed'));
    }

    if (sort === 'updated') {
        contracts = contracts.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : b.updatedAt < a.updatedAt ? -1 : b.id - a.id));
    } else if (sort === 'newest') {
        contracts = contracts.sort((a, b) => (b.requestedDate > a.requestedDate ? 1 : b.requestedDate < a.requestedDate ? -1 : b.id - a.id));
    } else if (sort === 'effectiveDate') {
        contracts = contracts.sort((a, b) => {
            const aDate = a.effectiveDate || '9999-12-31';
            const bDate = b.effectiveDate || '9999-12-31';
            return (aDate > bDate ? 1 : aDate < bDate ? -1 : b.id - a.id);
        });
    }

    //.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : b.updatedAt < a.updatedAt ? -1 : b.id - a.id));


    return (
        <Stack gap={0}>
            <Group justify="space-between">
                <Group gap="sm">
                    <TextInput
                        placeholder="제목 또는 작성자 검색"
                        leftSection={<IconSearch size={16} />}
                        value={search}
                        onChange={(e) => setSearch(e.currentTarget.value)}
                        rightSection={
                            search ? (
                                <Button
                                    variant="subtle"
                                    size="xs"
                                    px={4}
                                    onClick={() => setSearch("")}
                                    style={{ height: 24 }}
                                    tabIndex={-1}
                                >
                                    ×
                                </Button>
                            ) : null
                        }
                    />
                    <SegmentedControl
                        value={status}
                        onChange={(val) => setStatus(val as typeof status)}
                        data={[
                            { label: '전체', value: 'all' },
                            { label: '진행중', value: 'open' },
                            { label: '완료', value: 'closed' },
                        ]}
                    />
                </Group>
                <Menu shadow="md" width={160}>
                    <Menu.Target>
                        <Button variant="default" rightSection={<IconSelector size={14} />}>
                            정렬
                        </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item onClick={() => setSort('newest')}>
                            {sort === 'newest' ? <IconCheck size={14} /> : null} 최근 의뢰
                        </Menu.Item>
                        <Menu.Item onClick={() => setSort('updated')}>
                            {sort === 'updated' ? <IconCheck size={14} /> : null} 최근 업데이트
                        </Menu.Item>
                        <Menu.Item onClick={() => setSort('effectiveDate')}>
                            {sort === 'effectiveDate' ? <IconCheck size={14} /> : null} 시행예정일
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </Group>

            <Stack gap={0} className={classes.list}>
                {contracts.map((item) => (
                    <ContractListItem key={item.id} contract={item} />
                    // <Paper key={item.id}  p="sm" className={classes.listItem}>
                    //     <Group align="flex-start" justify="space-between" >
                    //         {/* 왼쪽: 체크박스 + 본문 */}
                    //         <Group align="flex-start">
                    //             <Checkbox />
                    //             <Stack gap={4}>
                    //                 <Group gap="xs">
                    //                     <Text fw={500}>{item.title}</Text>
                    //                     {item.labels.map((label) => (
                    //                         <Badge key={label} size="sm" variant="light">
                    //                             {label}
                    //                         </Badge>
                    //                     ))}
                    //                     <Badge
                    //                         size="sm"
                    //                         color={item.status === 'open' ? 'blue' : 'green'}
                    //                     >
                    //                         {item.status === 'open' ? '진행중' : '완료'}
                    //                     </Badge>
                    //                 </Group>
                    //                 <Text size="sm" c="dimmed">
                    //                     #{item.id}{' '}·{' '}
                    //                     {item.creators[0].name} <small>{item.creators[0].department}</small> ·
                    //                     의뢰일 <RelativeDate date={item.requestedDate} /> · 시행일 {item.effectiveDate} · <ReviewersInline reviewers={item.reviewers} />
                    //                 </Text>
                    //             </Stack>
                    //         </Group>

                    //         <Stack gap={4} align="space-between" style={{ textAlign: "right" }}>
                    //             <Text size="sm">


                    //             </Text>
                    //             <Text size="xs" c="dimmed" style={{ textAlign: "right" }}>
                    //                 <RelativeDate date={item.updatedAt} /><br />
                    //             </Text>

                    //         </Stack>
                    //     </Group>
                    // </Paper>
                ))}
            </Stack>
        </Stack>
        // <div>
        //     <h2>내 손길을 기다리는 놈들 ({lastUpdatedAt ? <RelativeDate date={lastUpdatedAt} /> : "not updated yet"})</h2>
        //     <Table>
        //         <Table.Tbody>
        //             {contracts.map((review) => (
        //                 <Table.Tr key={review.id}>

        //                     <Table.Td className={classes.viewcode}>
        //                         {review.id}
        //                     </Table.Td>
        //                     <Table.Td>
        //                         <div>{review.title}</div>
        //                         <MultiSelect

        //                             data={labelArray}
        //                         />
        //                     </Table.Td>
        //                     <Table.Td>
        //                         {review.creators[0].name}/{review.creators[0].department}
        //                     </Table.Td>
        //                     <Table.Td>
        //                         <ReviewersInline reviewers={review.reviewers} />
        //                     </Table.Td>
        //                     <Table.Td>
        //                         <EnforcementDate date={review.enforcementDate} />
        //                     </Table.Td>
        //                     <Table.Td>

        //                     </Table.Td>
        //                     <Table.Td>
        //                         <RelativeDate date={review.updatedAt} />
        //                     </Table.Td>
        //                 </Table.Tr>
        //             ))}
        //         </Table.Tbody>

        //     </Table>
        //     <ul>
        //     </ul>
        // </div>
    );

}