import * as React from "react"
import { cn } from "@/lib/utils"
import { Combobox } from "@/components/shared/ui/shadcn/combobox";
import { ChevronsUpDown, Upload, X } from "lucide-react";

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
  onClearFile?: () => void;
  error?: string;
  onUpDown?: (increment: boolean) => void;
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
    onClearFile,
    error,
    onUpDown,
    ...props 
  }, ref) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);

    const formatFileSize = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleClearFile = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSelectedFile(null);
      onClearFile?.();
    };

    const handleFileChange = (file: File | null) => {
      setSelectedFile(file);
      if (onChange && file) {
        const event = {
          target: {
            type: 'file',
            files: [file],
            value: file.name,
            id,
            name: props.name,
          }
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
      } else if (onChange) {
        const event = {
          target: {
            type: 'file',
            files: [],
            value: '',
            id,
            name: props.name,
          }
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
      }
    };

    const handleNumberChange = (increment: boolean) => {
      if (onUpDown) {
        onUpDown(increment);
      } else if (type === 'number' && onChange) {
        const currentValue = Number(value) || 0;
        const step = props.step ? Number(props.step) : 1;
        let newValue = increment ? currentValue + step : currentValue - step;
        
        // Respect min/max bounds
        if (min !== undefined) newValue = Math.max(min, newValue);
        if (max !== undefined) newValue = Math.min(max, newValue);
        
        onChange({ target: { value: newValue.toString() } } as React.ChangeEvent<HTMLInputElement>);
      }
    };

    // Handle file input change
    React.useEffect(() => {
      if (type === 'file' && fileInputRef.current) {
        const fileInput = fileInputRef.current;
        const handleChange = (e: Event) => {
          const input = e.target as HTMLInputElement;
          const file = input.files?.[0] || null;
          handleFileChange(file);
        };
        fileInput.addEventListener('change', handleChange);
        return () => fileInput.removeEventListener('change', handleChange);
      }
    }, [type, onChange]);

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

    // File input with custom styling
    if (type === 'file') {
      return (
        <div className="relative">
          <div 
            className={cn(
              "flex items-center justify-center w-full h-32 px-4 transition bg-background border-2 border-dashed rounded-lg appearance-none cursor-pointer hover:border-accent-foreground focus:outline-none",
              error ? "border-red-500" : isDragging ? "border-green-500" : "border-border",
              selectedFile ? "border-accent" : "",
              className
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              
              const file = e.dataTransfer.files?.[0] || null;
              if (file) {
                handleFileChange(file);
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              id={id}
              disabled={disabled}
              required={required}
              className="hidden"
              accept={props.accept}
              {...props}
            />
            
            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {selectedFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    className="p-1 rounded-full hover:bg-accent"
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className={cn(
                  "w-8 h-8 text-muted-foreground",
                  isDragging ? "text-green-500" : ""
                )} />
                <span className={cn(
                  "text-sm text-muted-foreground",
                  isDragging ? "text-green-500" : ""
                )}>
                  {placeholder || "Click to select or drag and drop your file"}
                </span>
              </div>
            )}
          </div>
          
          {error && (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          )}
        </div>
      );
    }

    // Number input with custom controls
    if (type === 'number' || onUpDown) {
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
