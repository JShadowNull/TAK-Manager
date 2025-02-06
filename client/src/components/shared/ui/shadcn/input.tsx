import * as React from "react"
import { cn } from "@/lib/utils"
import { Combobox } from "@/components/shared/ui/shadcn/combobox";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  id?: string;
  options?: Array<{ value: string; text?: string }>;
  isCertificateDropdown?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement | HTMLSelectElement>;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className,
    type = "text",
    id,
    placeholder,
    value = '',
    onChange,
    onBlur,
    options = [],
    isCertificateDropdown = false,
    checked = false,
    disabled = false,
    min,
    max,
    required = false,
    ...props 
  }, ref) => {

    if (type === 'select') {
      return (
        <div className="w-fit">
          <Combobox
            options={options.map(option => ({ label: option.text || option.value, value: option.value }))}
            value={value as string}
            onSelect={(selectedValue: string) => {
              if (onChange) {
                onChange({ target: { value: selectedValue } } as React.ChangeEvent<HTMLInputElement | HTMLSelectElement>);
              }
            }}
            placeholder={placeholder || (isCertificateDropdown ? "Select Certificate..." : "Select Item...")}
            disabled={disabled}
          />
        </div>
      );
    }

    // Default text/password/number input
    return (
      <input
        type={type}
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        className={cn(
          "flex h-10 w-fit rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input"

export { Input }
