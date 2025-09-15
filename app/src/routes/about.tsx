import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return <IssueList />
}

import {
  Paper,
  Group,
  Stack,
  Text,
  Badge,
  Checkbox,
  TextInput,
  SegmentedControl,
  Menu,
  Button,
} from '@mantine/core';
import { IconSearch, IconSelector } from '@tabler/icons-react';
import { useState } from 'react';

interface Item {
  id: number;
  title: string;
  requester: string;
  department: string;
  reviewer: string;
  requestedAt: string;
  effectiveAt: string;
  updatedAt: string;
  status: string;
  labels: string[];
}

const items: Item[] = [
  {
    id: 123,
    title: '계약서 검토안',
    requester: '홍길동',
    department: '준법감시부',
    reviewer: '김검토',
    requestedAt: '2025-09-01',
    effectiveAt: '2025-09-10',
    updatedAt: '2025-09-13',
    status: '진행중',
    labels: ['금융', '긴급'],
  },
  {
    id: 124,
    title: '상품 매뉴얼 업데이트',
    requester: '이의뢰',
    department: '상품부',
    reviewer: '박검토',
    requestedAt: '2025-09-02',
    effectiveAt: '2025-09-12',
    updatedAt: '2025-09-13',
    status: '완료',
    labels: ['매뉴얼'],
  },
];

export function IssueList() {
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [_sort, setSort] = useState('updatedDesc');

  return (
    <Stack gap="md">
      {/* 상단 퀵필터바 */}
      <Group justify="space-between">
        <Group gap="sm">
          <TextInput
            placeholder="검색..."
            leftSection={<IconSearch size={16} />}
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
            <Menu.Item onClick={() => setSort('updatedDesc')}>
              최신순
            </Menu.Item>
            <Menu.Item onClick={() => setSort('updatedAsc')}>
              오래된순
            </Menu.Item>
            <Menu.Item onClick={() => setSort('title')}>
              제목순
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* 리스트 */}
      <Stack gap="sm">
        {items.map((item) => (
          <Paper key={item.id} withBorder p="sm" radius="md">
            <Group align="flex-start" justify="space-between">
              {/* 왼쪽: 체크박스 + 본문 */}
              <Group align="flex-start">
                <Checkbox />
                <Stack gap={4}>
                  <Group gap="xs">
                    <Text fw={500}>{item.title}</Text>
                    {item.labels.map((label) => (
                      <Badge key={label} size="sm" variant="light">
                        {label}
                      </Badge>
                    ))}
                    <Badge
                      size="sm"
                      color={item.status === '진행중' ? 'blue' : 'green'}
                    >
                      {item.status}
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {item.requester} · {item.department} · {item.reviewer} ·
                    의뢰일 {item.requestedAt} · 시행일 {item.effectiveAt} ·
                    업데이트 {item.updatedAt}
                  </Text>
                </Stack>
              </Group>

              {/* 오른쪽: ID */}
              <Text size="xs" c="dimmed">
                #{item.id}
              </Text>
            </Group>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
