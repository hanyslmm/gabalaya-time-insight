import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, ArrowUp, ArrowDown, Info, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RegulationItem {
  id: string;
  text: string;
  subItems?: RegulationItem[];
}

interface RegulationSection {
  id: string;
  title: string;
  items: RegulationItem[];
}

interface WorkRegulationEditorProps {
  content: string;
  onChange: (htmlContent: string) => void;
}

// Parse HTML content into structured sections
const parseHTMLToSections = (html: string): RegulationSection[] => {
  if (!html) return [{ id: 'section-1', title: '', items: [] }];
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const sections: RegulationSection[] = [];
  
  // Find the main content div
  const contentDiv = doc.querySelector('.work-regulations-content') || doc.body;
  
  let currentSection: RegulationSection | null = null;
  let sectionCounter = 0;
  
  // Process nodes in order - only process top-level H2 and UL elements
  Array.from(contentDiv.childNodes).forEach(node => {
    // Skip footer note div
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.classList?.contains('footer-note')) {
        return;
      }
      
      if (element.tagName === 'H2') {
        // Save previous section if exists
        if (currentSection) {
          sections.push(currentSection);
        }
        // Start new section
        sectionCounter++;
        currentSection = {
          id: `section-${sectionCounter}`,
          title: element.textContent?.trim() || '',
          items: []
        };
      } else if (element.tagName === 'UL' && currentSection) {
        // Process list items - only process direct children, not nested lists
        const listItems = Array.from(element.children).filter(child => child.tagName === 'LI');
        
        listItems.forEach((li, index) => {
          const strong = li.querySelector('strong');
          let itemText = '';
          
          // Clone the li to work with it
          const liClone = li.cloneNode(true) as HTMLElement;
          
          // Remove nested UL first to get main text
          const nestedUl = liClone.querySelector(':scope > ul');
          if (nestedUl) {
            nestedUl.remove();
          }
          
          // Get text content, handling strong tags
          if (strong) {
            const strongText = strong.textContent?.trim() || '';
            // Get text from cloned li (nested ul already removed)
            const fullText = liClone.textContent?.trim() || '';
            // Remove the strong text from the full text to get the rest
            let restText = fullText.replace(strongText, '').trim();
            // Remove leading colon or punctuation if present
            restText = restText.replace(/^[:،;]\s*/, '').trim();
            
            // Combine: if strongText already ends with punctuation, just add space
            // Otherwise, add colon and space
            const endsWithPunctuation = /[:،;]$/.test(strongText);
            if (restText) {
              itemText = endsWithPunctuation 
                ? `${strongText} ${restText}` 
                : `${strongText}: ${restText}`;
            } else {
              itemText = strongText;
            }
          } else {
            // No strong tag, just get the text (nested ul already removed)
            itemText = liClone.textContent?.trim() || '';
          }
          
          // Check for nested lists (sub-items) - use original li, not clone
          const subItems: RegulationItem[] = [];
          const originalNestedUl = li.querySelector(':scope > ul');
          if (originalNestedUl) {
            const nestedLis = Array.from(originalNestedUl.children).filter(child => child.tagName === 'LI');
            nestedLis.forEach((nestedLi) => {
              const nestedText = nestedLi.textContent?.trim() || '';
              if (nestedText) {
                subItems.push({
                  id: `subitem-${Date.now()}-${Math.random()}`,
                  text: nestedText
                });
              }
            });
          }
          
          // Always add item, even if empty (to preserve newly added items)
          // Use a more unique ID based on index and timestamp
          currentSection!.items.push({
            id: `item-${Date.now()}-${index}-${Math.random()}`,
            text: itemText,
            subItems: subItems.length > 0 ? subItems : undefined
          });
        });
      }
    }
  });
  
  // Save last section
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections.length > 0 ? sections : [{ id: 'section-1', title: '', items: [] }];
};

