import { Tooltip } from "@mantine/core";
import { formatDate, formatDistanceToNow } from "date-fns";


export function EnforcementDate({ date }: { date: string | null }) {
    if (!date) {
        return <span>TBD</span>;
    }

    const relativeDate = formatDistanceToNow(date, { addSuffix: true });

    return <Tooltip label={relativeDate}><span>{formatDate(date, 'yyyy-MM-dd')}</span></Tooltip>;
}