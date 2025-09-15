import { createFileRoute } from '@tanstack/react-router'
import { ContractList } from '../components/ContractList'

export const Route = createFileRoute('/')({
	component: Index,
})

function Index() {
	return (
		<div>
			<ContractList />
		</div>
	)
}