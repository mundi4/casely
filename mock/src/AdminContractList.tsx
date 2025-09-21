import { useEffect, useState } from 'react';
import { Box, Text, Table, Button, Group } from '@mantine/core';

interface Contract {
  id: number;
  title: string;
  status: string;
  creator: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export function AdminContractList() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/contract/list')
      .then(res => res.json())
      .then(data => {
        setContracts(data);
        setLoading(false);
      });
  }, []);

  return (
    <Box p="lg" mx="auto" style={{ maxWidth: 900, width: '100%' }}>
      <Text size="xl" mb="md">계약 목록 (관리자)</Text>
      {loading ? <Text>로딩중...</Text> : null}
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>ID</Table.Th>
            <Table.Th>제목</Table.Th>
            <Table.Th>상태</Table.Th>
            <Table.Th>작성자</Table.Th>
            <Table.Th>생성일</Table.Th>
            <Table.Th>수정일</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {contracts.filter(c => !c.deleted).map(contract => (
            <Table.Tr key={contract.id}>
              <Table.Td>{contract.id}</Table.Td>
              <Table.Td>{contract.title}</Table.Td>
              <Table.Td>{contract.status}</Table.Td>
              <Table.Td>{contract.creator}</Table.Td>
              <Table.Td>{new Date(contract.createdAt).toLocaleString()}</Table.Td>
              <Table.Td>{new Date(contract.updatedAt).toLocaleString()}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {contracts.length === 0 && !loading ? (
        <Text c="dimmed" ta="center" py="xl">
          표시할 계약이 없습니다.
        </Text>
      ) : null}
    </Box>
  );
}
