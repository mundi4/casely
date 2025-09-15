import type { Reviewer } from "../types";
import { IconCircleCheckFilled } from '@tabler/icons-react';

export function ReviewersInline({ reviewers }: { reviewers: Reviewer[] }) {
    if (reviewers.length === 0) {
        return <span>No reviewers</span>;
    }
    return <>
        {reviewers.map((r, i) => (
            <span key={i} >
                {r.name}{r.approvedAt && <IconCircleCheckFilled style={{display:'inline-block'}} size={14} color="green" />}{i < reviewers.length - 1 ? ', ' : ''}
            </span>
        ))}
    </>;
}