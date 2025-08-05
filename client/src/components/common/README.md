# Common Form Input Components

This directory contains reusable form input components that provide consistent styling, behavior, and validation across the entire application. All forms and filters should use these components to ensure design consistency and maintainability.

## 🎯 Purpose

- **Consistency**: Standardized styling and behavior across all forms
- **Reusability**: Single source of truth for input components
- **Accessibility**: Built-in ARIA attributes and keyboard navigation
- **Validation**: Integrated error handling and validation feedback
- **Type Safety**: Full TypeScript support with proper prop types

## 📦 Available Components

### Text Inputs

#### `TextInput`
Standard text input for various text types.

```tsx
import { TextInput } from '@/components/common';

<TextInput
  label="Email Address"
  type="email"
  value={email}
  onChange={(value) => setEmail(value)}
  placeholder="you@example.com"
  required
  error={emailError}
  description="We'll never share your email"
/>
```

**Props:**
- `type`: `"text" | "email" | "password" | "url" | "tel" | "number"`
- `value`, `onChange`: Controlled input
- `placeholder`, `maxLength`, `minLength`, `pattern`
- `autoComplete`: Browser autocomplete behavior
- `readOnly`: Make input read-only

#### `TextareaInput`
Multi-line text input with resizable options.

```tsx
<TextareaInput
  label="Comments"
  value={comments}
  onChange={(value) => setComments(value)}
  rows={4}
  maxLength={500}
  resize="vertical"
  description="Additional notes (max 500 characters)"
/>
```

**Props:**
- `rows`: Number of visible text lines
- `resize`: `"none" | "vertical" | "horizontal" | "both"`
- All text input props apply

#### `SearchInput`
Specialized input for search functionality with debouncing.

```tsx
<SearchInput
  value={searchTerm}
  onChange={(value) => setSearchTerm(value)}
  onSearch={(value) => performSearch(value)}
  placeholder="Search users..."
  debounceMs={300}
  showClearButton
/>
```

**Props:**
- `onSearch`: Callback triggered after debounce
- `debounceMs`: Debounce delay (default: 300ms)
- `showSearchIcon`, `showClearButton`: Toggle icons
- `onClear`: Clear button callback

### Selection Inputs

#### `SelectInput`
Dropdown selection with optional search and clear functionality.

```tsx
<SelectInput
  label="Country"
  value={selectedCountry}
  onChange={(value) => setSelectedCountry(value)}
  options={countryOptions}
  searchable
  clearable
  placeholder="Select country..."
/>
```

**Props:**
- `options`: Array of `{ value: string, label: string, disabled?: boolean }`
- `searchable`: Enable search within options
- `clearable`: Show clear button
- `onClear`: Clear selection callback

#### `RadioInput`
Radio button group for single selection.

```tsx
<RadioInput
  label="Theme Preference"
  value={theme}
  onChange={(value) => setTheme(value)}
  options={themeOptions}
  orientation="horizontal"
/>
```

**Props:**
- `options`: Array of radio options
- `orientation`: `"horizontal" | "vertical"`

### Date & Time

#### `DateInput`
Date picker with calendar popup.

```tsx
<DateInput
  label="Birth Date"
  value={birthDate}
  onChange={(date) => setBirthDate(date)}
  maxDate={new Date()}
  format="PPP"
  disabledDays={(date) => date.getDay() === 0} // Disable Sundays
/>
```

**Props:**
- `minDate`, `maxDate`: Date range restrictions
- `disabledDays`: Function to disable specific dates
- `format`: Date display format (date-fns format)

### Boolean Inputs

#### `CheckboxInput`
Single checkbox for boolean values.

```tsx
<CheckboxInput
  label="Subscribe to newsletter"
  checked={isSubscribed}
  onChange={(checked) => setIsSubscribed(checked)}
  indeterminate={partialSelection}
/>
```

**Props:**
- `checked`: Boolean state
- `indeterminate`: Indeterminate state for partial selections

#### `SwitchInput`
Toggle switch for boolean values.

```tsx
<SwitchInput
  label="Enable notifications"
  checked={notificationsEnabled}
  onChange={(checked) => setNotificationsEnabled(checked)}
/>
```

### File Handling

#### `FileInput`
File upload with drag-and-drop, validation, and preview.

```tsx
<FileInput
  label="Profile Documents"
  accept=".pdf,.doc,.docx"
  multiple
  onChange={(files) => setFiles(files)}
  maxSize={5 * 1024 * 1024} // 5MB
  allowedTypes={['application/pdf', 'application/msword']}
  showPreview
/>
```

**Props:**
- `accept`: File type restrictions
- `multiple`: Allow multiple files
- `maxSize`: Maximum file size in bytes
- `allowedTypes`: MIME type validation
- `showPreview`: Show selected files list

## 🔧 Common Props

All input components share these base props:

