import { Tooltip } from "@mantine/core";
import { formatDistanceToNow, type FormatDistanceToNowOptions } from "date-fns";


type RelativeDateProps = FormatDistanceToNowOptions & {
    date: number | string | Date | null | undefined;
    noTooltip?: boolean;
};

export function RelativeDate({ date, ...options }: RelativeDateProps) {
    let theDate: Date | null = null;
    if (date instanceof Date) {
        theDate = date;
    } else if (typeof date === "number" || typeof date === "string") {
        theDate = new Date(date);
    }
    if (!theDate || isNaN(theDate.getTime())) {
        console.log(theDate)
        return <span>-</span>;
    }
    const label = theDate.toLocaleString();
    return (
        options.noTooltip
            ? <span>{formatDistanceToNow(theDate, { addSuffix: true, ...options })}</span>
            : <Tooltip label={label}>
                <span>{formatDistanceToNow(theDate, { addSuffix: true, ...options })}</span>
            </Tooltip>
    );
}