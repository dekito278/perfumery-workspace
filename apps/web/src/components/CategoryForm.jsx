
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
        <div className="flex gap-3 items-center">
          <div 
            className="w-10 h-10 rounded-xl border-2 border-border shrink-0 shadow-sm"
            style={{ backgroundColor: color }}
          />
          <div className="flex-1 flex items-center gap-2">
            <Input
              id="category-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value.toUpperCase())}
              required
              className="h-10 w-16 cursor-pointer p-1"
            />
            <Input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#FFB6D9"
              required
              pattern="^#[0-9A-Fa-f]{6}$"
              className="text-foreground font-mono h-10"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Klik kotak warna untuk membuka picker, lalu geser sampai warnanya pas.</p>
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
