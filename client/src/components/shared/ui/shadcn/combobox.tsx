import * as React from "react"
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from "@/lib/utils"
import { Button } from "@/components/shared/ui/shadcn/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/shared/ui/shadcn/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shared/ui/shadcn/popover"

interface ComboboxProps {
  options: { label: string; value: string }[]
  value?: string
  onSelect?: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function Combobox({ options = [], value: externalValue, onSelect, placeholder, disabled = false }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(externalValue || "")

  React.useEffect(() => {
    setValue(externalValue || "")
  }, [externalValue])

  const safeOptions = Array.isArray(options) ? options : []

  return (
    <div className="w-full">
      <Popover open={disabled ? false : open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              "justify-between"
            )}
            disabled={disabled}
          >
            <div className="flex-1 text-left break-words overflow-hidden">
              {value
                ? safeOptions.find((option) => option.value === value)?.label
                : placeholder || "Select option..."}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search..." className="h-9" />
              <CommandList>
                <CommandEmpty>No option found.</CommandEmpty>
                <CommandGroup>
                  {safeOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={(currentValue) => {
                        const newValue = currentValue === value ? "" : currentValue
                        setValue(newValue)
                        setOpen(false)
                        onSelect?.(newValue)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 break-words">{option.label}</div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
