import { AppShell } from '@mantine/core'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { AppBar } from '../components/AppBar';
function RootLayout() {
    //    const [opened, { toggle }] = useDisclosure();

    return (
        <>
            <AppShell
                header={{ height: 64 }}
                padding="sm"

            >
                <AppShell.Header withBorder>
                    <AppBar />
                </AppShell.Header>
                <AppShell.Main>
                    <Outlet />
                </AppShell.Main>
            </AppShell>
            <TanStackRouterDevtools />
        </>
    );
}

export const Route = createRootRoute({ component: RootLayout })