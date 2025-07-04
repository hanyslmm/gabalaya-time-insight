
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface CharacterSelectorProps {
  selectedCharacter: string;
  onSelect: (character: string) => void;
  onClose: () => void;
}

const characters = [
  { id: 'cat-1', name: 'Orange Cat', emoji: '🐱', color: 'bg-orange-100' },
  { id: 'cat-2', name: 'Grey Cat', emoji: '🐯', color: 'bg-gray-100' },
  { id: 'monkey', name: 'Monkey', emoji: '🐵', color: 'bg-yellow-100' },
  { id: 'penguin', name: 'Penguin', emoji: '🐧', color: 'bg-blue-100' },
  { id: 'fox', name: 'Fox', emoji: '🦊', color: 'bg-red-100' },
  { id: 'koala', name: 'Koala', emoji: '🐨', color: 'bg-green-100' },
  { id: 'panda', name: 'Panda', emoji: '🐼', color: 'bg-gray-100' },
  { id: 'lion', name: 'Lion', emoji: '🦁', color: 'bg-yellow-100' },
  { id: 'unicorn', name: 'Unicorn', emoji: '🦄', color: 'bg-purple-100' },
  { id: 'dragon', name: 'Dragon', emoji: '🐉', color: 'bg-green-100' },
  { id: 'robot', name: 'Robot', emoji: '🤖', color: 'bg-blue-100' },
  { id: 'alien', name: 'Alien', emoji: '👽', color: 'bg-green-100' }
];

const CharacterSelector: React.FC<CharacterSelectorProps> = ({ selectedCharacter, onSelect, onClose }) => {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Choose Your Avatar
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </CardTitle>
        <CardDescription>
          Select a fun character to represent you
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          {characters.map((character) => (
            <Button
              key={character.id}
              variant="ghost"
              className={`h-16 w-16 p-2 rounded-full ${character.color} ${
                selectedCharacter === character.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => onSelect(character.id)}
            >
              <span className="text-2xl">{character.emoji}</span>
            </Button>
          ))}
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Selected: {characters.find(c => c.id === selectedCharacter)?.name || 'None'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CharacterSelector;
