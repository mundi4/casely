import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, Button, Container, Title, Group, Table, Text } from "@mantine/core";
import { useEffect, useState } from "react";

function fetchContracts() {
  return fetch("/api/mock/contract/list").then(r => r.json());
}
function createContract() {
  return fetch("/api/mock/contract/create").then(r => r.json());
}
function deleteContract(id: number) {
  return fetch(`/api/mock/contract/delete?id=${id}`).then(r => r.json());
}
function fetchLabels() {
  return fetch("/api/mock/label/list").then(r => r.json());
}
function createLabel() {
  return fetch("/api/mock/label/create").then(r => r.json());
}
function deleteLabel(id: number) {
  return fetch(`/api/mock/label/delete?id=${id}`).then(r => r.json());
}

function AdminPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [labels, setLabels] = useState<any[]>([]);
  useEffect(() => {
    // Set default auth values in localStorage for mock server
  localStorage.setItem("access_token", "mock-access-token-1234567890");
  localStorage.setItem("checkData", JSON.stringify({ teamTask: 12345, myTask: 12345 }));
  localStorage.setItem("vuex", JSON.stringify({ SESSION_STORE: { data: { id: 12345 } } }));
    fetchContracts().then(setContracts);
    fetchLabels().then(setLabels);
  }, []);
  return (
    <MantineProvider>
      <Container size="lg" py="xl">
        <Title order={2} mb="md">Contracts</Title>
        <Group mb="sm">
          <Button onClick={async () => { await createContract(); setContracts(await fetchContracts()); }}>Add Contract</Button>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>Title</Table.Th>
              <Table.Th>Creator</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {contracts.map(c => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.id}</Table.Td>
                <Table.Td>{c.name}</Table.Td>
                <Table.Td>{c.creator}</Table.Td>
                <Table.Td>{c.status}</Table.Td>
                <Table.Td>
                  <Button color="red" size="xs" onClick={async () => { await deleteContract(c.id); setContracts(await fetchContracts()); }}>Delete</Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Title order={2} mt="xl" mb="md">Labels</Title>
        <Group mb="sm">
          <Button onClick={async () => { await createLabel(); setLabels(await fetchLabels()); }}>Add Label</Button>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Color</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {labels.map(l => (
              <Table.Tr key={l.id}>
                <Table.Td>{l.id}</Table.Td>
                <Table.Td>{l.name}</Table.Td>
                <Table.Td><Text c={l.color}>{l.color}</Text></Table.Td>
                <Table.Td>
                  <Button color="red" size="xs" onClick={async () => { await deleteLabel(l.id); setLabels(await fetchLabels()); }}>Delete</Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Container>
    </MantineProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<AdminPage />);
