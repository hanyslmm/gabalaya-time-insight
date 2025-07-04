
import React, { useState, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import CharacterSelector from './CharacterSelector';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const characters = {
  'cat-1': '🐱',
  'cat-2': '🐯',
  'monkey': '🐵',
  'penguin': '🐧',
  'fox': '🦊',
  'koala': '🐨',
  'panda': '🐼',
  'lion': '🦁',
  'unicorn': '🦄',
  'dragon': '🐉',
  'robot': '🤖',
  'alien': '👽'
};

interface ProfileAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  showChangeOption?: boolean;
  employeeName?: string;
}

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({ size = 'md', showChangeOption = false, employeeName }) => {
  const { user } = useAuth();
  const [selectedCharacter, setSelectedCharacter] = useState('cat-1');
  const [isOpen, setIsOpen] = useState(false);

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-16 w-16'
  };

  const emojiSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-3xl'
  };

  useEffect(() => {
    // Load user's or employee's character preference from localStorage
    const storageKey = employeeName ? `employee-character-${employeeName}` : `user-character-${user?.id}`;
    const savedCharacter = localStorage.getItem(storageKey);
    if (savedCharacter && characters[savedCharacter as keyof typeof characters]) {
      setSelectedCharacter(savedCharacter);
    } else {
      // Default character based on name hash for consistency
      const defaultCharacter = employeeName ? 
        Object.keys(characters)[Math.abs(employeeName.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % Object.keys(characters).length] :
        'cat-1';
      setSelectedCharacter(defaultCharacter);
    }
  }, [user?.id, employeeName]);

  const handleCharacterSelect = (character: string) => {
    setSelectedCharacter(character);
    // Save to localStorage
    const storageKey = employeeName ? `employee-character-${employeeName}` : `user-character-${user?.id}`;
    localStorage.setItem(storageKey, character);
    setIsOpen(false);
  };

  const avatarContent = (
    <Avatar className={sizeClasses[size]}>
      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
        <span className={emojiSizes[size]}>
          {characters[selectedCharacter as keyof typeof characters]}
        </span>
      </AvatarFallback>
    </Avatar>
  );

  if (!showChangeOption) {
    return avatarContent;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="p-0 h-auto rounded-full">
          {avatarContent}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <CharacterSelector
          selectedCharacter={selectedCharacter}
          onSelect={handleCharacterSelect}
          onClose={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ProfileAvatar;
