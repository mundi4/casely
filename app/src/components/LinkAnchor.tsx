import { Anchor, type AnchorProps, type ElementProps } from "@mantine/core";
import { useRouter, type LinkProps } from "@tanstack/react-router";
import { forwardRef } from "react";

interface LinkAnchorProps
    extends AnchorProps,
    ElementProps<"a", keyof AnchorProps> {
    to: LinkProps["to"];
    params?: LinkProps["params"];
    search?: LinkProps["search"];
    hash?: LinkProps["hash"];
    state?: LinkProps["state"];
    replace?: LinkProps["replace"];
}

export const LinkAnchor = forwardRef<HTMLAnchorElement, LinkAnchorProps>(
    ({ to, params, search, hash, state, replace, ...rest }, ref) => {
        const router = useRouter();
        const href = typeof to === "string" ? to : "";
        const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault();
            router.navigate({ to, params, search, hash, state, replace });
        };
        return (
            <Anchor
                href={href}
                onClick={handleClick}
                ref={ref}
                {...rest}
            />
        );
    }
);
LinkAnchor.displayName = "LinkAnchor";