// Convert structured sections back to HTML
const convertSectionsToHTML = (sections: RegulationSection[]): string => {
  let html = '<div class="work-regulations-content">\n';
  
  sections.forEach((section) => {
    if (section.title.trim()) {
      html += `<h2>${escapeHTML(section.title)}</h2>\n`;
    }
    
    // Always include items list, even if empty, to preserve structure
    html += '<ul>\n';
    section.items.forEach((item) => {
      // Check if item has bold text (format: "Bold Text: rest of text")
      const parts = item.text.split(':');
      let itemHTML = '';
      
      if (parts.length > 1 && parts[0].trim()) {
        const boldText = parts[0].trim();
        const restText = parts.slice(1).join(':').trim();
        itemHTML = `<li><strong>${escapeHTML(boldText)}</strong>${restText ? ': ' + escapeHTML(restText) : ''}`;
      } else if (item.text.trim()) {
        itemHTML = `<li>${escapeHTML(item.text)}`;
      } else {
        // Empty item - still include it to preserve newly added items
        itemHTML = `<li>`;
      }
      
      // Add sub-items if any
      if (item.subItems && item.subItems.length > 0) {
        itemHTML += '\n<ul>\n';
        item.subItems.forEach((subItem) => {
          itemHTML += `<li>${escapeHTML(subItem.text)}</li>\n`;
        });
        itemHTML += '</ul>\n';
      }
      
      itemHTML += '</li>\n';
      html += itemHTML;
    });
    html += '</ul>\n';
  });
  
  html += '</div>';
  
  return html;
};

