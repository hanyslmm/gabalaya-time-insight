
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
}

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({ size = 'md', showChangeOption = false }) => {
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
    // Load user's character preference from localStorage or database
    const savedCharacter = localStorage.getItem(`user-character-${user?.id}`);
    if (savedCharacter && characters[savedCharacter as keyof typeof characters]) {
      setSelectedCharacter(savedCharacter);
    }
  }, [user?.id]);

  const handleCharacterSelect = (character: string) => {
    setSelectedCharacter(character);
    // Save to localStorage (you could also save to database)
    localStorage.setItem(`user-character-${user?.id}`, character);
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
