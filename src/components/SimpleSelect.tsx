import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * The flat, single-choice case of the shadcn Select, which is every select in
 * this panel.
 *
 * The composed form is five nested components per picker; with six pickers
 * across the filters and the route choosers, repeating it buries what each one
 * is actually for. `items` is passed to the root so the trigger can label
 * itself from the same list the popup is built from — otherwise the selected
 * value renders as its raw id.
 */
export function SimpleSelect({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
  size,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel: string;
  className?: string;
  size?: 'sm' | 'default';
}) {
  return (
    <Select
      value={value}
      onValueChange={next => onValueChange(String(next ?? ''))}
      items={options}
    >
      <SelectTrigger aria-label={ariaLabel} className={className} size={size}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