```tsx
interface BaseInputProps {
  label?: string;           // Field label
  description?: string;     // Help text below input
  error?: string;          // Error message (shows in red)
  required?: boolean;      // Shows required asterisk
  disabled?: boolean;      // Disable the input
  className?: string;      // Additional CSS classes
  id?: string;            // Custom ID (auto-generated if not provided)
}
```

## 🎨 Styling & Theming

All components use Tailwind CSS classes and follow the design system:

- **Colors**: Consistent with CSS variables (`--primary`, `--destructive`, etc.)
- **Spacing**: Standard spacing scale (`space-y-2`, `p-4`, etc.)
- **Typography**: Text sizes and weights follow design tokens
- **Focus States**: Ring-based focus indicators for accessibility
- **Error States**: Red border and text for validation errors

## 🔒 Type Safety

Full TypeScript support with proper prop interfaces:

```tsx
import type { 
  TextInputProps, 
  SelectOption, 
  DateInputProps 
} from '@/components/common';

const options: SelectOption[] = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2', disabled: true },
];
```

## ♿ Accessibility

Built-in accessibility features:

- **ARIA Labels**: Proper labeling and descriptions
- **Keyboard Navigation**: Full keyboard support
- **Focus Management**: Logical tab order
- **Screen Reader Support**: Semantic markup and ARIA attributes
- **Color Contrast**: Meets WCAG guidelines
- **Error Announcements**: Accessible error messaging

## 📝 Usage Examples

### Basic Form

```tsx
import { 
  TextInput, 
  SelectInput, 
  CheckboxInput, 
  DateInput 
} from '@/components/common';

function UserForm() {
  const [formData, setFormData] = useState({
    name: '',
    country: '',
    newsletter: false,
    birthDate: undefined,
  });

  return (
    <form className="space-y-6">
      <TextInput
        label="Full Name"
        value={formData.name}
        onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
        required
      />
      
      <SelectInput
        label="Country"
        value={formData.country}
        onChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
        options={countryOptions}
        searchable
      />
      
      <DateInput
        label="Date of Birth"
        value={formData.birthDate}
        onChange={(date) => setFormData(prev => ({ ...prev, birthDate: date }))}
      />
      
      <CheckboxInput
        label="Subscribe to newsletter"
        checked={formData.newsletter}
        onChange={(checked) => setFormData(prev => ({ ...prev, newsletter: checked }))}
      />
    </form>
  );
}
```

### Filter Panel

```tsx
import { SearchInput, SelectInput } from '@/components/common';

function FilterPanel({ onFiltersChange }) {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    category: '',
  });

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <SearchInput
        placeholder="Search items..."
        value={filters.search}
        onChange={(value) => handleFilterChange('search', value)}
        debounceMs={300}
      />
      
      <SelectInput
        placeholder="Filter by status"
        value={filters.status}
        onChange={(value) => handleFilterChange('status', value)}
        options={statusOptions}
        clearable
      />
      
      <SelectInput
        placeholder="Filter by category"
        value={filters.category}
        onChange={(value) => handleFilterChange('category', value)}
        options={categoryOptions}
        clearable
      />
    </div>
  );
}
```

## 🧪 Testing

Components include proper test IDs and semantic markup for testing:

```tsx
// Test by label
const nameInput = screen.getByLabelText('Full Name');

// Test by placeholder
const searchInput = screen.getByPlaceholderText('Search users...');

// Test by role
const submitButton = screen.getByRole('button', { name: 'Submit' });
```

## 🚀 Demo

Visit `/component-demo` to see all components in action with interactive examples and code samples.

## 📚 Migration Guide

### From Individual Components

**Before:**
```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div className="space-y-2">
  <Label htmlFor="name">Name</Label>
  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
</div>
```

**After:**
```tsx
import { TextInput } from '@/components/common';

<TextInput
  label="Name"
  value={name}
  onChange={(value) => setName(value)}
/>
```

### Benefits of Migration

1. **Reduced Boilerplate**: No need to manually handle labels, spacing, and error states
2. **Consistent Styling**: Automatic application of design system
3. **Better Validation**: Built-in error display and ARIA attributes
4. **Type Safety**: Proper TypeScript interfaces
5. **Accessibility**: WCAG-compliant out of the box

## 🤝 Contributing

When adding new input types or modifying existing ones:

1. **Follow Patterns**: Use existing components as templates
2. **Add Documentation**: Update this README with new props and examples
3. **Include Types**: Export proper TypeScript interfaces
4. **Test Accessibility**: Verify keyboard and screen reader support
5. **Update Demo**: Add examples to the demo page

## 📋 Checklist for New Components

- [ ] Follows `BaseInputProps` interface
- [ ] Includes proper TypeScript types
- [ ] Has label, description, and error handling
- [ ] Supports disabled state
- [ ] Implements proper focus management
- [ ] Includes ARIA attributes
- [ ] Added to demo page
- [ ] Documentation updated
- [ ] Follows design system tokens