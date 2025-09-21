import { Switch } from '@mantine/core';
import { useAppStore } from '../stores/appStore';
import type { RefreshPolicy } from '../types';

interface RefreshPolicySwitchProps {
    contractId: number;
    value: RefreshPolicy;
    disabled?: boolean;
}

export function RefreshPolicySwitch({ contractId, value, disabled }: RefreshPolicySwitchProps) {
    const setRefreshPolicyForContract = useAppStore((state) => state.setRefreshPolicy);
    const loading = false; // 필요시 로딩 상태 관리 가능

    return (
        <Switch
            checked={value === 100}
            label="새로고침 금지"
            color="red"
            disabled={disabled || loading}
            onChange={async (e) => {
                const next = e.currentTarget.checked ? 100 : 0;
                try {
                    await setRefreshPolicyForContract(contractId, next);
                } catch (err) {
                    alert('서버 반영 실패');
                }
            }}
        />
    );
}
