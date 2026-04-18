
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const CategoryForm = ({ category, onSave, onCancel, loading }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#FFB6D9');

  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setColor(category.color || '#FFB6D9');
    }
  }, [category]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name, color });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="category-name" className="text-xs font-medium">Category name *</Label>
        <Input
          id="category-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Floral, Woody, Citrus"
          required
          className="text-foreground h-8"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category-color" className="text-xs font-medium">Color *</Label>
        <div className="flex gap-2 items-center">
          <div 
            className="w-8 h-8 rounded border-2 border-border shrink-0"
            style={{ backgroundColor: color }}
          />
          <Input
            id="category-color"
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#FFB6D9"
            required
            pattern="^#[0-9A-Fa-f]{6}$"
            className="text-foreground font-mono h-8"
          />
        </div>
        <p className="text-xs text-muted-foreground">Enter hex color code (e.g., #FFB6D9)</p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} size="sm" className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={loading} size="sm" className="flex-1">
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
};

export default CategoryForm;
