import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';
import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { setDefaultOptions } from 'date-fns';
import { ko } from 'date-fns/locale';
import App from './App';

setDefaultOptions({ locale: ko });



createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<MantineProvider>
			<App />
		</MantineProvider>
	</StrictMode>,
)
