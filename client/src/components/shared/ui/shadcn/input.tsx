import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  id?: string;
  options?: Array<{ value: string; text?: string }>;
  isCertificateDropdown?: boolean;
  isPreferenceValueCheckbox?: boolean;
  min?: number;
  max?: number;
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
    isPreferenceValueCheckbox = false,
    min,
    max,
    required = false,
    ...props 
  }, ref) => {

    // Number input with plus/minus buttons
    if (type === 'number') {
      const currentValue = parseInt(value as string || '0');

      const handleIncrement = () => {
        if (max === undefined || currentValue < max) {
          onChange?.({ 
            target: { value: (currentValue + 1).toString() }
          } as React.ChangeEvent<HTMLInputElement>);
        }
      };

      const handleDecrement = () => {
        if (min === undefined || currentValue > min) {
          onChange?.({ 
            target: { value: (currentValue - 1).toString() }
          } as React.ChangeEvent<HTMLInputElement>);
        }
      };

      return (
        <div className="flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={handleDecrement}
            disabled={disabled || (min !== undefined && currentValue <= min)}
            className={cn(`
              p-1 rounded-lg border border-border bg-primary
              hover:bg-selectedColor hover:foreground transition-colors duration-200
              ${disabled || (min !== undefined && currentValue <= min) ? 'opacity-50 cursor-not-allowed' : ''}
            `)}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
          <input
            type="text"
            id={id}
            value={value}
            onChange={(e) => {
              const newValue = e.target.value.replace(/[^0-9]/g, '');
              const numValue = newValue === '' ? 0 : parseInt(newValue);
              if (newValue === '' || (min !== undefined && numValue < min) || (max !== undefined && numValue > max)) {
                return;
              }
              onChange?.(e);
            }}
            onBlur={onBlur}
            disabled={disabled}
            required={required}
            className={cn(
              "w-16 text-center bg-background text-sm border border-border",
              "p-2 rounded-lg text-primary-foreground",
              "focus:outline-none focus:ring-2 focus:ring-selectedColor",
              disabled && "opacity-50 cursor-not-allowed",
              className
            )}
            ref={ref}
            {...props}
          />
          <button
            type="button"
            onClick={handleIncrement}
            disabled={disabled || (max !== undefined && currentValue >= max)}
            className={cn(`
              p-1 rounded-lg border border-border bg-primary
              hover:bg-selectedColor hover:foreground transition-colors duration-200
              ${disabled || (max !== undefined && currentValue >= max) ? 'opacity-50 cursor-not-allowed' : ''}
            `)}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      );
    }

    // Certificate dropdown select input
    if (type === 'select') {
      return (
        <div className="relative w-full">
          <select 
            className={cn(
              "dropdown w-full bg-primary text-sm border border-border",
              "p-2 pl-3 pr-10 rounded-lg cursor-pointer appearance-none",
              "focus:outline-none focus:ring-2 focus:ring-selectedColor focus:border-selectedColor",
              "transition-colors duration-200",
              disabled && "opacity-50 cursor-not-allowed",
              isCertificateDropdown && "cert-select",
              className
            )}
            value={value?.toString() || ''}
            onChange={onChange as React.ChangeEventHandler<HTMLSelectElement>}
            onBlur={onBlur as React.FocusEventHandler<HTMLSelectElement>}
            name={id}
            id={id}
            disabled={disabled}
            required={required}
            data-certificate-dropdown={isCertificateDropdown}
          >
            {Array.isArray(options) && options.length > 0 ? (
              <>
                <option value="">{isCertificateDropdown ? "Select Certificate..." : "Select..."}</option>
                {options.map((option, index) => (
                  <option key={`${option.value}-${index}`} value={option.value}>
                    {option.text || option.value}
                  </option>
                ))}
              </>
            ) : (
              <option value="">{isCertificateDropdown ? "No certificates available" : "No options available"}</option>
            )}
          </select>
        </div>
      );
    }

    // Value checkbox with SVG icons for preferences
    if (type === 'checkbox' && isPreferenceValueCheckbox) {
      return (
        <div className="relative">
          <input 
            type="checkbox"
            className={cn(
              "peer appearance-none w-4 h-4 bg-transparent border-2 border-transparent rounded cursor-pointer",
              "transition-colors duration-200 ease-in-out",
              "focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50",
              className
            )}
            checked={checked}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            required={required}
            ref={ref}
            {...props}
          />
          {/* Checkmark icon shown when checked */}
          <svg className="absolute inset-0 text-green-500 pointer-events-none hidden peer-checked:block w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
            <path fill="currentColor" d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/>
          </svg>
          {/* X icon shown when unchecked */}
          <svg className="absolute inset-0 text-red-500 pointer-events-none hidden peer-[&:not(:checked)]:block w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
            <path fill="currentColor" d="M376.6 84.5c11.3-13.6 9.5-33.8-4.1-45.1s-33.8-9.5-45.1 4.1L192 206 56.6 43.5C45.3 29.9 25.1 28.1 11.5 39.4S-3.9 70.9 7.4 84.5L150.3 256 7.4 427.5c-11.3 13.6-9.5 33.8 4.1 45.1s33.8 9.5 45.1-4.1L192 306 327.4 468.5c11.3 13.6 31.5 15.4 45.1 4.1s15.4-31.5 4.1-45.1L233.7 256 376.6 84.5z"/>
          </svg>
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
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-sidebar px-3 py-2 text-base ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "md:text-sm",
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
