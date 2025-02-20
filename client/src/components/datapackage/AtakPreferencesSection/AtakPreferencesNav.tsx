import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger } from "@/components/shared/ui/shadcn/navigation-menu";
import { PREFERENCE_CATEGORIES } from "./atakPreferencesConfig";

interface AtakPreferencesNavProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  categories: typeof PREFERENCE_CATEGORIES;
}

export const AtakPreferencesNav = ({ 
  activeCategory, 
  onCategoryChange,
  categories 
}: AtakPreferencesNavProps) => {
  return (
    <NavigationMenu className="w-full mb-4">
      <NavigationMenuList className="flex-wrap" showSeparator={true}>
        {Object.entries(categories).map(([key, name]) => (
          <NavigationMenuItem key={key}>
            <NavigationMenuTrigger
              showChevron={false}
              onClick={() => onCategoryChange(key)}
              className={`text-sm px-3 py-1 ${
                activeCategory === key 
                  ? 'bg-accent text-accent-foreground' 
                  : 'hover:bg-accent/50'
              }`}
            >
              {name}
            </NavigationMenuTrigger>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}; 