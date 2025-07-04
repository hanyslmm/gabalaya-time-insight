
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Languages, Globe } from 'lucide-react';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    // Change document direction for Arabic with smooth transition
    document.documentElement.style.transition = 'all 0.3s ease-in-out';
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lng;
    
    // Apply font changes
    if (lng === 'ar') {
      document.body.classList.add('font-arabic');
    } else {
      document.body.classList.remove('font-arabic');
    }
    
    // Remove transition after animation completes
    setTimeout(() => {
      document.documentElement.style.transition = '';
    }, 300);
  };

  const currentLanguage = i18n.language;
  const isRTL = currentLanguage === 'ar';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`flex items-center space-x-2 hover:bg-accent/10 transition-all duration-200 rounded-xl ${isRTL ? 'space-x-reverse' : ''}`}
        >
          <Globe className="h-4 w-4 text-primary" />
          <span className={`hidden sm:inline font-medium ${isRTL ? 'font-arabic' : ''}`}>
            {currentLanguage === 'ar' ? 'العربية' : 'English'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align={isRTL ? 'start' : 'end'} 
        className={`w-48 shadow-lg border-0 bg-card/95 backdrop-blur-xl ${isRTL ? 'rtl' : ''}`}
      >
        <DropdownMenuItem 
          onClick={() => changeLanguage('en')}
          className={`${currentLanguage === 'en' ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-accent/10'} cursor-pointer transition-all duration-200 rounded-lg mx-1 ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <div className={`flex items-center w-full ${isRTL ? 'flex-row-reverse space-x-reverse' : 'space-x-3'}`}>
            <span className="text-lg">🇺🇸</span>
            <span className="font-medium">English</span>
            {currentLanguage === 'en' && (
              <div className="w-2 h-2 bg-primary rounded-full ml-auto"></div>
            )}
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => changeLanguage('ar')}
          className={`${currentLanguage === 'ar' ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-accent/10'} cursor-pointer transition-all duration-200 rounded-lg mx-1 ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <div className={`flex items-center w-full ${isRTL ? 'flex-row-reverse space-x-reverse' : 'space-x-3'}`}>
            <span className="text-lg">🇸🇦</span>
            <span className={`font-medium ${isRTL ? 'font-arabic' : ''}`}>العربية</span>
            {currentLanguage === 'ar' && (
              <div className="w-2 h-2 bg-primary rounded-full ml-auto"></div>
            )}
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
