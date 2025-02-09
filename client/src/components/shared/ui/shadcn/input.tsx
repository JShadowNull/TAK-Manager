import * as React from "react"
import { cn } from "@/lib/utils"
import { Combobox } from "@/components/shared/ui/shadcn/combobox";
import { ChevronsUpDown } from "lucide-react";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  id?: string;
  options?: Array<{ value: string; text?: string }>;
  isCertificateDropdown?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement | HTMLSelectElement>;
  hideArrows?: boolean;
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
    hideArrows = false,
    ...props 
  }, ref) => {
    const handleNumberChange = (increment: boolean) => {
      if (type !== 'number' || !onChange) return;
      
      const currentValue = Number(value) || 0;
      const step = props.step ? Number(props.step) : 1;
      let newValue = increment ? currentValue + step : currentValue - step;
      
      // Respect min/max bounds
      if (min !== undefined) newValue = Math.max(min, newValue);
      if (max !== undefined) newValue = Math.min(max, newValue);
      
      onChange({ target: { value: newValue.toString() } } as React.ChangeEvent<HTMLInputElement>);
    };

    if (type === 'select') {
      return (
        <div className="w-fit cursor-pointer">
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

    // Number input with custom controls
    if (type === 'number') {
      return (
        <div className="relative w-fit">
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
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              !hideArrows && "pr-8",
              className
            )}
            ref={ref}
            {...props}
          />
          {!hideArrows && (
            <div 
              className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"
            >
              <div
                className="h-full flex items-center justify-center cursor-pointer pointer-events-auto"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickY = e.clientY - rect.top;
                  const isUpperHalf = clickY < rect.height / 2;
                  handleNumberChange(isUpperHalf);
                }}
                onMouseUp={() => {}}
              >
                <ChevronsUpDown 
                  className={cn(
                    "h-4 w-4 shrink-0 opacity-50 transition-colors hover:text-foreground",
                    disabled && "opacity-30 pointer-events-none"
                  )}
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    // Default text/password input
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
          "flex h-10 w-fit rounded-md border cursor border-input cursor-text bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
