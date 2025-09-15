import '@mantine/core/styles.css';
import './App.css'

import { SyncPoller } from './components/SyncPoller';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { SyncIndicator } from './components/SyncIndicator';

const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router
	}
}

export default function App() {
	return <>
		<RouterProvider router={router} />
		<SyncPoller interval={5_000} />
		<SyncIndicator />
	</>
}