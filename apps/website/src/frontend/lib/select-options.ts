import * as React from "react";

export type SelectOption = { value: string; label: string; disabled: boolean; lang?: string; detail?: string };
export type SelectGroup = { label?: string; hint?: string; tile?: string; options: SelectOption[] };

type OptionProps = {
  children?: React.ReactNode;
  value?: string | number;
  disabled?: boolean;
  lang?: string;
  label?: string;
  "data-detail"?: string;
  "data-hint"?: string;
  "data-tile"?: string;
};

const textOf = (node: React.ReactNode): string =>
  React.Children.toArray(node)
    .map((n) => (typeof n === "string" || typeof n === "number" ? String(n) : ""))
    .join("");

/**
 * Reads ordinary <option> and <optgroup> children, so a form swaps <select> for
 * <Select> and changes nothing else. A disabled option with an empty value is
 * the placeholder. Three data attributes add what a native list cannot show:
 * data-detail on an option (a figure on the right of the row), and data-hint
 * and data-tile on a group (a second line and a small tile in its heading).
 */
export function readOptions(children: React.ReactNode) {
  const groups: SelectGroup[] = [];
  const found: { placeholder?: string } = {};
  let loose: SelectGroup | undefined;

  const walk = (nodes: React.ReactNode, group?: SelectGroup) => {
    React.Children.forEach(nodes, (node) => {
      if (!React.isValidElement<OptionProps>(node)) return;
      const p = node.props;
      if (node.type === React.Fragment) {
        walk(p.children, group);
      } else if (node.type === "optgroup") {
        loose = undefined;
        const next: SelectGroup = { label: p.label, hint: p["data-hint"], tile: p["data-tile"], options: [] };
        groups.push(next);
        walk(p.children, next);
      } else if (node.type === "option") {
        const label = textOf(p.children);
        const value = String(p.value ?? label);
        if (value === "" && p.disabled) {
          found.placeholder = label;
          return;
        }
        if (!group && !loose) {
          loose = { options: [] };
          groups.push(loose);
        }
        (group ?? loose)?.options.push({ value, label, disabled: !!p.disabled, lang: p.lang, detail: p["data-detail"] });
      }
    });
  };
  walk(children);
  return { groups, placeholder: found.placeholder };
}