const escapeHTML = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const WorkRegulationEditor: React.FC<WorkRegulationEditorProps> = ({ content, onChange }) => {
  const { t } = useTranslation();
  const [sections, setSections] = useState<RegulationSection[]>([]);

  const [isInitialized, setIsInitialized] = useState(false);
  const lastContentRef = useRef<string>('');
  const isInternalUpdateRef = useRef<boolean>(false);
  const onChangeRef = useRef(onChange);
  
  // Keep onChange ref updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Parse content when it changes externally (e.g., when editing starts)
  // Only parse when content actually changes from external source, not from our own updates
  useEffect(() => {
    const contentHash = content || '';
    
    // Skip if this is an internal update (we're the ones changing content)
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      lastContentRef.current = contentHash;
      return;
    }
    
    // Only re-parse if content hash changed from external source
    if (contentHash !== lastContentRef.current) {
      // Parse content (either initial or when content changes externally)
      if (content) {
        const parsed = parseHTMLToSections(content);
        setSections(parsed.length > 0 ? parsed : [{ id: 'section-1', title: '', items: [] }]);
      } else {
        setSections([{ id: 'section-1', title: '', items: [] }]);
      }
      
      if (!isInitialized) {
        setIsInitialized(true);
      }
      
      lastContentRef.current = contentHash;
    }
  }, [content, isInitialized]);

  // Convert sections to HTML when sections change (but skip initial parse)
  // Use debouncing to prevent excessive updates, but don't interfere with typing
  useEffect(() => {
    if (!isInitialized || sections.length === 0) return;
    
    const timeoutId = setTimeout(() => {
      const html = convertSectionsToHTML(sections);
      // Normalize HTML for comparison (remove extra whitespace)
      const normalizedHtml = html.replace(/\s+/g, ' ').trim();
      const normalizedContent = (content || '').replace(/\s+/g, ' ').trim();
      
      // Only call onChange if HTML actually changed to avoid infinite loops
      if (normalizedHtml !== normalizedContent) {
        isInternalUpdateRef.current = true;
        onChangeRef.current(html);
      }
    }, 500); // Debounce to 500ms to avoid interfering with typing
    
    return () => clearTimeout(timeoutId);
  }, [sections, isInitialized, content]);

  const addSection = useCallback(() => {
    setSections(prevSections => [...prevSections, { id: `section-${Date.now()}`, title: '', items: [] }]);
  }, []);

  const updateSectionTitle = React.useCallback((sectionId: string, title: string) => {
    setSections(prevSections => prevSections.map(s => s.id === sectionId ? { ...s, title } : s));
  }, []);

  const deleteSection = useCallback((sectionId: string) => {
    setSections(prevSections => {
      if (prevSections.length > 1) {
        return prevSections.filter(s => s.id !== sectionId);
      }
      return prevSections;
    });
  }, []);

  const moveSection = useCallback((sectionId: string, direction: 'up' | 'down') => {
    setSections(prevSections => {
      const index = prevSections.findIndex(s => s.id === sectionId);
      if (index === -1) return prevSections;
      
      if (direction === 'up' && index === 0) return prevSections;
      if (direction === 'down' && index === prevSections.length - 1) return prevSections;
      
      const newSections = [...prevSections];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
      return newSections;
    });
  }, []);

  const addItem = useCallback((sectionId: string) => {
    setSections(prevSections => prevSections.map(s => 
      s.id === sectionId 
        ? { ...s, items: [...s.items, { id: `item-${Date.now()}`, text: '' }] }
        : s
    ));
  }, []);

  const updateItem = React.useCallback((sectionId: string, itemId: string, text: string) => {
    setSections(prevSections => {
      const newSections = prevSections.map(s => 
        s.id === sectionId 
          ? { 
              ...s, 
              items: s.items.map(item => 
                item.id === itemId ? { ...item, text } : item
              )
            }
          : s
      );
      return newSections;
    });
  }, []);

  const deleteItem = useCallback((sectionId: string, itemId: string) => {
    setSections(prevSections => prevSections.map(s => 
      s.id === sectionId 
        ? { ...s, items: s.items.filter(item => item.id !== itemId) }
        : s
    ));
  }, []);

  const moveItem = useCallback((sectionId: string, itemId: string, direction: 'up' | 'down') => {
    setSections(prevSections => prevSections.map(s => {
      if (s.id !== sectionId) return s;
      const index = s.items.findIndex(item => item.id === itemId);
      if (index === -1) return s;
      if (direction === 'up' && index === 0) return s;
      if (direction === 'down' && index === s.items.length - 1) return s;
      
      const newItems = [...s.items];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
      return { ...s, items: newItems };
    }));
  }, []);

  const addSubItem = useCallback((sectionId: string, itemId: string) => {
    setSections(prevSections => prevSections.map(s => 
      s.id === sectionId 
        ? { 
            ...s, 
            items: s.items.map(item => 
              item.id === itemId 
                ? { ...item, subItems: [...(item.subItems || []), { id: `subitem-${Date.now()}`, text: '' }] }
                : item
            )
          }
        : s
    ));
  }, []);

  const updateSubItem = React.useCallback((sectionId: string, itemId: string, subItemId: string, text: string) => {
    setSections(prevSections => {
      const newSections = prevSections.map(s => 
        s.id === sectionId 
          ? { 
              ...s, 
              items: s.items.map(item => 
                item.id === itemId 
                  ? { 
                      ...item, 
                      subItems: item.subItems?.map(subItem => 
                        subItem.id === subItemId ? { ...subItem, text } : subItem
                      )
                    }
                  : item
              )
            }
          : s
      );
      return newSections;
    });
  }, []);

  const deleteSubItem = useCallback((sectionId: string, itemId: string, subItemId: string) => {
    setSections(prevSections => prevSections.map(s => 
      s.id === sectionId 
        ? { 
            ...s, 
            items: s.items.map(item => 
              item.id === itemId 
                ? { ...item, subItems: item.subItems?.filter(subItem => subItem.id !== subItemId) }
                : item
            )
          }
        : s
    ));
  }, []);

  // Character limits
  const MAX_SECTION_TITLE = 200;
  const MAX_ITEM_TEXT = 1000;
  const MAX_SUBITEM_TEXT = 500;

  // Auto-resize textarea component - optimized to preserve focus
  const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; maxLength?: number }>(
    ({ value, className, maxLength, onChange, ...props }, ref) => {
      const textareaRef = useRef<HTMLTextAreaElement>(null);
      const combinedRef = (ref || textareaRef) as React.MutableRefObject<HTMLTextAreaElement>;
      
      // Resize function that preserves cursor position
      const resizeTextarea = React.useCallback((textarea: HTMLTextAreaElement, preserveCursor = false) => {
        if (!textarea) return;
        
        const scrollTop = textarea.scrollTop;
        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;
        const isFocused = document.activeElement === textarea;
        
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const newHeight = Math.max(scrollHeight, 80);
        textarea.style.height = `${newHeight}px`;
        
        // Restore scroll position
        textarea.scrollTop = scrollTop;
        
        // Restore cursor position if focused and preserveCursor is true
        if (preserveCursor && isFocused) {
          requestAnimationFrame(() => {
            if (document.activeElement === textarea) {
              textarea.setSelectionRange(selectionStart, selectionEnd);
            }
          });
        }
      }, []);
      
      // Only resize when value changes and textarea is NOT focused
      useEffect(() => {
        const textarea = combinedRef.current;
        if (textarea && document.activeElement !== textarea) {
          resizeTextarea(textarea, false);
        }
      }, [value, resizeTextarea]);
      
      const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        
        // Resize immediately while preserving cursor
        resizeTextarea(textarea, true);
        
        // Call original onChange
        if (onChange) {
          onChange(e);
        }
      };
      
      const handleBlur = () => {
        const textarea = combinedRef.current;
        if (textarea) {
          resizeTextarea(textarea, false);
        }
      };
      
      return (
        <Textarea
          ref={combinedRef}
          value={value}
          maxLength={maxLength}
          className={className}
          onChange={handleChange}
          onBlur={handleBlur}
          {...props}
        />
      );
    }
  );
  AutoResizeTextarea.displayName = 'AutoResizeTextarea';

  return (
    <div className="space-y-6">
      {sections.map((section, sectionIndex) => (
        <Card key={section.id} className="border-2 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-primary/20"
                  disabled={sectionIndex === 0}
                  onClick={() => moveSection(section.id, 'up')}
                  title={t('moveUp') || 'Move up'}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-primary/20"
                  disabled={sectionIndex === sections.length - 1}
                  onClick={() => moveSection(section.id, 'down')}
                  title={t('moveDown') || 'Move down'}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold text-foreground">
                    {t('section') || 'Section'} {sectionIndex + 1}
                  </Label>
                  {sections.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSection(section.id)}
                      className="text-destructive hover:bg-destructive/10 h-7 px-2"
                      title={t('deleteSection') || 'Delete section'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Input
                  value={section.title}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    if (newValue.length <= MAX_SECTION_TITLE) {
                      updateSectionTitle(section.id, newValue);
                    }
                  }}
                  onKeyDown={(e) => {
                    // Prevent Enter from submitting
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  placeholder={t('enterSectionTitle') || 'Enter section title (e.g., المادة (1): مبادئ تنظيم الجدول)'}
                  className={cn(
                    "text-lg font-semibold h-12 border-2 focus:border-primary/50 transition-colors",
                    section.title.length >= MAX_SECTION_TITLE * 0.9 && "border-amber-500/50"
                  )}
                  maxLength={MAX_SECTION_TITLE}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {section.title.length} / {MAX_SECTION_TITLE} {t('characters') || 'characters'}
                  </p>
                  {section.title.length >= MAX_SECTION_TITLE * 0.9 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t('approachingLimit') || 'Approaching limit'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {section.items.map((item, itemIndex) => (
              <div key={item.id} className="space-y-3 p-4 bg-muted/30 rounded-lg border-2 border-border/50 hover:border-primary/30 transition-all duration-200 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 pt-2">
                    <div className="p-1 mb-1">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-primary/20"
                      disabled={itemIndex === 0}
                      onClick={() => moveItem(section.id, item.id, 'up')}
                      title={t('moveUp') || 'Move up'}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-primary/20"
                      disabled={itemIndex === section.items.length - 1}
                      onClick={() => moveItem(section.id, item.id, 'down')}
                      title={t('moveDown') || 'Move down'}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="relative">
                      <AutoResizeTextarea
                        value={item.text}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          if (newValue.length <= MAX_ITEM_TEXT) {
                            updateItem(section.id, item.id, newValue);
                          }
                        }}
                        onKeyDown={(e) => {
                          // Allow Tab for indentation
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            const textarea = e.currentTarget;
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const newValue = item.text.substring(0, start) + '  ' + item.text.substring(end);
                            if (newValue.length <= MAX_ITEM_TEXT) {
                              updateItem(section.id, item.id, newValue);
                              setTimeout(() => {
                                textarea.setSelectionRange(start + 2, start + 2);
                                textarea.focus();
                              }, 0);
                            }
                          }
                        }}
                        placeholder={t('enterItemText') || 'Enter item text (e.g., أساس الجدولة: يتم وضع الجداول...)'}
                        className={cn(
                          "min-h-[100px] resize-y text-base leading-relaxed border-2 focus:border-primary/50 transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-primary/20",
                          item.text.length >= MAX_ITEM_TEXT * 0.9 && "border-amber-500/50"
                        )}
                        style={{ minHeight: '100px' }}
                        maxLength={MAX_ITEM_TEXT}
                      />
                      <div className="absolute bottom-2 right-2 flex items-center gap-2 pointer-events-none z-0">
                        {item.text.length >= MAX_ITEM_TEXT * 0.9 && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            {t('approachingLimit') || 'Approaching limit'}
                          </span>
                        )}
                        <span className={cn(
                          "text-xs bg-background/90 px-2 py-1 rounded border",
                          item.text.length >= MAX_ITEM_TEXT ? "text-destructive border-destructive/50" : "text-muted-foreground border-border"
                        )}>
                          {item.text.length} / {MAX_ITEM_TEXT}
                        </span>
                      </div>
                    </div>
                    {!item.text && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        {t('formatHint') || 'Tip: Use "Bold Text: rest of text" format for bold labels'}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteItem(section.id, item.id)}
                    className="text-destructive hover:bg-destructive/10 h-10 w-10"
                    title={t('deleteItem') || 'Delete item'}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
                
                {/* Sub-items */}
                {item.subItems && item.subItems.length > 0 && (
                  <div className="ms-8 md:ms-12 space-y-3 border-r-2 border-primary/30 pr-4 pl-4 bg-background/50 rounded-r-lg">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t('subItems') || 'Sub-Items'}
                    </Label>
                    {item.subItems.map((subItem) => (
                      <div key={subItem.id} className="flex items-start gap-2 p-3 bg-background rounded-lg border-2 border-border/50 hover:border-primary/30 transition-all">
                        <div className="flex-1 relative">
                          <AutoResizeTextarea
                            value={subItem.text}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              if (newValue.length <= MAX_SUBITEM_TEXT) {
                                updateSubItem(section.id, item.id, subItem.id, newValue);
                              }
                            }}
                            placeholder={t('enterSubItemText') || 'Enter sub-item text'}
                            className={cn(
                              "flex-1 resize-y text-sm min-h-[80px] border-2 focus:border-primary/50 transition-colors",
                              "focus-visible:ring-2 focus-visible:ring-primary/20",
                              subItem.text.length >= MAX_SUBITEM_TEXT * 0.9 && "border-amber-500/50"
                            )}
                            style={{ minHeight: '80px' }}
                            maxLength={MAX_SUBITEM_TEXT}
                          />
                          {subItem.text && (
                            <div className="absolute bottom-1 right-1 text-xs text-muted-foreground bg-background/90 px-1.5 py-0.5 rounded pointer-events-none z-0">
                              {subItem.text.length} / {MAX_SUBITEM_TEXT}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSubItem(section.id, item.id, subItem.id)}
                          className="text-destructive hover:bg-destructive/10 h-10 w-10 shrink-0"
                          title={t('deleteSubItem') || 'Delete sub-item'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addSubItem(section.id, item.id)}
                      className="w-full gap-2 border-dashed"
                    >
                      <Plus className="h-4 w-4" />
                      {t('addSubItem') || 'Add Sub-Item'}
                    </Button>
                  </div>
                )}
                
                {/* Add sub-item button if no sub-items exist */}
                {(!item.subItems || item.subItems.length === 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addSubItem(section.id, item.id)}
                    className="ms-8 md:ms-12 gap-2 border-dashed"
                  >
                    <Plus className="h-4 w-4" />
                    {t('addSubItem') || 'Add Sub-Item'}
                  </Button>
                )}
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addItem(section.id);
              }}
              className="w-full gap-2 h-12 border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-colors font-medium cursor-pointer relative z-10"
            >
              <Plus className="h-5 w-5" />
              {t('addItem') || 'Add Item'}
            </Button>
          </CardContent>
        </Card>
      ))}
      
      <Button
        variant="outline"
        onClick={addSection}
        className="w-full gap-2 h-14 border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-colors font-semibold text-lg"
      >
        <Plus className="h-5 w-5" />
        {t('addSection') || 'Add Section'}
      </Button>
    </div>
  );
};

export default WorkRegulationEditor;

